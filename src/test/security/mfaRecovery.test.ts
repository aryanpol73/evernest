// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

interface Result {
  ok: boolean;
  locked_until: string | null;
}

describe("MFA recovery codes", () => {
  let db: PGlite;
  let next = 1;

  const now = () => Math.floor(Date.now() / 1000);
  const aal2 = { aal: "aal2" };
  const freshPassword = () => ({ aal: "aal1", amr: [{ method: "password", timestamp: now() }] });

  const generate = async (user: string, claims: Record<string, unknown> = aal2) => {
    const { rows } = await asUser(db, user, tx => tx.query<{ codes: string[] }>("SELECT public.generate_mfa_recovery_codes() AS codes"), claims);
    return rows[0].codes;
  };

  const redeem = async (user: string, code: string, claims: Record<string, unknown> = freshPassword()) => {
    const { rows } = await asUser(db, user, tx => tx.query<{ result: Result }>("SELECT public.redeem_mfa_recovery_code($1) AS result", [code]), claims);
    return rows[0].result;
  };

  const addFactor = (user: string) => db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [user]);
  const factorCount = async (user: string) => (await db.query("SELECT 1 FROM auth.mfa_factors WHERE user_id = $1", [user])).rows.length;

  const mfaUser = async () => {
    const user = id(next++);
    await createUser(db, user);
    await addFactor(user);
    return user;
  };

  beforeAll(async () => {
    db = await createDatabase();
    await applyMigrations(db, migrationFiles());
  }, 60_000);

  describe("generating", () => {
    it("gives ten different, readable, high-entropy codes", async () => {
      const codes = await generate(await mfaUser());
      expect(codes).toHaveLength(10);
      expect(new Set(codes).size).toBe(10);
      for (const code of codes) expect(code).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/);
    });

    it("stores only hashes", async () => {
      const user = await mfaUser();
      const codes = await generate(user);
      const { rows } = await db.query<{ code_hash: string }>("SELECT code_hash FROM private.mfa_recovery_codes WHERE user_id = $1", [user]);
      expect(rows).toHaveLength(10);
      const stored = rows.map(r => r.code_hash);
      for (const code of codes) {
        expect(stored).not.toContain(code);
        expect(stored).not.toContain(code.replace(/-/g, ""));
      }
    });

    it("needs a session that really completed MFA", async () => {
      const user = await mfaUser();
      await expect(generate(user, { aal: "aal1" })).rejects.toThrow(/Verify with your authenticator/);
      await expect(generate(user, {})).rejects.toThrow(/Verify with your authenticator/);
    });

    it("is refused for accounts with no MFA", async () => {
      const user = id(next++);
      await createUser(db, user);
      await expect(generate(user, aal2)).rejects.toThrow(/Verify with your authenticator/);
    });

    it("replaces earlier codes", async () => {
      const user = await mfaUser();
      const first = await generate(user);
      await generate(user);
      expect((await redeem(user, first[0])).ok).toBe(false);
    });
  });

  describe("redeeming", () => {
    it("removes MFA and every other code", async () => {
      const user = await mfaUser();
      const codes = await generate(user);
      expect((await redeem(user, codes[0])).ok).toBe(true);
      expect(await factorCount(user)).toBe(0);
      const { rows } = await db.query("SELECT 1 FROM private.mfa_recovery_codes WHERE user_id = $1", [user]);
      expect(rows).toHaveLength(0);
    });

    it("gives a password-only session access again", async () => {
      const user = await mfaUser();
      const codes = await generate(user);
      const claims = freshPassword();
      const before = await asUser(db, user, tx => tx.query("SELECT 1 FROM public.user_settings"), claims);
      expect(before.rows).toHaveLength(0);
      await redeem(user, codes[0], claims);
      const after = await asUser(db, user, tx => tx.query("SELECT 1 FROM public.user_settings"), claims);
      expect(after.rows).toHaveLength(1);
    });

    it("works for a Google account that has just signed in", async () => {
      const user = await mfaUser();
      const [code] = await generate(user);
      expect((await redeem(user, code, { aal: "aal1", amr: [{ method: "oauth", timestamp: now() }] })).ok).toBe(true);
    });

    it("accepts a code however it is typed", async () => {
      const user = await mfaUser();
      const [code] = await generate(user);
      expect((await redeem(user, ` ${code.toLowerCase().replace(/-/g, " ")} `)).ok).toBe(true);
    });

    it.each([
      ["no sign-in proof", {}],
      ["an old sign-in", { amr: [{ method: "password", timestamp: 1 }] }],
      ["a one-time code sign-in", { amr: [{ method: "otp", timestamp: Math.floor(Date.now() / 1000) }] }],
      ["a password reset link", { amr: [{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) }] }],
    ])("is refused with %s, so a code alone is not enough", async (_name, claims) => {
      const user = await mfaUser();
      const [code] = await generate(user);
      await expect(redeem(user, code, claims)).rejects.toThrow(/recent sign-in/);
      expect(await factorCount(user)).toBe(1);
    });

    it("cannot use someone else's code", async () => {
      const victim = await mfaUser();
      const attacker = await mfaUser();
      await generate(attacker);
      const [victimCode] = await generate(victim);
      expect((await redeem(attacker, victimCode)).ok).toBe(false);
      expect(await factorCount(attacker)).toBe(1);
      expect(await factorCount(victim)).toBe(1);
    });

    it("cannot use codes from before a new authenticator was set up", async () => {
      const user = await mfaUser();
      const [oldCode] = await generate(user);
      await db.query("UPDATE private.mfa_recovery_codes SET created_at = now() - interval '1 day' WHERE user_id = $1", [user]);
      expect((await redeem(user, oldCode)).ok).toBe(false);
      expect(await factorCount(user)).toBe(1);
    });

    it("does nothing for an account with no codes", async () => {
      expect((await redeem(await mfaUser(), "0000-0000-0000-0000-0000")).ok).toBe(false);
    });
  });

  describe("guessing", () => {
    it("locks after five wrong codes, and a right code then fails too", async () => {
      const user = await mfaUser();
      const [code] = await generate(user);
      for (let i = 0; i < 4; i++) expect((await redeem(user, "BAD")).locked_until).toBeNull();
      expect((await redeem(user, "BAD")).locked_until).not.toBeNull();
      expect((await redeem(user, code)).ok).toBe(false);
      expect(await factorCount(user)).toBe(1);
    });

    it("allows attempts again after the lock expires", async () => {
      const user = await mfaUser();
      const [code] = await generate(user);
      for (let i = 0; i < 5; i++) await redeem(user, "BAD");
      await db.query("UPDATE private.mfa_recovery_attempts SET locked_until = now() - interval '1 minute' WHERE user_id = $1", [user]);
      expect((await redeem(user, "BAD")).locked_until).toBeNull();
      expect((await redeem(user, code)).ok).toBe(true);
    });
  });

  describe("protection", () => {
    it("keeps codes and attempts out of reach", async () => {
      const user = await mfaUser();
      await expect(asUser(db, user, tx => tx.query("SELECT * FROM private.mfa_recovery_codes"), aal2)).rejects.toThrow(/permission denied/);
      await expect(asUser(db, user, tx => tx.query("DELETE FROM private.mfa_recovery_attempts"), aal2)).rejects.toThrow(/permission denied/);
    });

    it("refuses anonymous callers", async () => {
      await expect(asAnon(db, tx => tx.query("SELECT public.redeem_mfa_recovery_code('x')"))).rejects.toThrow(/permission denied/);
      await expect(asAnon(db, tx => tx.query("SELECT public.generate_mfa_recovery_codes()"))).rejects.toThrow(/permission denied/);
    });

    it("hides the remaining count from a password-only session", async () => {
      const user = await mfaUser();
      await generate(user);
      await expect(asUser(db, user, tx => tx.query("SELECT public.mfa_recovery_codes_remaining()"), { aal: "aal1" })).rejects.toThrow(/Verify with your authenticator/);
      const { rows } = await asUser(db, user, tx => tx.query<{ count: number }>("SELECT public.mfa_recovery_codes_remaining() AS count"), aal2);
      expect(rows[0].count).toBe(10);
    });

    it("logs generation, failures, and use for the owner", async () => {
      const user = await mfaUser();
      const [code] = await generate(user);
      await redeem(user, "BAD");
      await redeem(user, code);
      const { rows } = await db.query<{ action: string }>(
        "SELECT action FROM public.audit_events e JOIN public.families f ON f.id = e.family_id WHERE f.owner_id = $1 ORDER BY e.id",
        [user],
      );
      expect(rows.map(r => r.action)).toEqual(["mfa_recovery_codes_created", "mfa_recovery_failed", "mfa_recovery_used"]);
    });

    it("does not block account deletion", async () => {
      const user = await mfaUser();
      await generate(user);
      await db.query("DELETE FROM auth.users WHERE id = $1", [user]);
      expect((await db.query("SELECT 1 FROM private.mfa_recovery_codes WHERE user_id = $1", [user])).rows).toHaveLength(0);
    });
  });
});
