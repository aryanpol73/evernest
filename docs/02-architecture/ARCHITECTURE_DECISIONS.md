# EverNest — Architecture Decisions

The original ADR log was not available when this file was created. Entries start from the 2026-11-04 security work.

## ADR-001: PIN secrets live in a schema the API cannot reach

**Status:** Accepted

PIN hashes moved from `public.user_settings` to `private.user_pins`, reachable only through `SECURITY DEFINER` functions. Hashes use bcrypt, and the database owns attempt counting and the 30-minute lockout after five failures.

Existing SHA-256 PINs keep working and are upgraded to bcrypt on the next correct entry. Changing or removing a PIN requires the current PIN. A forgotten PIN is cleared by re-entering the account password, proven by a password `amr` entry under five minutes old in the JWT.

**Accepted risk:** an attacker holding a session token within five minutes of a password sign-in could clear the PIN.

## ADR-002: Document encryption model (undecided)

**Status:** Open, owner decision required

Files currently rely on Supabase's storage-level encryption, so the service operator can technically read them. The landing page says files are "unreadable to anyone but you", which is not true today.

| Option | Protects against | Cost |
|---|---|---|
| A. Server-managed encryption, with claims corrected | Stolen disks, some storage-layer exposure | Lowest effort. Supports OCR, AI, and search as documented. The operator retains access |
| B. Client-side end-to-end encryption | Operator and server compromise | The server cannot read files, which conflicts with the documented server-side OCR and AI. Lost keys mean lost documents. Family sharing needs key management |
| C. Hybrid: E2EE vault tier, with opt-in AI per document | Operator access for protected files | Highest effort, and the clearest privacy story for a paid tier |

**Recommendation:** ship A with honest claims now. Consider C as a paid differentiator once the core product works.

## ADR-003: The PIN is a device lock, not a data boundary

**Status:** Accepted

The session token is in `localStorage`, and API access does not depend on PIN state. The PIN stops someone using an unlocked device through the app. It does not stop an attacker who already has the token. Do not market it as data protection. Script-injection defences (SEC-3, SEC-7) and MFA (SEC-5) are the real controls here.

## ADR-004: `.env` stays committed for now

**Status:** Accepted

It contains only the public URL and `anon` key, which ship in the browser bundle anyway, and Lovable may depend on it. Never add a `service_role` key or any other secret to this file, because the repository is public.

## ADR-005: Database security tests run on PGlite

**Status:** Accepted

Tests in `src/test/security/` run migrations on in-process Postgres and attack them as real database roles. This needs no Docker, so it can run anywhere `npm test` runs. Any new table or policy must add tests there, including an attempt from a second family.

## ADR-006: MFA is enforced in the database

**Status:** Accepted

Restrictive RLS policies on every family table and the `family-documents` bucket call `mfa_satisfied()`. A user with a verified factor needs an `aal2` token, so a stolen password alone returns no data, even through direct API calls. The screen in `ProtectedRoute` is only the user experience of that rule. New family tables must add the same policy.

Confirming a password in Settings uses a temporary client (`src/lib/reauth.ts`), because signing in on the main client would drop an MFA session to `aal1`.

**Accepted risks:**

- **Lost devices:** Supabase has no built-in recovery codes. Someone who loses their authenticator needs an operator to remove the factor, and that process must verify identity carefully, because it bypasses MFA (SEC-11).
- **PIN functions at `aal1`:** someone with only the password can set or clear the PIN. They still cannot read family data.
- **Current password check is client-side:** a stolen session can call Supabase Auth directly to change the password without it. Supabase's "secure password change" setting would close this, but needs a reauthentication email flow first.

## ADR-007: Audit log trust levels

**Status:** Accepted

`public.audit_events` is append-only for clients: they have `SELECT` only, and writes come from triggers or `record_document_access`. Each row has a `source`:

- `server`: document, member, and PIN changes, written by database triggers. Clients cannot skip or forge these.
- `client`: views and downloads, reported by the app after a read succeeds. Files are read directly from Storage, so a stolen token can read a file without producing a row. **Do not describe this log as a complete record of who read a document.** A logging failure does not block the read, because the emergency page must keep working.

Making reads verifiable means removing direct Storage reads and issuing signed URLs through an Edge Function that logs first (SEC-12). Until then, Supabase's Storage logs are the only server record of reads.

Event rows store document and member names, so a deleted document stays identifiable. They are deleted with the family, which keeps account deletion complete. There is no retention limit yet, so one should be set as part of SEC-9.

## ADR-008: Content-Security-Policy is built into the HTML

**Status:** Accepted

A Vite plugin adds the policy as a meta tag to production builds, so it applies on any host. The policy comes from `src/lib/contentSecurityPolicy.ts`, and the build fails if the Supabase URL is missing or not `https`. It is left out of the dev server, which needs inline scripts.

`script-src` is `'self'` with no exceptions, and it must stay that way, because the session token in `localStorage` depends on it (ADR-003). `style-src` allows `'unsafe-inline'` because Radix and `chart.tsx` inject style elements. That lets injected CSS run, which is a much smaller risk than script.

New external services must be added to the policy deliberately, and the app will fail visibly until they are. Realtime is not allowed, so using Supabase Realtime means adding the project's `wss://` origin to `connect-src`.

A meta tag cannot set `frame-ancestors`, so clickjacking protection needs a host header (SEC-13).
