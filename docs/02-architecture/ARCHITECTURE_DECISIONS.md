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

- **Lost devices:** handled by recovery codes (ADR-012). Someone without their device or their codes still needs an operator to remove the factor, and that process must verify identity carefully, because it bypasses MFA.
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

## ADR-009: Account deletion needs fresh proof and leaves nothing behind

**Status:** Accepted

`delete_my_account` requires a password sign-in under five minutes old, plus MFA if enrolled, so a stolen session alone cannot destroy an account. The client runs the whole flow on a temporary session (`src/lib/accountDeletion.ts`), and every identity check finishes before the first file is removed.

Postgres cannot remove files from Storage, so the function refuses while any of the user's files remain. Deleting them in SQL would leave the objects behind while reporting success.

Exports stop on the first failure, because an incomplete archive could pass for a complete backup. They are built in browser memory, so very large vaults may need a server-side export later. Each exported file is logged as a download.

Audit events older than 12 months are purged when a family's next event is written, which avoids needing a scheduler. A family with no new events keeps old ones until then. Twelve months is a default, so confirm it with legal advice.

## ADR-010: Assets are never inlined

**Status:** Accepted

`build.assetsInlineLimit` is 0 because inlined assets become `data:` URLs, which `font-src 'self'` blocks. Tests did not catch this: only a browser check of the production build did. After changing fonts, assets, or the policy, load a production build and check for violations.

## ADR-011: Family roles and invites

**Status:** Accepted

Access follows `family_memberships`, with three roles:

| | Owner | Editor | Viewer |
|---|---|---|---|
| See and download everything | Yes | Yes | Yes |
| Add, change, and delete members and documents | Yes | Yes | No |
| Rename the family, invite, change roles, remove people | Yes | No | No |
| Read the audit log | Yes | No | No |

A family has exactly one owner, and ownership cannot be transferred yet. Each user owns one family and can join others, and `ActiveFamilyContext` remembers which one is shown. That choice only affects what is displayed: RLS decides access.

Clients can read memberships but never write them, so roles change only through owner-checked functions. Those functions bypass RLS, so each one checks the role and `mfa_satisfied()` itself. Any new `SECURITY DEFINER` function must do the same.

Invite links are bearer tokens, so only a SHA-256 hash is stored, and the token sits in the URL fragment. A link needs the invited address, confirmed, and it expires after 7 days. A new invite to the same address replaces the old link. All failures return the same error. The owner sends the link, because the app has no email provider yet (FEAT-2).

Records belong to the family. `user_id` on documents and members is now nullable with `ON DELETE SET NULL`, so an editor deleting their account leaves what they added. A trigger stops editors changing a record's creator or moving it to another family.

Deleting an account removes the family the user owns, for everyone in it. Export covers only that family.

**Accepted risks:**

- **Sharing weakens MFA:** an owner's MFA doesn't apply to the people they invite. A viewer without MFA can read everything, so a stolen viewer password exposes the family. A later option is letting owners require MFA for members.
- **Downloads can't be recalled:** removing someone ends their access, but they keep anything already downloaded.
- **No ownership transfer:** if an owner deletes their account or loses access, the family goes with them. Families planning for a death or emergency will need a successor feature.

## ADR-012: MFA recovery codes

**Status:** Accepted

Supabase has no recovery codes, so the app has its own: ten single-use codes of 80 random bits, shown once and stored as SHA-256 hashes in `private.mfa_recovery_codes`. A plain hash is enough because the codes are random, unlike passwords. Generating needs a real `aal2` session.

A code replaces the second factor and never the first, so redeeming needs a password sign-in under five minutes old. Redeeming deletes the factor and all other codes and signs out other sessions, so the user has to set MFA up again. This is simpler than keeping MFA on, and leaves no way to reuse a code.

Five wrong codes lock redemption for 30 minutes. Codes older than the newest verified factor are ignored, so codes from an earlier setup cannot defeat a new authenticator. Generation, failures, and use are in the audit log.

**Accepted risk:** a stolen password plus a stolen code gives full access, which is why the app tells people to keep codes away from their password.

## ADR-013: Public claims must be true today

**Status:** Accepted

Marketing copy states only what the product does now, because EverNest sells trust. `src/pages/LandingPage.test.tsx` fails if the removed claims come back.

Supabase's security page says customer data is encrypted at rest with AES-256 and in transit with TLS, so the page says that, and credits the infrastructure provider. That protects stored disks and traffic, and it does not keep the operator out, so the page states that EverNest is not end-to-end encrypted. Revisit this after ADR-002.

| Removed | Can return when |
|---|---|
| "Unreadable to anyone but you", "zero access" | End-to-end encryption exists (ADR-002) |
| "GDPR Compliant" | A qualified person has assessed it |
| "Stored on AWS" | The project's hosting is confirmed. It is likely true, because Supabase runs projects in AWS regions |
| Testimonials | Real customers have agreed to be quoted |
| "Automated expiry alerts" | Reminders are actually sent, which needs an email provider |
| "Most Popular", "Start Pro Trial" | Billing exists |

The Free plan's limits (3 members, 25 documents) are listed but not enforced, and every feature is available to everyone. Enforce the plans as part of billing.
