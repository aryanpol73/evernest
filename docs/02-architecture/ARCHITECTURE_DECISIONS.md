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
