# EverNest

A secure home for a family's important records: documents, member profiles, expiry dates, and the information you need in an emergency.

## Features

- Document vault with categories, search, and safe previews
- Family members, a family tree, and an emergency page
- Shared families with owner, editor, and viewer roles
- Two-step verification with recovery codes, and an app PIN
- Activity log, full data export, and account deletion

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, TanStack Query, and Supabase (Postgres, Auth, Storage).

There is no custom backend. The browser talks to Supabase directly, so **Postgres Row Level Security is what protects user data**. Treat every change to a policy as a security change.

## Getting started

You need Node.js 22 or later.

```bash
npm ci
```

```bash
npm run dev
```

The app runs at http://localhost:8080 and uses the Supabase project set in `.env`. That file holds only the public URL and `anon` key. Never add a `service_role` key or any other secret to it, because this repository is public.

## Checks

| Command | What it does |
|---|---|
| `npm run typecheck` | Strict TypeScript checks |
| `npm run lint` | ESLint |
| `npm test` | All tests, including the database security tests |
| `npm run build` | Production build |

CI runs all of these on every push and pull request, along with `npm audit`.

The tests in `src/test/security/` apply the real migrations to an in-process Postgres (PGlite) and attack them as real database roles, so they need no Docker. Add tests there for any new table or policy, including an attempt from a second family.

After changing fonts, assets, or the Content-Security-Policy, load a production build in a browser and check for violations. Unit tests can't catch those.

## Project layout

| Path | Contents |
|---|---|
| `src/pages`, `src/components` | Screens and UI |
| `src/hooks`, `src/contexts` | Data access and app state |
| `src/lib` | Security-sensitive helpers, such as file handling, export, and the CSP |
| `src/test/security` | Database attack tests |
| `supabase/migrations` | Schema, RLS policies, and database functions |
| `docs` | Audit, decisions, and task tracker |

## Documentation

Start with [EVERNEST_MASTER_CONTEXT.md](EVERNEST_MASTER_CONTEXT.md). Then see the [architecture decisions](docs/02-architecture/ARCHITECTURE_DECISIONS.md), the [task tracker](docs/07-implementation/IMPLEMENTATION_TASKS.md), and the [audit](docs/00-project-overview/CURRENT_STATE_AUDIT.md).

## Security

To report a vulnerability, see [SECURITY.md](SECURITY.md).
