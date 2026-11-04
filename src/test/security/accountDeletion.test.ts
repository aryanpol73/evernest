// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const USER = "00000000-0000-4000-8000-0000000000d1";
const BYSTANDER = "00000000-0000-4000-8000-0000000000d2";
const MFA_USER = "00000000-0000-4000-8000-0000000000d3";

const now = () => Math.floor(Date.now() / 1000);
const freshLogin = (aal = "aal1") => ({ aal, amr: [{ method: "password", timestamp: now() }] });

describe("account deletion", () => {
  let db: PGlite;
  let bystanderFamily: string;

  const seed = async (userId: string) => {
    const family = await createUser(db, userId);
    await asUser(db, userId, async tx => {
      await tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha')", [family, userId]);
      await tx.query("INSERT INTO public.documents (family_id, user_id, name, file_path) VALUES ($1, $2, 'Doc', $3)", [family, userId, `${family}/general/a.pdf`]);
      await tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${family}/general/a.pdf`]);
      await tx.query("SELECT public.set_pin('246810')");
    });
    return family;
  };

  const remove = (userId: string, claims: object) => asUser(db, userId, tx => tx.query("SELECT public.delete_my_account()"), claims as Record<string, unknown>);
  const removeFiles = (userId: string, claims: object = {}) => asUser(db, userId, tx => tx.query("DELETE FROM storage.objects"), claims as Record<string, unknown>);
  const userExists = async (userId: string) => (await db.query("SELECT 1 FROM auth.users WHERE id = $1", [userId])).rows.length === 1;

  beforeAll(async () => {
    db = await createDatabase();
    await applyMigrations(db, migrationFiles());
    bystanderFamily = await seed(BYSTANDER);
  }, 60_000);

  beforeEach(async () => {
    await db.query("DELETE FROM auth.users WHERE id = ANY($1)", [[USER, MFA_USER]]);
    await db.query("DELETE FROM storage.objects WHERE name NOT LIKE $1", [`${bystanderFamily}/%`]);
  });

  it("removes the user and everything they own", async () => {
    const family = await seed(USER);
    await removeFiles(USER);
    await remove(USER, freshLogin());

    expect(await userExists(USER)).toBe(false);
    for (const table of ["public.families WHERE id = $1", "public.documents WHERE family_id = $1", "public.family_members WHERE family_id = $1", "public.audit_events WHERE family_id = $1"]) {
      expect((await db.query(`SELECT 1 FROM ${table}`, [family])).rows).toHaveLength(0);
    }
    for (const table of ["public.profiles WHERE id = $1", "public.user_settings WHERE id = $1", "private.user_pins WHERE user_id = $1"]) {
      expect((await db.query(`SELECT 1 FROM ${table}`, [USER])).rows).toHaveLength(0);
    }
  });

  it("leaves other families untouched", async () => {
    await seed(USER);
    await removeFiles(USER);
    await remove(USER, freshLogin());
    expect(await userExists(BYSTANDER)).toBe(true);
    expect((await db.query("SELECT 1 FROM public.documents WHERE family_id = $1", [bystanderFamily])).rows).toHaveLength(1);
    expect((await db.query("SELECT 1 FROM storage.objects WHERE name LIKE $1", [`${bystanderFamily}/%`])).rows).toHaveLength(1);
  });

  it("refuses while stored files remain, so nothing is left behind", async () => {
    await seed(USER);
    await expect(remove(USER, freshLogin())).rejects.toThrow(/Stored files must be removed/);
    expect(await userExists(USER)).toBe(true);
  });

  it.each([
    ["no sign-in proof", {}],
    ["an old sign-in", { amr: [{ method: "password", timestamp: now() - 3600 }] }],
    ["a one-time code sign-in", { amr: [{ method: "otp", timestamp: now() }] }],
    ["a password reset link", { amr: [{ method: "recovery", timestamp: now() }] }],
  ])("refuses a session with %s", async (_name, claims) => {
    await seed(USER);
    await removeFiles(USER);
    await expect(remove(USER, claims)).rejects.toThrow(/recent sign-in/);
    expect(await userExists(USER)).toBe(true);
  });

  it("works for a Google account that has just signed in", async () => {
    await seed(USER);
    await removeFiles(USER);
    await remove(USER, { aal: "aal1", amr: [{ method: "oauth", timestamp: now() }] });
    expect(await userExists(USER)).toBe(false);
  });

  it("requires MFA when enrolled", async () => {
    await seed(MFA_USER);
    await removeFiles(MFA_USER);
    await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [MFA_USER]);

    await expect(remove(MFA_USER, freshLogin("aal1"))).rejects.toThrow(/recent sign-in/);
    expect(await userExists(MFA_USER)).toBe(true);

    await remove(MFA_USER, freshLogin("aal2"));
    expect(await userExists(MFA_USER)).toBe(false);
  });

  it("refuses anonymous callers", async () => {
    await expect(asAnon(db, tx => tx.query("SELECT public.delete_my_account()"))).rejects.toThrow(/permission denied/);
    await expect(asAnon(db, tx => tx.query("SELECT public.list_my_storage_paths()"))).rejects.toThrow(/permission denied/);
  });

  it("lists only the caller's own files", async () => {
    const family = await seed(USER);
    const { rows } = await asUser(db, USER, tx => tx.query<{ path: string }>("SELECT public.list_my_storage_paths() AS path"));
    expect(rows.map(r => r.path)).toEqual([`${family}/general/a.pdf`]);
  });
});

describe("audit log retention", () => {
  it("purges a family's events past 12 months and keeps the rest", async () => {
    const db = await createDatabase();
    await applyMigrations(db, migrationFiles());
    const other = "00000000-0000-4000-8000-0000000000d5";
    const owner = "00000000-0000-4000-8000-0000000000d4";
    const family = await createUser(db, owner);
    const otherFamily = await createUser(db, other);

    await db.query(
      `INSERT INTO public.audit_events (family_id, action, created_at) VALUES
       ($1, 'pin_set', now() - interval '13 months'), ($1, 'pin_removed', now() - interval '11 months'),
       ($2, 'pin_set', now() - interval '13 months')`,
      [family, otherFamily],
    );

    await asUser(db, owner, tx => tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha')", [family, owner]));

    const { rows } = await db.query<{ action: string }>("SELECT action FROM public.audit_events WHERE family_id = $1 ORDER BY id", [family]);
    expect(rows.map(r => r.action)).toEqual(["pin_removed", "member_added"]);
    expect((await db.query("SELECT 1 FROM public.audit_events WHERE family_id = $1", [otherFamily])).rows).toHaveLength(1);
  }, 60_000);
});
