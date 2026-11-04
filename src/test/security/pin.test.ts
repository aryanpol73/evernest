// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const USER = "00000000-0000-4000-8000-000000000001";
const LOCKOUT_USER = "00000000-0000-4000-8000-000000000002";
const LEGACY_USER = "00000000-0000-4000-8000-000000000003";
const RESET_USER = "00000000-0000-4000-8000-000000000004";

interface PinResult {
  ok: boolean;
  locked_until: string | null;
  attempts_remaining: number;
}

async function call(tx: Transaction, sql: string, params: unknown[] = []): Promise<PinResult> {
  const { rows } = await tx.query<{ result: PinResult }>(`SELECT ${sql} AS result`, params);
  return rows[0].result;
}

const verify = (db: PGlite, user: string, pin: string) => asUser(db, user, tx => call(tx, "public.verify_pin($1)", [pin]));
const setPin = (db: PGlite, user: string, pin: string, current: string | null = null) =>
  asUser(db, user, tx => call(tx, "public.set_pin($1, $2)", [pin, current]));

describe("server-side PIN", () => {
  let db: PGlite;

  beforeAll(async () => {
    db = await createDatabase();
    const files = migrationFiles();
    const hardening = files.indexOf("20261104120000_security_hardening.sql");
    await applyMigrations(db, files.slice(0, hardening));

    // A user whose PIN was saved by the old client: SHA-256 of pin + salt.
    await createUser(db, LEGACY_USER);
    const salt = "abcd1234";
    const legacyHash = createHash("sha256").update(`135790${salt}`).digest("hex");
    await db.query("UPDATE public.user_settings SET pin_hash = $1, pin_salt = $2 WHERE id = $3", [legacyHash, salt, LEGACY_USER]);

    await applyMigrations(db, files.slice(hardening));
    await createUser(db, USER);
    await createUser(db, LOCKOUT_USER);
    await createUser(db, RESET_USER);
  }, 60_000);

  it("removes PIN secrets from the client-readable settings table", async () => {
    const { rows } = await db.query<{ column_name: string }>(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'user_settings'",
    );
    expect(rows.map(r => r.column_name).filter(c => c.startsWith("pin"))).toEqual([]);
  });

  it("denies direct access to the secrets table", async () => {
    await expect(asUser(db, USER, tx => tx.query("SELECT * FROM private.user_pins"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, USER, tx => tx.query("UPDATE private.user_pins SET attempts = 0"))).rejects.toThrow(/permission denied/);
  });

  it("denies PIN functions to anonymous callers", async () => {
    await expect(asAnon(db, tx => call(tx, "public.verify_pin('123456')"))).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, tx => call(tx, "public.pin_status()"))).rejects.toThrow(/permission denied/);
  });

  it("accepts the right PIN, rejects a wrong one, and stores bcrypt", async () => {
    expect((await setPin(db, USER, "246810")).ok).toBe(true);
    expect((await verify(db, USER, "246810")).ok).toBe(true);
    expect(await verify(db, USER, "000000")).toMatchObject({ ok: false, attempts_remaining: 4 });

    const { rows } = await db.query<{ pin_hash: string }>("SELECT pin_hash FROM private.user_pins WHERE user_id = $1", [USER]);
    expect(rows[0].pin_hash).toMatch(/^\$2[aby]\$/);
  });

  it("rejects malformed PINs without using an attempt", async () => {
    await expect(verify(db, USER, "12")).rejects.toThrow(/6 digits/);
    await expect(setPin(db, USER, "abcdef", "246810")).rejects.toThrow(/6 digits/);
  });

  it("requires the current PIN to change or remove a PIN", async () => {
    await expect(setPin(db, USER, "111111")).rejects.toThrow(/6 digits/);
    expect((await setPin(db, USER, "111111", "999999")).ok).toBe(false);
    expect((await asUser(db, USER, tx => call(tx, "public.remove_pin($1)", ["999999"]))).ok).toBe(false);
    expect((await verify(db, USER, "246810")).ok).toBe(true);
  });

  it("locks after five wrong attempts, and the right PIN then fails too", async () => {
    await setPin(db, LOCKOUT_USER, "121212");
    for (let i = 0; i < 4; i++) {
      expect((await verify(db, LOCKOUT_USER, "000000")).locked_until).toBeNull();
    }
    const fifth = await verify(db, LOCKOUT_USER, "000000");
    expect(fifth.locked_until).not.toBeNull();
    expect(fifth.attempts_remaining).toBe(0);
    expect((await verify(db, LOCKOUT_USER, "121212")).ok).toBe(false);
  });

  it("cannot be unlocked by the client, and reports the lock", async () => {
    await expect(
      asUser(db, LOCKOUT_USER, tx => tx.query("UPDATE public.user_settings SET pin_attempts = 0")),
    ).rejects.toThrow(/pin_attempts/);
    const { rows } = await asUser(db, LOCKOUT_USER, tx =>
      tx.query<{ status: { has_pin: boolean; locked_until: string | null } }>("SELECT public.pin_status() AS status"),
    );
    expect(rows[0].status.has_pin).toBe(true);
    expect(rows[0].status.locked_until).not.toBeNull();
  });

  it("allows attempts again once a lockout expires", async () => {
    await db.query("UPDATE private.user_pins SET locked_until = now() - interval '1 minute' WHERE user_id = $1", [LOCKOUT_USER]);
    expect(await verify(db, LOCKOUT_USER, "000000")).toMatchObject({ ok: false, attempts_remaining: 4 });
    expect((await verify(db, LOCKOUT_USER, "121212")).ok).toBe(true);
  });

  it("keeps legacy PINs working and upgrades them to bcrypt", async () => {
    expect((await verify(db, LEGACY_USER, "000000")).ok).toBe(false);
    expect((await verify(db, LEGACY_USER, "135790")).ok).toBe(true);

    const { rows } = await db.query<{ pin_hash: string; legacy_sha256: string | null }>(
      "SELECT pin_hash, legacy_sha256 FROM private.user_pins WHERE user_id = $1",
      [LEGACY_USER],
    );
    expect(rows[0].pin_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0].legacy_sha256).toBeNull();
    expect((await verify(db, LEGACY_USER, "135790")).ok).toBe(true);
  });

  describe("forgotten PIN reset", () => {
    const reset = (timestamp?: number, method = "password") =>
      asUser(db, RESET_USER, tx => tx.query("SELECT public.reset_pin_after_login()"), {
        amr: timestamp === undefined ? [] : [{ method, timestamp }],
      });
    const now = () => Math.floor(Date.now() / 1000);

    it("is refused without a recent password sign-in", async () => {
      await setPin(db, RESET_USER, "454545");
      await expect(reset()).rejects.toThrow(/recent password/);
      await expect(reset(now() - 3600)).rejects.toThrow(/recent password/);
      await expect(reset(now(), "otp")).rejects.toThrow(/recent password/);
      expect((await verify(db, RESET_USER, "454545")).ok).toBe(true);
    });

    it("clears the PIN after a fresh password sign-in", async () => {
      await reset(now());
      const { rows } = await asUser(db, RESET_USER, tx =>
        tx.query<{ status: { has_pin: boolean } }>("SELECT public.pin_status() AS status"),
      );
      expect(rows[0].status.has_pin).toBe(false);
    });
  });
});
