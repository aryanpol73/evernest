# EverNest — Current State Audit

**Audited:** 2026-11-04, against `main` at `01477d0` (TASK-0.1).
**Method:** static review of `src/`, `supabase/`, and config, plus local build, test, lint, and `npm audit` runs. The live Supabase project was not accessed, so everything below describes the repository, not the deployed database.

## Baseline verification

| Check | Result |
|---|---|
| `npm ci` | **Fails**: `package-lock.json` is out of sync with `package.json` |
| `npm install --no-package-lock` | Passes (used for this baseline) |
| `npm run build` | Passes |
| `tsc -p tsconfig.app.json --noEmit` | Passes, with `strict: false` |
| `npm run test` | Passes, but the only test is a placeholder |
| `npm run lint` | **Fails**: 29 errors, 9 warnings |
| `npm audit --omit=dev` | 34 vulnerabilities (19 high, 12 moderate, 3 low) |

## Documentation gap

The master context indexes nine documents under `docs/`. None were in the repository or on the development machine at audit time. Only the master context itself exists. As a result:

- Only `TASK-0.1` is a documented task. Later task IDs are reconstructed (see `IMPLEMENTATION_TASKS.md`).
- Requirements for AI, MCP, and roles are known only at the summary level in the master context.

## Feature status

| Area | Status | Notes |
|---|---|---|
| Email and password auth | Partial | No MFA; 6-character minimum password; no password reset route |
| Family and member records | Partial | One owner per family; no invites or roles |
| Document upload and download | Partial | Private bucket; no client-side encryption |
| Reminders, emergency page, family tree | Partial | Client-side views over existing tables |
| PWA | Present | Precaches build assets only; no runtime caching of API data |
| Audit log | Missing | |
| Data export and account deletion | Missing | Export is advertised on the landing page |
| Billing | Missing | ₹299 plan is advertised on the landing page |
| AI, OCR, search, MCP, worker | Missing | No backend beyond Supabase |

## Security findings

| ID | Severity | Finding | Status |
|---|---|---|---|
| F-0 | **Critical** | Storage policies used `foldername(name)` inside a subquery on `families`, so `name` bound to `families.name`. Legitimate uploads were refused, and any user could read and delete every family's files by renaming their family to `<their family id>/x`. Reproduced locally against the original migrations | Fixed in repo by SEC-0 |
| F-1 | High | PIN hash, salt, attempt counter, and lockout were client-readable and client-writable. Offline brute force of a 6-digit PIN and lockout reset were both possible with a stolen session | Fixed in repo by SEC-2 |
| F-2 | High | Previews rendered uploaded content in an unsandboxed same-origin iframe, so an HTML or SVG file could run script and read the session token | Fixed in repo by SEC-3 |
| F-3 | High | `documents` RLS checked `user_id` only, so rows could reference another family or another family's member | Fixed in repo by SEC-1 |
| F-4 | High | Landing page claims are not supported by the code: "AES-256… unreadable to anyone but you", "GDPR Compliant", "Stored on AWS", "Export… anytime" | **Open, needs owner decision** |
| F-5 | High | No MFA; 6-character passwords; "Forgot password" flow missing | Open (SEC-5) |
| F-6 | Medium | Allowed file types were enforced only by the browser file picker | Fixed in repo by SEC-1 and SEC-3 |
| F-7 | Medium | "Forgot PIN" linked to a `/reset-password` route that does not exist | Fixed in repo by SEC-2 |
| F-8 | Medium | Session token is stored in `localStorage`, so the PIN lock is a device convenience and not a data boundary | Open, documented in ADR-003 |
| F-9 | Medium | No audit log of document access | Open (SEC-6) |
| F-10 | Medium | No Content-Security-Policy | Open (SEC-7) |
| F-11 | Medium | 19 high-severity dependency advisories; `package-lock.json` drift (drift fixed, advisories remain) | Open (SEC-4) |
| F-12 | Low | `.env` is committed to a public repo. It holds only the public `anon` key, so this is not a leak, but RLS is the only barrier to data | Accepted; kept because Lovable may rely on it |

"Fixed in repo" means the change exists in the working tree. It protects users only after the migration is applied and the client is deployed.
