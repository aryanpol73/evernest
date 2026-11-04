// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const ENROLLED = "00000000-0000-4000-8000-0000000000e1";
const NOT_ENROLLED = "00000000-0000-4000-8000-0000000000e2";
const PENDING = "00000000-0000-4000-8000-0000000000e3";

const AAL1 = { aal: "aal1" };
const AAL2 = { aal: "aal2" };

const PROTECTED_TABLES = [
  "public.profiles",
  "public.families",
  "public.family_members",
  "public.documents",
  "public.user_settings",
  "storage.objects",
];

const count = async (tx: Transaction, table: string) => (await tx.query(`SELECT 1 FROM ${table}`)).rows.length;

describe("MFA enforcement", () => {
  let db: PGlite;
  let family: string;

  async function seedFamily(userId: string, familyId: string) {
    await asUser(db, userId, async tx => {
      await tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha')", [familyId, userId]);
      await tx.query("INSERT INTO public.documents (family_id, user_id, name, file_path) VALUES ($1, $2, 'Doc', $3)", [
        familyId,
        userId,
        `${familyId}/general/a.pdf`,
      ]);
      await tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${familyId}/general/a.pdf`]);
    }, AAL1);
  }

  beforeAll(async () => {
    db = await createDatabase();
    await applyMigrations(db, migrationFiles());

    family = await createUser(db, ENROLLED);
    await seedFamily(ENROLLED, family);
    await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [ENROLLED]);

    await seedFamily(NOT_ENROLLED, await createUser(db, NOT_ENROLLED));

    await seedFamily(PENDING, await createUser(db, PENDING));
    await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'unverified')", [PENDING]);
  }, 60_000);

  it.each(PROTECTED_TABLES)("hides %s from a password-only session once MFA is enrolled", async table => {
    await asUser(db, ENROLLED, async tx => expect(await count(tx, table)).toBe(0), AAL1);
  });

  it.each(PROTECTED_TABLES)("shows %s after MFA is completed", async table => {
    await asUser(db, ENROLLED, async tx => expect(await count(tx, table)).toBeGreaterThan(0), AAL2);
  });

  it("blocks writes from a password-only session", async () => {
    await asUser(db, ENROLLED, async tx => {
      const updated = await tx.query("UPDATE public.documents SET name = 'changed'");
      const deleted = await tx.query("DELETE FROM storage.objects");
      expect(updated.affectedRows).toBe(0);
      expect(deleted.affectedRows).toBe(0);
    }, AAL1);

    await expect(
      asUser(db, ENROLLED, tx =>
        tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${family}/general/b.pdf`]),
      AAL1),
    ).rejects.toThrow(/row-level security/);
  });

  it("does not depend on a client-supplied value other than the signed aal claim", async () => {
    await asUser(db, ENROLLED, async tx => expect(await count(tx, "public.documents")).toBe(0), { aal: "AAL2" });
    await asUser(db, ENROLLED, async tx => expect(await count(tx, "public.documents")).toBe(0));
  });

  it("leaves users without MFA unaffected", async () => {
    await asUser(db, NOT_ENROLLED, async tx => expect(await count(tx, "public.documents")).toBe(1), AAL1);
  });

  it("ignores a factor that was never verified, so abandoned setup cannot lock a user out", async () => {
    await asUser(db, PENDING, async tx => expect(await count(tx, "public.documents")).toBe(1), AAL1);
  });

  it("does not let a completed MFA session see another family", async () => {
    await asUser(db, NOT_ENROLLED, async tx => {
      const { rows } = await tx.query("SELECT 1 FROM public.documents WHERE family_id = $1", [family]);
      expect(rows).toHaveLength(0);
    }, AAL2);
  });

  it("denies the check to anonymous callers and hides factors from users", async () => {
    await expect(asAnon(db, tx => tx.query("SELECT public.mfa_satisfied()"))).rejects.toThrow(/permission denied/);
    await expect(asUser(db, ENROLLED, tx => tx.query("SELECT * FROM auth.mfa_factors"), AAL2)).rejects.toThrow(/permission denied/);
  });
});
