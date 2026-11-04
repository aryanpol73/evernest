// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { applyMigrations, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const EARLY = "00000000-0000-4000-8000-0000000000b1";
const UNNAMED = "00000000-0000-4000-8000-0000000000b2";
const NORMAL = "00000000-0000-4000-8000-0000000000b3";
const BACKFILL = "20261104180000_backfill_accounts.sql";

describe("accounts created before the signup trigger", () => {
  let db: PGlite;
  let normalFamily: string;

  beforeAll(async () => {
    db = await createDatabase();
    // These users exist before any migration, as the earliest live accounts do.
    await db.query("INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'early@example.com', $2), ($3, 'unnamed@example.com', '{}')", [
      EARLY,
      JSON.stringify({ full_name: "Asha" }),
      UNNAMED,
    ]);
    const files = migrationFiles();
    const backfill = files.indexOf(BACKFILL);
    await applyMigrations(db, files.slice(0, backfill));
    normalFamily = await createUser(db, NORMAL);
    await applyMigrations(db, files.slice(backfill));
  }, 60_000);

  it("gives them a profile, settings, a family, and an owner role", async () => {
    for (const user of [EARLY, UNNAMED]) {
      expect((await db.query("SELECT 1 FROM public.profiles WHERE id = $1", [user])).rows).toHaveLength(1);
      expect((await db.query("SELECT 1 FROM public.user_settings WHERE id = $1 AND NOT onboarding_completed", [user])).rows).toHaveLength(1);
      expect((await db.query("SELECT 1 FROM public.family_memberships WHERE user_id = $1 AND role = 'owner'", [user])).rows).toHaveLength(1);
    }
  });

  it("names the family as signup would", async () => {
    const name = async (user: string) => (await db.query<{ name: string }>("SELECT name FROM public.families WHERE owner_id = $1", [user])).rows[0].name;
    expect(await name(EARLY)).toBe("Asha's Family");
    expect(await name(UNNAMED)).toBe("My's Family");
  });

  it("lets a repaired account use the app, within its own family only", async () => {
    await asUser(db, EARLY, async tx => {
      const { rows } = await tx.query<{ id: string }>("SELECT family_id AS id FROM public.family_memberships WHERE user_id = $1", [EARLY]);
      await tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Ravi')", [rows[0].id, EARLY]);
      expect((await tx.query("SELECT 1 FROM public.families WHERE id = $1", [normalFamily])).rows).toHaveLength(0);
    });
  });

  it("leaves existing accounts alone, and is safe to run twice", async () => {
    await db.exec(readFileSync(path.resolve(process.cwd(), "supabase/migrations", BACKFILL), "utf8"));
    const families = await db.query<{ id: string }>("SELECT id FROM public.families WHERE owner_id = $1", [NORMAL]);
    expect(families.rows).toEqual([{ id: normalFamily }]);
    expect((await db.query("SELECT 1 FROM public.families")).rows).toHaveLength(3);
  });
});
