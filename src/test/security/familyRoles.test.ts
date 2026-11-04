// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { applyMigrations, asAnon, asUser, createDatabase, createUser, migrationFiles } from "./supabaseHarness";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const OWNER = id(1);
const EDITOR = id(2);
const VIEWER = id(3);
const STRANGER = id(4);

const freshLogin = () => ({ aal: "aal1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] });

describe("family roles", () => {
  let db: PGlite;
  let family: string;
  let strangerFamily: string;
  let documentId: string;
  let memberId: string;
  let nextUser = 100;

  const emailOf = (user: string) => `${user}@example.com`;

  const invite = (owner: string, familyId: string, email: string, role: string) =>
    asUser(db, owner, async tx => {
      const { rows } = await tx.query<{ token: string }>("SELECT public.create_family_invite($1, $2, $3) AS token", [familyId, email, role]);
      return rows[0].token;
    });

  const accept = (user: string, token: string, claims: Record<string, unknown> = {}) =>
    asUser(db, user, tx => tx.query("SELECT public.accept_family_invite($1)", [token]), claims);

  const join = async (user: string, role: string, familyId = family, owner = OWNER) => {
    await accept(user, await invite(owner, familyId, emailOf(user), role));
  };

  const newUser = async (role?: string) => {
    const user = id(nextUser++);
    await createUser(db, user);
    if (role) await join(user, role);
    return user;
  };

  const roleOf = async (user: string, familyId = family) =>
    (await db.query<{ role: string }>("SELECT role FROM public.family_memberships WHERE family_id = $1 AND user_id = $2", [familyId, user])).rows[0]?.role;

  const addDocument = (tx: Transaction, user: string, name: string) =>
    tx.query<{ id: string }>(
      "INSERT INTO public.documents (family_id, user_id, name, file_path) VALUES ($1, $2, $3, $4) RETURNING id",
      [family, user, name, `${family}/general/${name}.pdf`],
    );

  const upload = (tx: Transaction, name: string) =>
    tx.query("INSERT INTO storage.objects (bucket_id, name) VALUES ('family-documents', $1)", [`${family}/general/${name}.pdf`]);

  beforeAll(async () => {
    db = await createDatabase();
    await applyMigrations(db, migrationFiles());

    family = await createUser(db, OWNER);
    await createUser(db, EDITOR);
    await createUser(db, VIEWER);
    strangerFamily = await createUser(db, STRANGER);

    await asUser(db, OWNER, async tx => {
      documentId = (await addDocument(tx, OWNER, "Passport")).rows[0].id;
      await upload(tx, "Passport");
      const { rows } = await tx.query<{ id: string }>(
        "INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Asha') RETURNING id",
        [family, OWNER],
      );
      memberId = rows[0].id;
    });

    await join(EDITOR, "editor");
    await join(VIEWER, "viewer");
  }, 60_000);

  describe("existing families", () => {
    it("gives every family's owner an owner role", async () => {
      expect(await roleOf(OWNER)).toBe("owner");
      expect(await roleOf(STRANGER, strangerFamily)).toBe("owner");
    });

    it("backfills owners of families created before this migration", async () => {
      const old = await createDatabase();
      const files = migrationFiles();
      const roles = files.indexOf("20261104160000_family_roles.sql");
      await applyMigrations(old, files.slice(0, roles));
      const oldFamily = await createUser(old, OWNER);
      await applyMigrations(old, files.slice(roles));
      const { rows } = await old.query<{ role: string }>("SELECT role FROM public.family_memberships WHERE family_id = $1", [oldFamily]);
      expect(rows).toEqual([{ role: "owner" }]);
    }, 60_000);
  });

  describe("viewer", () => {
    it("can read documents, members, the family, and files", async () => {
      await asUser(db, VIEWER, async tx => {
        expect((await tx.query("SELECT 1 FROM public.documents WHERE family_id = $1", [family])).rows).toHaveLength(1);
        expect((await tx.query("SELECT 1 FROM public.family_members WHERE family_id = $1", [family])).rows).toHaveLength(1);
        expect((await tx.query("SELECT 1 FROM public.families WHERE id = $1", [family])).rows).toHaveLength(1);
        expect((await tx.query("SELECT 1 FROM storage.objects WHERE name LIKE $1", [`${family}/%`])).rows).toHaveLength(1);
      });
    });

    it("cannot add documents, members, or files", async () => {
      await expect(asUser(db, VIEWER, tx => addDocument(tx, VIEWER, "Nope"))).rejects.toThrow(/row-level security/);
      await expect(asUser(db, VIEWER, tx => upload(tx, "Nope"))).rejects.toThrow(/row-level security/);
      await expect(
        asUser(db, VIEWER, tx => tx.query("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'X')", [family, VIEWER])),
      ).rejects.toThrow(/row-level security/);
    });

    it("cannot change or delete anything", async () => {
      await asUser(db, VIEWER, async tx => {
        expect((await tx.query("UPDATE public.documents SET name = 'x' WHERE id = $1", [documentId])).affectedRows).toBe(0);
        expect((await tx.query("DELETE FROM public.documents WHERE id = $1", [documentId])).affectedRows).toBe(0);
        expect((await tx.query("UPDATE public.family_members SET name = 'x' WHERE id = $1", [memberId])).affectedRows).toBe(0);
        expect((await tx.query("DELETE FROM public.family_members WHERE id = $1", [memberId])).affectedRows).toBe(0);
        expect((await tx.query("DELETE FROM storage.objects WHERE name LIKE $1", [`${family}/%`])).affectedRows).toBe(0);
        expect((await tx.query("UPDATE public.families SET name = 'x' WHERE id = $1", [family])).affectedRows).toBe(0);
      });
    });

    it("has their views recorded for the owner", async () => {
      await asUser(db, VIEWER, tx => tx.query("SELECT public.record_document_access($1, 'document_viewed')", [documentId]));
      const { rows } = await asUser(db, OWNER, tx =>
        tx.query<{ actor_id: string }>("SELECT actor_id FROM public.audit_events WHERE action = 'document_viewed' AND family_id = $1", [family]),
      );
      expect(rows.map(r => r.actor_id)).toContain(VIEWER);
    });
  });

  describe("editor", () => {
    it("can add, change, and delete records and files", async () => {
      await asUser(db, EDITOR, async tx => {
        const doc = (await addDocument(tx, EDITOR, "Insurance")).rows[0].id;
        await upload(tx, "Insurance");
        expect((await tx.query("UPDATE public.documents SET name = 'Renamed' WHERE id = $1", [doc])).affectedRows).toBe(1);
        expect((await tx.query("UPDATE public.family_members SET phone = '123' WHERE id = $1", [memberId])).affectedRows).toBe(1);
        expect((await tx.query("DELETE FROM storage.objects WHERE name = $1", [`${family}/general/Insurance.pdf`])).affectedRows).toBe(1);
        expect((await tx.query("DELETE FROM public.documents WHERE id = $1", [doc])).affectedRows).toBe(1);
      });
    });

    it("cannot rename or delete the family", async () => {
      await asUser(db, EDITOR, async tx => {
        expect((await tx.query("UPDATE public.families SET name = 'x' WHERE id = $1", [family])).affectedRows).toBe(0);
        expect((await tx.query("DELETE FROM public.families WHERE id = $1", [family])).affectedRows).toBe(0);
      });
    });

    it("cannot read the audit log or invites", async () => {
      await asUser(db, EDITOR, async tx => {
        expect((await tx.query("SELECT 1 FROM public.audit_events WHERE family_id = $1", [family])).rows).toHaveLength(0);
        expect((await tx.query("SELECT id FROM public.family_invites WHERE family_id = $1", [family])).rows).toHaveLength(0);
      });
    });

    it("cannot take over a record's creator", async () => {
      await asUser(db, EDITOR, tx => tx.query("UPDATE public.documents SET user_id = $1 WHERE id = $2", [EDITOR, documentId]));
      const { rows } = await db.query<{ user_id: string }>("SELECT user_id FROM public.documents WHERE id = $1", [documentId]);
      expect(rows[0].user_id).toBe(OWNER);
    });

    it("cannot move a record into a family they own", async () => {
      const editorFamily = (await db.query<{ id: string }>("SELECT id FROM public.families WHERE owner_id = $1", [EDITOR])).rows[0].id;
      await asUser(db, EDITOR, tx => tx.query("UPDATE public.family_members SET family_id = $1 WHERE id = $2", [editorFamily, memberId]));
      const { rows } = await db.query<{ family_id: string }>("SELECT family_id FROM public.family_members WHERE id = $1", [memberId]);
      expect(rows[0].family_id).toBe(family);
    });

    it("cannot attribute a new record to someone else", async () => {
      await expect(asUser(db, EDITOR, tx => addDocument(tx, OWNER, "Forged"))).rejects.toThrow(/row-level security/);
    });
  });

  describe("people outside the family", () => {
    it("see nothing", async () => {
      await asUser(db, STRANGER, async tx => {
        for (const sql of [
          "SELECT 1 FROM public.documents WHERE family_id = $1",
          "SELECT 1 FROM public.family_members WHERE family_id = $1",
          "SELECT 1 FROM public.families WHERE id = $1",
          "SELECT 1 FROM public.family_memberships WHERE family_id = $1",
        ]) {
          expect((await tx.query(sql, [family])).rows).toHaveLength(0);
        }
        expect((await tx.query("SELECT 1 FROM storage.objects WHERE name LIKE $1", [`${family}/%`])).rows).toHaveLength(0);
      });
      await expect(asUser(db, STRANGER, tx => tx.query("SELECT * FROM public.list_family_access($1)", [family]))).rejects.toThrow(/Family not found/);
    });

    it("are refused anonymously", async () => {
      await expect(asAnon(db, tx => tx.query("SELECT 1 FROM public.family_memberships"))).rejects.toThrow(/permission denied/);
      await expect(asAnon(db, tx => tx.query("SELECT public.accept_family_invite('x')"))).rejects.toThrow(/permission denied/);
    });
  });

  describe("role escalation", () => {
    it.each([
      ["promote themselves", (tx: Transaction) => tx.query("UPDATE public.family_memberships SET role = 'owner'")],
      ["add themselves", (tx: Transaction, f: string) => tx.query("INSERT INTO public.family_memberships (family_id, user_id, role) VALUES ($1, $2, 'owner')", [f, VIEWER])],
      ["remove the owner", (tx: Transaction) => tx.query("DELETE FROM public.family_memberships")],
    ])("cannot %s by writing to the table", async (_name, attack) => {
      await expect(asUser(db, VIEWER, tx => attack(tx, family))).rejects.toThrow(/permission denied/);
      expect(await roleOf(VIEWER)).toBe("viewer");
      expect(await roleOf(OWNER)).toBe("owner");
    });

    it.each([
      ["an editor", EDITOR],
      ["a viewer", VIEWER],
      ["a stranger", STRANGER],
    ])("%s cannot invite, change roles, or remove people", async (_name, user) => {
      const attempts = [
        ["SELECT public.create_family_invite($1, 'x@example.com', 'editor')", [family]],
        ["SELECT public.set_family_role($1, $2, 'editor')", [family, VIEWER]],
        ["SELECT public.remove_family_access($1, $2)", [family, OWNER]],
      ] as const;
      for (const [sql, params] of attempts) {
        await expect(asUser(db, user, tx => tx.query(sql, [...params]))).rejects.toThrow(/Only the family owner/);
      }
      expect(await roleOf(VIEWER)).toBe("viewer");
    });

    it("cannot make anyone a second owner", async () => {
      await expect(asUser(db, OWNER, tx => tx.query("SELECT public.set_family_role($1, $2, 'owner')", [family, EDITOR]))).rejects.toThrow(/editor or viewer/);
      await expect(invite(OWNER, family, "new@example.com", "owner")).rejects.toThrow(/editor or viewer/);
    });

    it("cannot demote or remove the owner", async () => {
      await expect(asUser(db, OWNER, tx => tx.query("SELECT public.set_family_role($1, $2, 'viewer')", [family, OWNER]))).rejects.toThrow(/cannot be changed/);
      await expect(asUser(db, OWNER, tx => tx.query("SELECT public.remove_family_access($1, $2)", [family, OWNER]))).rejects.toThrow(/cannot be removed/);
      expect(await roleOf(OWNER)).toBe("owner");
    });

    it("cannot transfer the family by changing owner_id", async () => {
      await expect(
        asUser(db, OWNER, tx => tx.query("UPDATE public.families SET owner_id = $1 WHERE id = $2", [EDITOR, family])),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe("invites", () => {
    const INVALID = /not valid for this account/;

    it("stores only a hash of the token, which even the owner cannot read", async () => {
      const email = `hash-${nextUser}@example.com`;
      const token = await invite(OWNER, family, email, "viewer");
      expect(token).toMatch(/^[0-9a-f]{64}$/);
      const { rows } = await db.query<{ token_hash: string }>("SELECT token_hash FROM public.family_invites WHERE email = $1", [email]);
      expect(rows[0].token_hash).not.toBe(token);
      await expect(asUser(db, OWNER, tx => tx.query("SELECT token_hash FROM public.family_invites"))).rejects.toThrow(/permission denied/);
    });

    it("does not work for anyone but the invited address", async () => {
      const invited = await newUser();
      const token = await invite(OWNER, family, emailOf(invited), "editor");
      await expect(accept(STRANGER, token)).rejects.toThrow(INVALID);
      await expect(asUser(db, STRANGER, tx => tx.query("SELECT public.preview_family_invite($1)", [token]))).rejects.toThrow(INVALID);
      expect(await roleOf(STRANGER)).toBeUndefined();
      await accept(invited, token);
      expect(await roleOf(invited)).toBe("editor");
    });

    it("ignores letter case in the address", async () => {
      const invited = await newUser();
      await accept(invited, await invite(OWNER, family, emailOf(invited).toUpperCase(), "viewer"));
      expect(await roleOf(invited)).toBe("viewer");
    });

    it("needs a confirmed address, so a signup can't claim someone else's email", async () => {
      const impostor = id(nextUser++);
      await createUser(db, impostor, "victim@example.com", false);
      await expect(accept(impostor, await invite(OWNER, family, "victim@example.com", "editor"))).rejects.toThrow(INVALID);
    });

    it("works only once", async () => {
      const invited = await newUser();
      const token = await invite(OWNER, family, emailOf(invited), "viewer");
      await accept(invited, token);
      await expect(accept(invited, token)).rejects.toThrow(INVALID);
    });

    it("expires", async () => {
      const invited = await newUser();
      const token = await invite(OWNER, family, emailOf(invited), "viewer");
      await db.query("UPDATE public.family_invites SET expires_at = now() - interval '1 minute' WHERE email = $1", [emailOf(invited)]);
      await expect(accept(invited, token)).rejects.toThrow(INVALID);
    });

    it("can be revoked, and only by the owner", async () => {
      const invited = await newUser();
      const token = await invite(OWNER, family, emailOf(invited), "viewer");
      const { rows } = await asUser(db, OWNER, tx => tx.query<{ id: string }>("SELECT id FROM public.family_invites WHERE email = $1", [emailOf(invited)]));
      await expect(asUser(db, EDITOR, tx => tx.query("SELECT public.revoke_family_invite($1)", [rows[0].id]))).rejects.toThrow(/Only the family owner/);
      await asUser(db, OWNER, tx => tx.query("SELECT public.revoke_family_invite($1)", [rows[0].id]));
      await expect(accept(invited, token)).rejects.toThrow(INVALID);
    });

    it("is replaced by a newer invite to the same address", async () => {
      const invited = await newUser();
      const first = await invite(OWNER, family, emailOf(invited), "editor");
      const second = await invite(OWNER, family, emailOf(invited), "viewer");
      await expect(accept(invited, first)).rejects.toThrow(INVALID);
      await accept(invited, second);
      expect(await roleOf(invited)).toBe("viewer");
    });

    it("gives the same error for a made-up token", async () => {
      await expect(accept(STRANGER, "f".repeat(64))).rejects.toThrow(INVALID);
    });

    it("refuses someone already in the family, and bad addresses", async () => {
      await expect(invite(OWNER, family, emailOf(EDITOR), "viewer")).rejects.toThrow(/already in this family/);
      await expect(invite(OWNER, family, "not-an-email", "viewer")).rejects.toThrow(/valid email/);
    });

    it("limits how many can be pending", async () => {
      const owner = id(nextUser++);
      const busyFamily = await createUser(db, owner);
      for (let i = 0; i < 20; i++) await invite(owner, busyFamily, `bulk${i}@example.com`, "viewer");
      await expect(invite(owner, busyFamily, "one-more@example.com", "viewer")).rejects.toThrow(/Too many pending/);
    });

    it("shows the invitee the family and role before they accept", async () => {
      const invited = await newUser();
      const token = await invite(OWNER, family, emailOf(invited), "editor");
      const { rows } = await asUser(db, invited, tx => tx.query<{ preview: object }>("SELECT public.preview_family_invite($1) AS preview", [token]));
      expect(rows[0].preview).toEqual({ family_name: expect.any(String), role: "editor" });
      expect(await roleOf(invited)).toBeUndefined();
    });
  });

  describe("managing access", () => {
    it("lets anyone in the family see who has access", async () => {
      const { rows } = await asUser(db, VIEWER, tx =>
        tx.query<{ user_id: string; role: string }>("SELECT user_id, role FROM public.list_family_access($1)", [family]),
      );
      expect(rows).toEqual(expect.arrayContaining([{ user_id: OWNER, role: "owner" }, { user_id: VIEWER, role: "viewer" }]));
    });

    it("applies a role change straight away", async () => {
      const person = await newUser("editor");
      await asUser(db, OWNER, tx => tx.query("SELECT public.set_family_role($1, $2, 'viewer')", [family, person]));
      await expect(asUser(db, person, tx => addDocument(tx, person, "Late"))).rejects.toThrow(/row-level security/);
    });

    it("ends all access when someone is removed", async () => {
      const person = await newUser("editor");
      await asUser(db, OWNER, tx => tx.query("SELECT public.remove_family_access($1, $2)", [family, person]));
      await asUser(db, person, async tx => {
        expect((await tx.query("SELECT 1 FROM public.documents WHERE family_id = $1", [family])).rows).toHaveLength(0);
        expect((await tx.query("SELECT 1 FROM storage.objects WHERE name LIKE $1", [`${family}/%`])).rows).toHaveLength(0);
      });
    });

    it("lets a member leave, but not remove others", async () => {
      const person = await newUser("viewer");
      await expect(asUser(db, person, tx => tx.query("SELECT public.remove_family_access($1, $2)", [family, EDITOR]))).rejects.toThrow(/Only the family owner/);
      await asUser(db, person, tx => tx.query("SELECT public.remove_family_access($1, $2)", [family, person]));
      expect(await roleOf(person)).toBeUndefined();
    });

    it("records access changes for the owner", async () => {
      const person = await newUser("viewer");
      await asUser(db, OWNER, async tx => {
        await tx.query("SELECT public.set_family_role($1, $2, 'editor')", [family, person]);
        await tx.query("SELECT public.remove_family_access($1, $2)", [family, person]);
      });
      const { rows } = await db.query<{ action: string }>(
        "SELECT action FROM public.audit_events WHERE family_id = $1 AND (target_id = $2 OR target_name = $3) ORDER BY id",
        [family, person, emailOf(person)],
      );
      expect(rows.map(r => r.action)).toEqual(["invite_created", "access_granted", "access_changed", "access_removed"]);
    });
  });

  describe("MFA", () => {
    it("protects shared data, invites, and access management", async () => {
      const person = await newUser("editor");
      const token = await invite(OWNER, family, "mfa-later@example.com", "viewer");
      await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [person]);
      await db.query("UPDATE auth.users SET email = 'mfa-later@example.com' WHERE id = $1", [person]);
      const passwordOnly = { aal: "aal1" };

      await asUser(db, person, async tx => {
        expect((await tx.query("SELECT 1 FROM public.documents WHERE family_id = $1", [family])).rows).toHaveLength(0);
        expect((await tx.query("SELECT 1 FROM public.family_memberships")).rows).toHaveLength(0);
      }, passwordOnly);
      await expect(accept(person, token, passwordOnly)).rejects.toThrow(/not valid/);
      await expect(asUser(db, person, tx => tx.query("SELECT * FROM public.list_family_access($1)", [family]), passwordOnly)).rejects.toThrow(/Family not found/);
      await expect(asUser(db, person, tx => tx.query("SELECT public.remove_family_access($1, $2)", [family, person]), passwordOnly)).rejects.toThrow(/Only the family owner/);

      const { rows } = await asUser(db, person, tx => tx.query("SELECT 1 FROM public.documents WHERE family_id = $1", [family]), { aal: "aal2" });
      expect(rows.length).toBeGreaterThan(0);
    });

    it("applies to an owner's invite and role actions", async () => {
      const owner = id(nextUser++);
      const ownFamily = await createUser(db, owner);
      await db.query("INSERT INTO auth.mfa_factors (user_id, status) VALUES ($1, 'verified')", [owner]);
      await expect(
        asUser(db, owner, tx => tx.query("SELECT public.create_family_invite($1, 'x@example.com', 'viewer')", [ownFamily]), { aal: "aal1" }),
      ).rejects.toThrow(/Only the family owner/);
    });
  });

  describe("account deletion in a shared family", () => {
    const deleteAccount = (user: string) => asUser(db, user, tx => tx.query("SELECT public.delete_my_account()"), freshLogin());

    it("never lists another family's files for removal", async () => {
      const person = await newUser("editor");
      const { rows } = await asUser(db, person, tx => tx.query<{ path: string }>("SELECT public.list_my_storage_paths() AS path"));
      expect(rows.filter(r => r.path.startsWith(family))).toEqual([]);
    });

    it("keeps what an editor added to the family when they leave for good", async () => {
      const person = await newUser("editor");
      const { doc, member } = await asUser(db, person, async tx => {
        const doc = (await addDocument(tx, person, "Kept")).rows[0].id;
        const { rows } = await tx.query<{ id: string }>("INSERT INTO public.family_members (family_id, user_id, name) VALUES ($1, $2, 'Kept') RETURNING id", [family, person]);
        return { doc, member: rows[0].id };
      });

      await deleteAccount(person);

      expect(await roleOf(person)).toBeUndefined();
      const docs = await db.query<{ user_id: string | null }>("SELECT user_id FROM public.documents WHERE id = $1", [doc]);
      const members = await db.query<{ user_id: string | null }>("SELECT user_id FROM public.family_members WHERE id = $1", [member]);
      expect(docs.rows).toEqual([{ user_id: null }]);
      expect(members.rows).toEqual([{ user_id: null }]);
    });

    it("is not blocked by files in a family the user only joined", async () => {
      const person = await newUser("viewer");
      await deleteAccount(person);
      expect((await db.query("SELECT 1 FROM auth.users WHERE id = $1", [person])).rows).toHaveLength(0);
      expect((await db.query("SELECT 1 FROM storage.objects WHERE name LIKE $1", [`${family}/%`])).rows.length).toBeGreaterThan(0);
    });

    it("removes the family for everyone when its owner leaves, without deleting them", async () => {
      const owner = id(nextUser++);
      const ownFamily = await createUser(db, owner);
      const member = await newUser();
      await join(member, "editor", ownFamily, owner);

      await deleteAccount(owner);

      expect((await db.query("SELECT 1 FROM public.families WHERE id = $1", [ownFamily])).rows).toHaveLength(0);
      expect((await db.query("SELECT 1 FROM auth.users WHERE id = $1", [member])).rows).toHaveLength(1);
    });
  });
});
