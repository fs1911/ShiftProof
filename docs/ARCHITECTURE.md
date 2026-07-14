# ShiftProof — Architecture

## Architecture overview

ShiftProof is a **repo-centric, browser-developed web application** with a managed backend. There are four moving parts:

```
   Claude Code (web)  ──commits──▶  GitHub  ──deploys──▶  Railway (web app runtime)
                                       │                        │
                                       │                        ▼
                                       └────── contracts ─────▶ Supabase
                                            (schema, policies)  (Postgres, Auth, Storage)
```

- The **web app** (Next.js, under `apps/web/`) is the only runtime service in the MVP.
- **Supabase** provides the database, authentication, Row Level Security, and file storage.
- **Railway** builds and hosts the web app from GitHub.
- **GitHub** is the source of truth that ties them together.

There is no separate backend server in the MVP: the Next.js app talks to Supabase directly (client-side with the anon key under RLS, and server-side with the service role key for privileged operations).

## GitHub as source of truth

Everything that defines ShiftProof lives in the repository:

- Application code (`apps/web/`)
- Database contracts (`supabase/schema.sql`, `supabase/policies.sql`)
- Product and engineering docs (`docs/`)
- Configuration and environment contract (`.env.example`)

There is **no local-only state**. Any change — code, schema, or docs — is a commit. This keeps the project reproducible and lets Claude Code on the web operate as the primary development surface.

## Claude Code on the web workflow

1. Work happens in a Claude Code web session against this repository.
2. Claude makes **explicit, file-by-file changes** and commits them to a branch.
3. Changes are reviewed via GitHub (pull request) and merged.
4. Merges to the deploy branch trigger a Railway deployment.
5. Database changes are applied to Supabase from the versioned SQL in `supabase/` (via the Supabase SQL editor or, later, the migration tooling described below).

No step assumes a developer's laptop. See `docs/CLAUDE.md` for the working rules every session must follow.

## Railway role

- Hosts and runs the **web app** built from the GitHub repo.
- Rebuilds and redeploys automatically on pushes to the deploy branch.
- Holds the runtime **environment variables** (from `.env.example`) — Supabase URL/keys, `DATABASE_URL`, `APP_BASE_URL`.
- Provides preview/staging environments as needed via `RAILWAY_ENVIRONMENT_NAME`.

Railway does **not** own data. It is a stateless runtime; all persistent state lives in Supabase.

## Supabase role

- **Postgres database** — the schema defined in `supabase/schema.sql`.
- **Authentication** — user identity and sessions (email/password to start).
- **Row Level Security** — access control defined in `supabase/policies.sql`, enforcing location-based and role-aware access.
- **Storage** — a bucket for proof **photos**, referenced from the `photos` table.

Supabase is the system of record. The schema and policies are versioned in this repo and applied to the Supabase project.

## Later optional Cloudflare role

Cloudflare is **not part of the MVP** and must not be introduced without approval. If adopted later, its likely roles are:

- CDN and caching in front of the Railway app.
- DNS and TLS for a custom domain.
- Image resizing/optimization for proof photos.
- WAF / basic DDoS protection.

Until explicitly approved, treat Cloudflare as a future option only.

## Web app implementation (current scaffold)

The app under `apps/web/` is **Next.js (App Router) + TypeScript + Tailwind CSS**, with `@supabase/ssr` for auth/session. It follows a few deliberate patterns:

- **Route protection is layered.** `middleware.ts` refreshes the Supabase session on every request and redirects unauthenticated traffic away from `/app/*`; `app/app/layout.tsx` re-checks the session at render time and fails closed. Public routes (`/`, `/login`) are kept separate from the protected `/app` area.
- **Three Supabase clients, clearly separated.** Browser (`lib/supabase/client.ts`) and server (`lib/supabase/server.ts`) both use the anon key under RLS; the service-role client (`lib/supabase/admin.ts`) is server-only, bypasses RLS, and is used sparingly.
- **Lazy, fail-clearly env.** `lib/env.ts` reads variables through functions at request time, so the app builds without secrets but throws a clear error the moment a required value is missing.
- **Thin data layer.** `lib/data/*` provides read-only helpers (`getRoutines`, `getRecentRuns`, `getExceptions`) that return a `{ rows, error }` result so screens degrade gracefully before Supabase is connected. Full CRUD is deferred.

## Deployment logic

- **App:** push to the deploy branch → Railway builds `apps/web` via `npm run build` → serves via `npm run start` (Next.js honors Railway's `PORT`) → available at `APP_BASE_URL`. Build/start are declared in `railway.json`.
- **Database:** SQL changes are made in `supabase/schema.sql` / `policies.sql` in the repo first, then applied to the Supabase project. The repo is the canonical definition; Supabase reflects it.
- **Secrets:** never committed. `.env.example` is the contract; real values live in Railway (and Supabase project settings).

## Key technical decisions

1. **Next.js for the web app.** Server and client rendering in one framework, good fit for Railway, and works cleanly with Supabase's JS client. (Framework choice is a strong default, not yet locked — see gaps.)
2. **Supabase as the whole backend for MVP.** Database + auth + storage + RLS in one managed service avoids standing up custom infrastructure.
3. **RLS as the primary authorization boundary.** Access is enforced in the database via policies, so both client and server access are governed by the same rules. The service role key is used sparingly and only server-side.
4. **UUID primary keys everywhere.** Safe to expose, easy to generate client- or server-side, and friendly to distributed creation.
5. **Photos in Storage, metadata in Postgres.** Binary lives in a Supabase Storage bucket; the `photos` table holds the reference, ownership, and linkage.
6. **Contracts in the repo.** Schema and policies are versioned files, not clicked-together in a dashboard, so the database is reviewable and reproducible.
7. **Monorepo-shaped from day one.** A root workspace with `apps/*` leaves room for additional apps/packages later without restructuring.
8. **Defer migrations tooling.** For the MVP, apply `schema.sql`/`policies.sql` directly. Adopt Supabase CLI migrations once the schema stabilizes (see `supabase/README.md`).
