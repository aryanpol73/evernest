# EVERNEST — MASTER ENGINEERING CONTEXT & SOURCE OF TRUTH

> **ATTENTION CLAUDE CODE / CLAUDE OPUS:**
> Read this file first at the start of every session. This document is the primary entry point and source of truth for the EverNest project. Before modifying any source code in `src/` or `supabase/`, verify the current phase, check `docs/07-implementation/IMPLEMENTATION_TASKS.md`, and adhere strictly to the architectural and security rules defined below.

---

## 1. Executive Summary & Product Identity

**Product Name:** EverNest — Intelligent Family Digital Asset Protection Platform  
**Repository:** `https://github.com/aryanpol73/evernest`

EverNest is a secure family information and digital asset management platform. It goes beyond conventional cloud file storage to help ordinary families organize, protect, understand, and manage their vital records, financial assets, medical histories, and digital legacy.

### Core Pillars
1. **Security & Trust First:** Security, privacy, family-level isolation, and cryptographic protection are foundational product capabilities, not optional add-ons.
2. **Structured Family Intelligence:** Raw documents (PDFs, images) are transformed via AI OCR and extraction into structured, relational PostgreSQL records linked to specific family members.
3. **Zero-Hallucination Assistant:** All AI answers, financial summaries, and medical lookups must be strictly grounded in authorized database records and source documents with explicit citations.
4. **Controlled Interoperability:** External AI clients interact with EverNest exclusively through an authenticated, read-restricted Model Context Protocol (MCP) server.

---

## 2. Current Technology Stack

| Layer | Technology | Role & Responsibility |
| :--- | :--- | :--- |
| **Frontend** | React 18 + TypeScript + Vite | SPA client, UI state, client-side crypto/validation |
| **Styling & UI** | Tailwind CSS + shadcn/ui + Lucide | Accessible, trustworthy consumer design system |
| **State & Fetching** | TanStack Query (React Query) | Server state caching, optimistic updates, invalidation |
| **Core Backend** | Supabase (PostgreSQL 15+) | Primary relational source of truth, RLS enforcement |
| **Authentication** | Supabase Auth | JWT sessions, MFA, OAuth, family invite resolution |
| **Object Storage** | Supabase Storage | Private buckets for encrypted/protected family files |
| **AI & Async Worker** | Python + FastAPI (or Edge Functions) | Document OCR, LLM structured extraction, RAG pipeline |
| **Search & Vectors** | PostgreSQL FTS + `pgvector` | Hybrid keyword + semantic search over document chunks |
| **Interoperability** | MCP Server (TypeScript/Python SDK) | Controlled external AI tool & resource exposure |

---

## 3. Standard Operating Procedure for Claude Sessions

Every time you (Claude) are invoked to work on EverNest, you **MUST** follow this execution protocol:

### Rule 1: Two-Mode Operation
* **Mode A — Audit & Documentation (Phase 0 & 1):** Inspect the repository (`src/`, `supabase/`, `package.json`), run builds/tests, and update `docs/00-project-overview/CURRENT_STATE_AUDIT.md`. Do **NOT** modify application code during an audit task.
* **Mode B — Incremental Implementation (Phases 2–10):** Execute one specific milestone at a time from `IMPLEMENTATION_TASKS.md`. Never attempt to implement an entire phase in one monolithic coding session.

### Rule 2: Pre-Coding Checklist (Mandatory Output Before Writing Code)
Before editing any file in `src/` or `supabase/`, output a brief plan stating:
1. **Implementation Objective:** Which exact task ID from `IMPLEMENTATION_TASKS.md` is being built.
2. **Target Files:** Existing files to modify and new files to create.
3. **Architectural Reasoning:** How this aligns with `ARCHITECTURE_DECISIONS.md`.
4. **Database & API Impact:** Schema migrations, RLS policy changes, or endpoint updates.
5. **Security & Privacy Check:** How family isolation (`family_id`) and authorization are enforced.

### Rule 3: Post-Coding Verification
After implementing a task:
1. Run `npm run build` and existing test suites (`npm run test` / Vitest) to verify zero regressions.
2. Explain clearly what changed and why.
3. Update `docs/07-implementation/IMPLEMENTATION_TASKS.md` and `EVERNEST_MASTER_CONTEXT.md`.

---

## 4. Documentation Index (`docs/`)

All detailed engineering blueprints reside in the `docs/` directory:

* **Master Blueprint & Audit Prompt:** `docs/CLAUDE_OPUS_MASTER_PROMPT.md`
* **00 - Project Overview & Audit:**
  * `docs/00-project-overview/PRODUCT_VISION_AND_REQUIREMENTS.md`
  * `docs/00-project-overview/CURRENT_STATE_AUDIT.md` *(Template & Audit Checklist)*
* **01 - Product Design & UX:**
  * `docs/01-product-design/UX_AND_INFORMATION_ARCHITECTURE.md`
* **02 - Architecture & Database:**
  * `docs/02-architecture/SYSTEM_AND_DB_ARCHITECTURE.md`
  * `docs/02-architecture/ARCHITECTURE_DECISIONS.md` *(Permanent ADR Log)*
* **03 - Security, Auth & Encryption:**
  * `docs/03-security/SECURITY_AUTH_AND_ENCRYPTION.md`
* **04 - AI Intelligence & Agents:**
  * `docs/04-ai-intelligence/AI_AND_AGENT_ARCHITECTURE.md`
* **05 & 06 - APIs, Integrations & MCP:**
  * `docs/05-api-and-mcp/API_INTEGRATIONS_AND_MCP.md`
* **07 & 08 - Roadmap, Tasks & Operations:**
  * `docs/07-implementation/PHASE_WISE_ROADMAP_AND_OPS.md`
  * `docs/07-implementation/IMPLEMENTATION_TASKS.md` *(Active Task Tracker)*

---

## 5. Current Project Status & Immediate Next Action

* **Current Active Phase:** Security hardening, ahead of feature work.
* **Completed:** `TASK-0.1` audit, and `SEC-0` to `SEC-3`, `SEC-5`, and `SEC-6` in the repository. These are **not yet released**, so see the release steps at the top of `docs/07-implementation/IMPLEMENTATION_TASKS.md`.
* **Immediate Next Task:** Release the security fixes, then `SEC-7` (Content-Security-Policy and security headers).
* **Owner decisions pending:** landing page claims (`SEC-8`) and the document encryption model (ADR-002).

### Documentation gap

Of the documents indexed in Section 4, only these exist, and all were created on 2026-11-04 rather than being the originals:

* `docs/00-project-overview/CURRENT_STATE_AUDIT.md`
* `docs/02-architecture/ARCHITECTURE_DECISIONS.md`
* `docs/07-implementation/IMPLEMENTATION_TASKS.md`

The others are missing. Do not assume their contents. `SEC-*` task IDs are reconstructed from the audit.

### Rules for working in this repository

* Family data access must be enforced in Postgres. Add tests in `src/test/security/` for every new table or policy, including an attempt from a second family.
* In RLS policies, never reference a column by bare name inside a subquery. Pass it to a function or qualify it. This is what caused finding F-0.
* Every new family table needs the restrictive `require_mfa` policy (ADR-006).
* Read documents through `src/lib/documentAccess.ts`, so reads reach the audit log.
* Treat stored files as untrusted. Render only types allowed by `previewKindFor` in `src/lib/documentFiles.ts`.
* Never add a `service_role` key or other secret to `.env`, because this repository is public.
