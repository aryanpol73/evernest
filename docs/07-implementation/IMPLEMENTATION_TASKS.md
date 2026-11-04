# EverNest — Implementation Tasks

**Provenance:** the original tracker and `PHASE_WISE_ROADMAP_AND_OPS.md` were not available when this file was created. Only `TASK-0.1` comes from the master context. Every `SEC-*` task is reconstructed from the 2026-11-04 audit. If the original documents turn up, reconcile this file against them.

## Before anything else: release the security fixes

The fixes below are in the repository but **not pushed or applied**. Users are unprotected until these steps are done.

1. Check the live database for signs of the storage exploit (see below).
2. Configure Supabase Auth (`supabase config push`, or the dashboard):
   - Add `<your site URL>/reset-password` to the allowed redirect URLs, or reset emails will send people to the wrong page.
   - Set minimum password length to 10, requiring letters and digits, as in `supabase/config.toml`.
   - Confirm TOTP MFA is enabled.
3. Apply all six migrations in order: `20261104120000_security_hardening.sql`, `20261104130000_require_mfa_when_enrolled.sql`, `20261104140000_audit_log.sql`, `20261104150000_account_deletion.sql`, `20261104160000_family_roles.sql`, then `20261104170000_mfa_recovery.sql`.
4. Deploy the client at the same time. The first migration drops the PIN columns, so older clients stop showing the PIN lock, and new clients show an error screen until it is applied. Pushing to `main` may deploy through Lovable, so treat the push as the deploy.
5. In the deployed app, test upload, preview, PIN set, wrong PIN, Forgot PIN, forgot password, MFA on, sign-in with a code, recovering with a recovery code, MFA off, the Settings Activity tab, a data export, deleting a throwaway account, and the whole invite flow with a second real account: invite as viewer, accept, confirm the viewer can read but not change anything, change them to editor, then remove them. Check the browser console for Content-Security-Policy errors throughout, and confirm a PDF preview displays in Chrome, Safari, and Firefox, and that the PWA still installs.

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
| SEC-4 | Dependency advisories: `npm audit --omit=dev` reports 0. React Router is on v7, and unused `zod` and `@hookform/resolvers` are removed. `bun.lock` and `bun.lockb` are stale, so confirm how the host installs before deleting them | Done in repo, not released |
| SEC-5 | Password reset, stronger password policy, MFA (TOTP) enforced in RLS | Done in repo, not released |
| SEC-6 | Append-only audit log and Settings Activity tab. Not yet logged: sign-ins, password changes, MFA changes | Done in repo, not released |
| SEC-12 | Server-verified document reads, through an Edge Function issuing signed URLs (ADR-007) | Open |
| SEC-11 | MFA recovery codes for lost devices | Done in repo, not released |
| SEC-7 | Content-Security-Policy and referrer policy in the built HTML | Done in repo, not released |
| SEC-13 | Host response headers that a meta tag cannot set (see below) | Blocked on hosting choice |
| SEC-14 | Self-hosted fonts. The only third party the app contacts is Supabase | Done in repo, not released |
| SEC-8 | Public claims corrected, with a regression test | Done in repo, not released |
| SEC-9 | Data export, account deletion, and 12-month audit retention | Done in repo, not released |
| SEC-10 | Decide and build the document encryption model (ADR-002) | Blocked on owner decision |
| QA-1 | Lint at 0 errors (9 warnings remain, 8 of them fast-refresh hints in UI files), TypeScript `strict` on | Done |
| FEAT-1 | Family invites with owner, editor, and viewer roles | Done in repo, not released |
| FEAT-2 | Send invite emails. Owners copy a link for now, because sending needs an email provider | Blocked on provider choice |

## Host response headers (SEC-13)

These only work as real HTTP headers, so they depend on where the app is hosted. Confirm the host can set them before launch, and move hosts if it can't:

```text
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Until `frame-ancestors` is set, the app can be framed by another site (clickjacking).

## Not yet planned in detail

| Work | What it is waiting for |
|---|---|
| Requiring MFA for members, and a family successor | Buildable, but each needs a product decision (ADR-011) |
| Server-verified reads (SEC-12) | Buildable, but needs Deno or the Supabase CLI to test an Edge Function |
| Billing | A payment provider account (such as Razorpay), plans, and tax details |
| OCR, extraction, search, assistant, MCP | ADR-002, a chosen AI provider with a data-processing agreement, and the original requirements documents |

## Verification notes

- **Open:** twice, `npm test` exited with an error and printed no summary, and the cause is unknown. It did not recur in 13 straight runs, including 4 right after changing many files. Run the suite in CI from a clean checkout before relying on it, and capture the full output if it happens again.
- Database tests run real Postgres (PGlite) with a stub of Supabase's `auth` and `storage` schemas and default privileges. They do not cover Supabase's Storage API or Auth service.
- `reset_pin_after_login` relies on the JWT `amr` claim. Its format is assumed from Supabase documentation, so confirm Forgot PIN in a real project.
- `mfa_satisfied` reads `auth.mfa_factors` as the function owner. The test stub cannot prove that owner has access on hosted Supabase, so confirm MFA end to end in a real project. If it lacks access, every RLS check on the protected tables fails with an error.
- The Content-Security-Policy was tested on the production build in the desktop app's browser pane: inline scripts, inline handlers, `eval`, external scripts, and sending data to other hosts were all blocked, while the auth page, QR-style `data:` images, and `blob:` images worked. PDF previews raised no violation, but whether they display could not be confirmed. Service worker registration fails in that pane with or without the policy, so it is untested too.
- A production build was checked in the same pane after the font and React Router changes: no third-party requests, `/dashboard` redirects to sign-in when signed out, the 404 page works, and a `ReportingObserver` found no violations on page load.
- `delete_my_account` deletes from `auth.users` as the function owner, and removes files through the Storage API first. The stub proves the logic, not that hosted Supabase grants this, so delete a throwaway account after release. Removing files is not reversible, so a failure after that step leaves a working account with missing files, and retrying finishes the job.
- `redeem_mfa_recovery_code` deletes from `auth.mfa_factors` as the function owner, so confirm recovery end to end on hosted Supabase. A person who has lost both their device and their codes still needs an operator, and that process is not defined yet.
- `usable_invite` and `list_family_access` read `auth.users` as the function owner, with the same hosted-Supabase caveat as `delete_my_account`.
- The role migration was checked by reverting each protection in turn and confirming a test fails. That is how a weak test of the record-ownership trigger was found and replaced.
- MFA, password reset, data export, invites, access management, and the Settings screens were tested with mocked Supabase. In a browser, only the `/auth` modes and the invalid-link state of `/reset-password` were checked.
