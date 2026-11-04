# EverNest — Implementation Tasks

**Provenance:** the original tracker and `PHASE_WISE_ROADMAP_AND_OPS.md` were not available when this file was created. Only `TASK-0.1` comes from the master context. Every `SEC-*` task is reconstructed from the 2026-11-04 audit. If the original documents turn up, reconcile this file against them.

## Before anything else: release the security fixes

The fixes below are in the repository but **not pushed or applied**. Users are unprotected until these steps are done.

1. Check the live database for signs of the storage exploit (see below).
2. Configure Supabase Auth (`supabase config push`, or the dashboard):
   - Add `<your site URL>/reset-password` to the allowed redirect URLs, or reset emails will send people to the wrong page.
   - Set minimum password length to 10, requiring letters and digits, as in `supabase/config.toml`.
   - Confirm TOTP MFA is enabled.
3. Apply all three migrations in order: `20261104120000_security_hardening.sql`, `20261104130000_require_mfa_when_enrolled.sql`, then `20261104140000_audit_log.sql`.
4. Deploy the client at the same time. The first migration drops the PIN columns, so older clients stop showing the PIN lock, and new clients show an error screen until it is applied. Pushing to `main` may deploy through Lovable, so treat the push as the deploy.
5. In the deployed app, test upload, preview, PIN set, wrong PIN, Forgot PIN, forgot password, MFA on, sign-in with a code, MFA off, and the Settings Activity tab. Check the browser console for Content-Security-Policy errors throughout, and confirm a PDF preview displays in Chrome, Safari, and Firefox, and that the PWA still installs.

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
| SEC-5 | Password reset, stronger password policy, MFA (TOTP) enforced in RLS | Done in repo, not released |
| SEC-6 | Append-only audit log and Settings Activity tab. Not yet logged: sign-ins, password changes, MFA changes | Done in repo, not released |
| SEC-12 | Server-verified document reads, through an Edge Function issuing signed URLs (ADR-007) | Open |
| SEC-11 | MFA recovery for lost devices (recovery codes or a support process) | Open, needed before MFA is promoted to users |
| SEC-7 | Content-Security-Policy and referrer policy in the built HTML | Done in repo, not released |
| SEC-13 | Host response headers that a meta tag cannot set (see below) | Blocked on hosting choice |
| SEC-14 | Self-host fonts, removing Google Fonts from the policy and from users' page loads | Open |
| SEC-8 | Correct landing page claims (F-4) | Blocked on owner decision |
| SEC-9 | Data export and account deletion (advertised; required for DPDP) | Open, next |
| SEC-10 | Decide and build the document encryption model (ADR-002) | Blocked on owner decision |
| QA-1 | Clear remaining lint errors (27) and enable TypeScript `strict` | Open |

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

Family invites and roles, billing, OCR and extraction, hybrid search, the grounded assistant, and the MCP server all need the original requirements documents. Family roles will require revisiting the `user_id` checks in the RLS policies. AI work should wait for ADR-002.

## Verification notes

- Database tests run real Postgres (PGlite) with a stub of Supabase's `auth` and `storage` schemas and default privileges. They do not cover Supabase's Storage API or Auth service.
- `reset_pin_after_login` relies on the JWT `amr` claim. Its format is assumed from Supabase documentation, so confirm Forgot PIN in a real project.
- `mfa_satisfied` reads `auth.mfa_factors` as the function owner. The test stub cannot prove that owner has access on hosted Supabase, so confirm MFA end to end in a real project. If it lacks access, every RLS check on the protected tables fails with an error.
- The Content-Security-Policy was tested on the production build in the desktop app's browser pane: inline scripts, inline handlers, `eval`, external scripts, and sending data to other hosts were all blocked, while the auth page, QR-style `data:` images, and `blob:` images worked. PDF previews raised no violation, but whether they display could not be confirmed. Service worker registration fails in that pane with or without the policy, so it is untested too.
- MFA, password reset, and the Settings screens, including Activity, were tested with mocked Supabase. In a browser, only the `/auth` modes and the invalid-link state of `/reset-password` were checked.
