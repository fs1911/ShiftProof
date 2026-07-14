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
    web/
      README.md          # Web app responsibilities (Next.js app lands here)
  supabase/
    README.md            # Database ownership and conventions
    schema.sql           # Initial database schema
    policies.sql         # Initial Row Level Security policies
```

---

## Intended implementation path

The repository is intentionally shipped as a **bootstrap**: docs, structure, and database contracts are defined before application code, so implementation stays aligned.

1. **Provision Supabase.** Create the project, run `supabase/schema.sql`, then `supabase/policies.sql`. Create a storage bucket for photos.
2. **Wire environment.** Copy `.env.example` into Railway (and any preview environments). Fill in Supabase and app values.
3. **Scaffold the web app.** Build the Next.js app under `apps/web/` per `apps/web/README.md`, starting with auth entry and the dashboard.
4. **Deploy on Railway.** Connect the GitHub repo to Railway so pushes to the main branch deploy automatically.
5. **Iterate on the MVP.** Follow `docs/MVP.md` — keep scope narrow, ship the core routine → run → proof → exception loop first.

Read `docs/CLAUDE.md` before making any change. It defines how this repo is meant to evolve.
