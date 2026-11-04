// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const ALICE = "00000000-0000-4000-8000-00000000000a";
const MALLORY = "00000000-0000-4000-8000-00000000000b";

const insertDocument = (tx: Transaction, userId: string, familyId: string, memberId: string | null = null, filePath = `${familyId}/general/a.pdf`) =>
  tx.query(
    "INSERT INTO public.documents (family_id, user_id, member_id, name, file_path) VALUES ($1, $2, $3, 'Doc', $4) RETURNING id",
    [familyId, userId, memberId, filePath],
  );

describe("family isolation", () => {
  let db: PGlite;
  let aliceFamily: string;
  let malloryFamily: string;
  let aliceMember: string;
  let aliceDocument: string;

  beforeAll(async () => {
    db = await createDatabase();
    await applyMigrations(db, migrationFiles());
    aliceFamily = await createUser(db, ALICE);
    malloryFamily = await createUser(db, MALLORY);

    await asUser(db, ALICE, async tx => {
      const member = await tx.query<{ id: string }>(
        "INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha') RETURNING id",
        [aliceFamily, ALICE],
      );
      aliceMember = member.rows[0].id;
      const doc = await insertDocument(tx, ALICE, aliceFamily, aliceMember);
      aliceDocument = (doc.rows[0] as { id: string }).id;
      await tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${aliceFamily}/general/a.pdf`]);
    });
  });

  it("lets an owner read their own documents", async () => {
    const { rows } = await asUser(db, ALICE, tx => tx.query("SELECT id FROM public.documents"));
    expect(rows).toHaveLength(1);
  });

  it("hides another family's rows and files", async () => {
    await asUser(db, MALLORY, async tx => {
      expect((await tx.query("SELECT id FROM public.documents")).rows).toHaveLength(0);
      expect((await tx.query("SELECT id FROM public.family_members")).rows).toHaveLength(0);
      expect((await tx.query("SELECT id FROM public.families WHERE id = $1", [aliceFamily])).rows).toHaveLength(0);
      expect((await tx.query("SELECT id FROM storage.objects")).rows).toHaveLength(0);
    });
  });

  it("gives anonymous callers nothing", async () => {
    await asAnon(db, async tx => {
      expect((await tx.query("SELECT id FROM public.documents")).rows).toHaveLength(0);
      expect((await tx.query("SELECT id FROM storage.objects")).rows).toHaveLength(0);
    });
  });

  it("blocks changing or deleting another family's document", async () => {
    await asUser(db, MALLORY, async tx => {
      const updated = await tx.query("UPDATE public.documents SET name = 'pwned' WHERE id = $1", [aliceDocument]);
      const deleted = await tx.query("DELETE FROM public.documents WHERE id = $1", [aliceDocument]);
      expect(updated.affectedRows).toBe(0);
      expect(deleted.affectedRows).toBe(0);
    });
  });

  it("blocks adding a document to another family, even under the caller's own user_id", async () => {
    await expect(asUser(db, MALLORY, tx => insertDocument(tx, MALLORY, aliceFamily))).rejects.toThrow(/row-level security/);
  });

  it("blocks attributing a document to another user", async () => {
    await expect(asUser(db, MALLORY, tx => insertDocument(tx, ALICE, malloryFamily))).rejects.toThrow(/row-level security/);
  });

  it("blocks linking a document to another family's member", async () => {
    await expect(asUser(db, MALLORY, tx => insertDocument(tx, MALLORY, malloryFamily, aliceMember))).rejects.toThrow(/documents_member_same_family/);
  });

  it("blocks pointing a document row at another family's file", async () => {
    await expect(
      asUser(db, MALLORY, tx => insertDocument(tx, MALLORY, malloryFamily, null, `${aliceFamily}/general/a.pdf`)),
    ).rejects.toThrow(/documents_file_path_in_family/);
  });

  it("blocks a member whose parent belongs to another family", async () => {
    await expect(
      asUser(db, MALLORY, tx =>
        tx.query(
          "INSERT INTO public.family_members (family_id, user_id, name, parent_member_id) VALUES ($1, $2, 'X', $3)",
          [malloryFamily, MALLORY, aliceMember],
        ),
      ),
    ).rejects.toThrow(/family_members_parent_same_family/);
  });

  it("blocks uploading into another family's storage folder", async () => {
    await expect(
      asUser(db, MALLORY, tx =>
        tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${aliceFamily}/general/evil.pdf`]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets an owner read their own files", async () => {
    const { rows } = await asUser(db, ALICE, tx => tx.query("SELECT name FROM storage.objects"));
    expect(rows).toHaveLength(1);
  });

  it("does not unlock other families' files when a family is renamed to a crafted path", async () => {
    await asUser(db, MALLORY, async tx => {
      await tx.query("UPDATE public.families SET name = $1 WHERE id = $2", [`${malloryFamily}/x`, malloryFamily]);
      expect((await tx.query("SELECT name FROM storage.objects")).rows).toHaveLength(0);
      expect((await tx.query("DELETE FROM storage.objects")).affectedRows).toBe(0);
    });
    const { rows } = await asUser(db, ALICE, tx => tx.query("SELECT name FROM storage.objects"));
    expect(rows).toHaveLength(1);
  });

  it("keeps a document when its member is deleted", async () => {
    await asUser(db, ALICE, async tx => {
      await tx.query("DELETE FROM public.family_members WHERE id = $1", [aliceMember]);
      const { rows } = await tx.query<{ member_id: string | null; family_id: string }>(
        "SELECT member_id, family_id FROM public.documents WHERE id = $1",
        [aliceDocument],
      );
      expect(rows[0]).toEqual({ member_id: null, family_id: aliceFamily });
    });
  });

  it("limits the bucket's file size and types, and keeps it private", async () => {
    const { rows } = await db.query<{ public: boolean; file_size_limit: string; allowed_mime_types: string[] }>(
      "SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'family-documents'",
    );
    expect(rows[0].public).toBe(false);
    expect(Number(rows[0].file_size_limit)).toBe(10 * 1024 * 1024);
    expect(rows[0].allowed_mime_types).not.toContain("text/html");
    expect(rows[0].allowed_mime_types).not.toContain("image/svg+xml");
  });
});
