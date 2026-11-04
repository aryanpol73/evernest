// @vitest-environment node
import { createHash } from "node:crypto";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const OWNER = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";
const LEGACY = "00000000-0000-4000-8000-0000000000a3";
const LEAVING = "00000000-0000-4000-8000-0000000000a4";
const MFA_USER = "00000000-0000-4000-8000-0000000000a5";

interface AuditRow {
  action: string;
  actor_id: string | null;
  target_name: string | null;
  source: string;
}

describe("audit log", () => {
  let db: PGlite;
  let family: string;
  let documentId: string;

  const addDocument = async (tx: Transaction, userId: string, familyId: string, name = "Passport") => {
    const { rows } = await tx.query<{ id: string }>(
      "INSERT INTO public.documents (family_id, user_id, name, file_path) VALUES ($1, $2, $3, $4) RETURNING id",
      [familyId, userId, name, `${familyId}/general/${name}.pdf`],
    );
    return rows[0].id;
  };

  const events = async (familyId = family) =>
    (await db.query<AuditRow>("SELECT action, actor_id, target_name, source FROM public.audit_events WHERE family_id = $1 ORDER BY id", [familyId])).rows;

  const actions = async (familyId = family) => (await events(familyId)).map(e => e.action);

  const clearEvents = () => db.exec("DELETE FROM public.audit_events");

  beforeAll(async () => {
    db = await createDatabase();
    const files = migrationFiles();
    const hardening = files.indexOf("20261104120000_security_hardening.sql");
    await applyMigrations(db, files.slice(0, hardening));

    await createUser(db, LEGACY);
    const salt = "abcd1234";
    const legacyHash = createHash("sha256").update(`135790${salt}`).digest("hex");
    await db.query("UPDATE public.user_settings SET pin_hash = $1, pin_salt = $2 WHERE id = $3", [legacyHash, salt, LEGACY]);

    await applyMigrations(db, files.slice(hardening));

    family = await createUser(db, OWNER);
    await createUser(db, OTHER);
    await asUser(db, OWNER, async tx => {
      documentId = await addDocument(tx, OWNER, family);
    });
  }, 60_000);

  beforeEach(clearEvents);

  describe("server-recorded changes", () => {
    it("records an upload with the real actor", async () => {
      await asUser(db, OWNER, tx => addDocument(tx, OWNER, family, "Insurance"));
      expect(await events()).toEqual([{ action: "document_uploaded", actor_id: OWNER, target_name: "Insurance", source: "server" }]);
    });

    it("records a rename but not a dismissed reminder", async () => {
      await asUser(db, OWNER, async tx => {
        await tx.query("UPDATE public.documents SET dismissed_reminder = true WHERE id = $1", [documentId]);
        await tx.query("UPDATE public.documents SET name = 'Passport 2' WHERE id = $1", [documentId]);
      });
      expect(await actions()).toEqual(["document_updated"]);
    });

    it("keeps the name of a deleted document", async () => {
      const id = await asUser(db, OWNER, tx => addDocument(tx, OWNER, family, "Old Will"));
      await clearEvents();
      await asUser(db, OWNER, tx => tx.query("DELETE FROM public.documents WHERE id = $1", [id]));
      expect(await events()).toMatchObject([{ action: "document_deleted", target_name: "Old Will" }]);
    });

    it("records member changes, with one entry when a member with documents is removed", async () => {
      await asUser(db, OWNER, async tx => {
        const { rows } = await tx.query<{ id: string }>(
          "INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Ravi') RETURNING id",
          [family, OWNER],
        );
        await tx.query("UPDATE public.family_members SET phone = '123' WHERE id = $1", [rows[0].id]);
        await tx.query("UPDATE public.documents SET member_id = $1 WHERE id = $2", [rows[0].id, documentId]);
        await tx.query("DELETE FROM public.family_members WHERE id = $1", [rows[0].id]);
      });
      expect(await actions()).toEqual(["member_added", "member_updated", "member_removed"]);
    });
  });

  describe("PIN events", () => {
    const rpc = (user: string, sql: string, params: unknown[]) => asUser(db, user, tx => tx.query(`SELECT ${sql}`, params));

    it("records set, failed, lockout, and removal", async () => {
      await rpc(OWNER, "public.set_pin($1)", ["246810"]);
      for (let i = 0; i < 5; i++) await rpc(OWNER, "public.verify_pin($1)", ["000000"]);
      await db.query("UPDATE private.user_pins SET locked_until = NULL, attempts = 0 WHERE user_id = $1", [OWNER]);
      await rpc(OWNER, "public.remove_pin($1)", ["246810"]);

      expect(await actions()).toEqual(["pin_set", "pin_failed", "pin_failed", "pin_failed", "pin_failed", "pin_locked", "pin_removed"]);
    });

    it("records a failed attempt straight after a lockout expires", async () => {
      await rpc(OWNER, "public.set_pin($1)", ["246810"]);
      await db.query("UPDATE private.user_pins SET attempts = 5, locked_until = now() - interval '1 minute' WHERE user_id = $1", [OWNER]);
      await clearEvents();
      await rpc(OWNER, "public.verify_pin($1)", ["000000"]);
      expect(await actions()).toEqual(["pin_failed"]);
      await db.query("DELETE FROM private.user_pins WHERE user_id = $1", [OWNER]);
    });

    it("records a PIN change, but not a successful unlock", async () => {
      await rpc(OWNER, "public.set_pin($1)", ["246810"]);
      await clearEvents();
      await rpc(OWNER, "public.verify_pin($1)", ["246810"]);
      expect(await actions()).toEqual([]);
      await rpc(OWNER, "public.set_pin($1, $2)", ["111111", "246810"]);
      expect(await actions()).toEqual(["pin_set"]);
      await db.query("DELETE FROM private.user_pins WHERE user_id = $1", [OWNER]);
    });

    it("does not report the legacy bcrypt upgrade as a PIN change", async () => {
      const { rows } = await db.query<{ id: string }>("SELECT id FROM public.families WHERE owner_id = $1", [LEGACY]);
      await rpc(LEGACY, "public.verify_pin($1)", ["135790"]);
      expect(await actions(rows[0].id)).toEqual([]);
    });
  });

  describe("reported views and downloads", () => {
    const report = (user: string, action: string, id = documentId, claims = {}) =>
      asUser(db, user, tx => tx.query("SELECT public.record_document_access($1, $2)", [id, action]), claims);

    it("labels them as client-reported", async () => {
      await report(OWNER, "document_viewed");
      await report(OWNER, "document_downloaded");
      expect(await events()).toMatchObject([
        { action: "document_viewed", source: "client", actor_id: OWNER, target_name: expect.any(String) },
        { action: "document_downloaded", source: "client" },
      ]);
    });

    it("refuses another family's document without revealing it exists", async () => {
      await expect(report(OTHER, "document_viewed")).rejects.toThrow(/Document not found/);
      expect(await actions()).toEqual([]);
    });

    it("refuses any action other than a view or download", async () => {
      await expect(report(OWNER, "document_deleted")).rejects.toThrow(/Unknown document action/);
    });

    it("refuses anonymous callers", async () => {
      await expect(asAnon(db, tx => tx.query("SELECT public.record_document_access($1, 'document_viewed')", [documentId]))).rejects.toThrow(/permission denied/);
    });
  });

  describe("protection of the log", () => {
    beforeEach(async () => {
      await asUser(db, OWNER, tx => tx.query("SELECT public.record_document_access($1, 'document_viewed')", [documentId]));
    });

    it("lets the owner read their family's events", async () => {
      const { rows } = await asUser(db, OWNER, tx => tx.query("SELECT id FROM public.audit_events"));
      expect(rows).toHaveLength(1);
    });

    it("hides events from other families and anonymous callers", async () => {
      expect((await asUser(db, OTHER, tx => tx.query("SELECT id FROM public.audit_events"))).rows).toHaveLength(0);
      await expect(asAnon(db, tx => tx.query("SELECT id FROM public.audit_events"))).rejects.toThrow(/permission denied/);
    });

    it.each([
      ["forge", "INSERT INTO public.audit_events (family_id, action) SELECT id, 'pin_set' FROM public.families"],
      ["rewrite", "UPDATE public.audit_events SET action = 'pin_set'"],
      ["erase", "DELETE FROM public.audit_events"],
      ["truncate", "TRUNCATE public.audit_events"],
    ])("refuses an owner's attempt to %s events", async (_name, sql) => {
      await expect(asUser(db, OWNER, tx => tx.query(sql))).rejects.toThrow(/permission denied/);
      expect(await actions()).toEqual(["document_viewed"]);
    });

    it("keeps internal helpers out of reach", async () => {
      await expect(
        asUser(db, OWNER, tx => tx.query("SELECT private.record_event($1, 'pin_set', NULL, NULL)", [family])),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("MFA", () => {
    it("applies to the log and to access reports", async () => {
      const mfaFamily = await createUser(db, MFA_USER);
      const id = await asUser(db, MFA_USER, tx => addDocument(tx, MFA_USER, mfaFamily));
      await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [MFA_USER]);

      const passwordOnly = { aal: "aal1" };
      const { rows } = await asUser(db, MFA_USER, tx => tx.query("SELECT id FROM public.audit_events"), passwordOnly);
      expect(rows).toHaveLength(0);
      await expect(
        asUser(db, MFA_USER, tx => tx.query("SELECT public.record_document_access($1, 'document_viewed')", [id]), passwordOnly),
      ).rejects.toThrow(/Document not found/);

      const verified = await asUser(db, MFA_USER, tx => tx.query("SELECT id FROM public.audit_events"), { aal: "aal2" });
      expect(verified.rows.length).toBeGreaterThan(0);
    });
  });

  describe("account deletion", () => {
    it("is not blocked by the log, and removes the family's events", async () => {
      const leavingFamily = await createUser(db, LEAVING);
      await asUser(db, LEAVING, async tx => {
        await addDocument(tx, LEAVING, leavingFamily);
        await tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha')", [leavingFamily, LEAVING]);
        await tx.query("SELECT public.set_pin('246810')");
      });
      expect((await events(leavingFamily)).length).toBeGreaterThan(0);

      await db.query("DELETE FROM auth.users WHERE id = $1", [LEAVING]);

      expect(await events(leavingFamily)).toEqual([]);
      const { rows } = await db.query("SELECT 1 FROM public.families WHERE id = $1", [leavingFamily]);
      expect(rows).toHaveLength(0);
    });
  });

});
