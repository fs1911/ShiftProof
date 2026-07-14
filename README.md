# ShiftProof

**ShiftProof** is a lightweight web app for restaurants, cafés, and boutique hotels. It helps teams complete recurring shift routines, capture proof (photos, values, comments), and track exceptions and follow-up actions.

Instead of paper checklists, spreadsheets, or memory, ShiftProof gives a shift-by-shift record that a manager or owner can trust: what was done, when, by whom, and with evidence.

---

## Why ShiftProof

Small hospitality teams run on repeatable routines — opening checks, closing checks, temperature logs, cleaning, cash handling, safety walks. These routines are easy to describe and hard to prove. ShiftProof turns each routine into a structured run where staff capture proof as they go and exceptions are surfaced immediately rather than discovered later.

---

## Stack

ShiftProof is built to be developed entirely in the browser, with the repository as the single source of truth.

| Layer | Tool | Role |
| --- | --- | --- |
| Development | **Claude Code on the web** | All code and docs are authored and changed here, committed to GitHub. |
| Source of truth | **GitHub** | Every change lives in the repo. No local-only state. |
| Hosting / runtime | **Railway** | Builds and runs the web app from GitHub on push. |
| Database, auth, storage | **Supabase** | Postgres database, authentication, Row Level Security, and file storage for photos. |

There is **no assumption of local tooling or local folders**. Everything is browser-first and repo-centric.

---

## Repository structure

```
shiftproof/
  README.md              # This file
  .gitignore
  .env.example           # Environment variable placeholders
  package.json           # Root workspace / scripts
  docs/
    PRODUCT.md           # Vision, customer, positioning
    MVP.md               # Scope and success criteria
    ARCHITECTURE.md      # System design and platform roles
    DATA_MODEL.md        # Core entities and relationships
    CLAUDE.md            # Working instructions for Claude Code sessions
  apps/
    web/                 # Next.js web app (App Router, TypeScript, Tailwind)
      app/               # Routes: /, /login, /app/{dashboard,routines,runs,exceptions}
      components/        # App shell + small UI primitives
      lib/               # env, Supabase clients (browser/server/admin), data helpers
      types/             # Hand-written entity types (mirror the schema)
      middleware.ts      # Session refresh + protected-route guard
      README.md          # Web app structure, scripts, env, auth notes
  railway.json           # Railway build/start configuration
  supabase/
    README.md            # Database ownership and conventions
    schema.sql           # Initial database schema
    policies.sql         # Initial Row Level Security policies
```

---

## Intended implementation path

The repository began as a **bootstrap** (docs, structure, and database contracts) and now includes the **first web app scaffold** under `apps/web/` — auth foundation, a protected app shell, page skeletons for the core flows, and a thin Supabase-backed data layer.

1. **Provision Supabase.** Create the project, run `supabase/schema.sql`, then `supabase/policies.sql`. Create a storage bucket for photos. Enable email/password auth and provision at least one user.
2. **Wire environment.** Copy `.env.example` into Railway (and any preview environments). Fill in Supabase and app values.
3. ✅ **Web app scaffold.** The Next.js app under `apps/web/` is in place — see `apps/web/README.md`. Next up is building out real creation/capture/triage flows on top of it.
4. **Deploy on Railway.** Connect the GitHub repo to Railway. Railway builds with `npm run build` and serves with `npm run start` (see `railway.json`); set the environment variables from step 2.
5. **Iterate on the MVP.** Follow `docs/MVP.md` — keep scope narrow, ship the core routine → run → proof → exception loop first.

## Running the app

From the repo root:

```bash
npm install          # installs the apps/web workspace
npm run dev          # start the dev server (http://localhost:3000)
npm run build        # production build
npm run start        # production server (Railway start target)
npm run check        # typecheck + lint
```

The app reads Supabase config from the environment at request time and fails with a clear error if a required value is missing (see `apps/web/lib/env.ts`).

Read `docs/CLAUDE.md` before making any change. It defines how this repo is meant to evolve.
