# EverNest — Implementation Tasks

**Provenance:** the original tracker and `PHASE_WISE_ROADMAP_AND_OPS.md` were not available when this file was created. Only `TASK-0.1` comes from the master context. Every `SEC-*` task is reconstructed from the 2026-11-04 audit. If the original documents turn up, reconcile this file against them.

## Before anything else: release the security fixes

The code below is complete in the working tree but **not committed, pushed, or applied**. Users are unprotected until these steps are done.

1. Check the live database for signs of the storage exploit (see below).
2. Apply `supabase/migrations/20261104120000_security_hardening.sql`.
3. Deploy the client at the same time. The migration drops the PIN columns, so older clients stop showing the PIN lock, and new clients show an error screen until the migration is applied.
4. In the deployed app, sign in and test upload, preview, PIN set, wrong PIN, and Forgot PIN.

### Exploit check for the live database

```sql
-- Family names containing a slash. These are how the storage bypass was triggered.
SELECT id, owner_id, name, updated_at FROM public.families WHERE name LIKE '%/%';

-- Cross-family rows. The migration fails if any exist.
SELECT d.id FROM public.documents d
JOIN public.family_members m ON m.id = d.member_id
WHERE m.family_id <> d.family_id;
```

Also check for a user reading or deleting objects outside their own family folder in the Storage logs. If real user data was reached, get legal advice on notification duties under India's DPDP Act before launch.

## Status

| Task | Description | Status |
|---|---|---|
| TASK-0.1 | Repository audit and baseline | Done |
| SEC-0 | Fix storage policies that exposed every family's files | Done in repo, not released |
| SEC-1 | Family isolation in RLS and constraints; bucket limits | Done in repo, not released |
| SEC-2 | Server-side PIN with bcrypt, lockout, and recovery | Done in repo, not released |
| SEC-3 | Safe previews and upload validation | Done in repo, not released |
| SEC-4 | Dependency advisories. `package-lock.json` drift is fixed, `bun.lock` is now stale | Open |
| SEC-5 | Password reset, stronger password policy, MFA (TOTP) | Open, next |
| SEC-6 | Audit log for document access and security events | Open |
| SEC-7 | Content-Security-Policy and security headers on the host | Open |
| SEC-8 | Correct landing page claims (F-4) | Blocked on owner decision |
| SEC-9 | Data export and account deletion (advertised; required for DPDP) | Open |
| SEC-10 | Decide and build the document encryption model (ADR-002) | Blocked on owner decision |
| QA-1 | Clear remaining lint errors (27) and enable TypeScript `strict` | Open |

## Not yet planned in detail

Family invites and roles, billing, OCR and extraction, hybrid search, the grounded assistant, and the MCP server all need the original requirements documents. Family roles will require revisiting the `user_id` checks in the RLS policies. AI work should wait for ADR-002.

## Verification notes

- Database tests run real Postgres (PGlite) with a stub of Supabase's `auth` and `storage` schemas and default privileges. They do not cover Supabase's Storage API or Auth service.
- `reset_pin_after_login` relies on the JWT `amr` claim. Its format is assumed from Supabase documentation, so confirm Forgot PIN in a real project.
