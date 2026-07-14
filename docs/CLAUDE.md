# ShiftProof — Working Instructions for Claude Code

These are **binding working rules** for every Claude Code session on this repository. Read this file before making any change. When in doubt, do the smaller, more explicit thing.

## Context

- ShiftProof is a lightweight web app for restaurants, cafés, and boutique hotels: complete recurring shift routines, capture proof, track exceptions and follow-ups.
- Development happens in **Claude Code on the web**. The **GitHub repo is the source of truth**. The app runs on **Railway**. Data, auth, and storage are on **Supabase**.
- There is **no local machine, no local folders, no Claude Projects**. Never assume local execution.

## Core rules

1. **Preserve architecture consistency.** Follow `docs/ARCHITECTURE.md`. Do not change the shape of the system (the GitHub → Railway → Supabase model) without an explicit, approved reason recorded in the docs.

2. **Prefer simple, shippable solutions.** Choose the smallest change that delivers the outcome. Boring and reliable beats clever. Ship the core loop (routine → run → proof → exception → follow-up) before anything peripheral.

3. **Do not introduce unnecessary dependencies.** Every new package is a liability. Prefer the platform (Next.js, Supabase client) and standard library. If a dependency seems necessary, justify it in the PR description and keep it minimal.

4. **Do not invent integrations that aren't yet approved.** No Cloudflare, no email/SMS providers, no POS/IoT/analytics integrations, no new third-party services unless they are explicitly approved and reflected in the docs. Cloudflare specifically is a *future option only*.

5. **Do not rewrite docs unless needed.** Update docs surgically when a change requires it. Do not restructure or "improve" `docs/` wholesale. Small, targeted edits that keep docs true.

6. **Keep docs, schema, and implementation aligned.** `docs/DATA_MODEL.md`, `supabase/schema.sql`, `supabase/policies.sql`, and the app code describe the same system. If you change one, update the others in the same change so they never drift.

7. **Prefer explicit, file-by-file changes.** Make deliberate edits to named files with clear commit messages. Avoid sweeping, repo-wide refactors. One coherent concern per change.

8. **Never assume local execution.** No "run this on your machine" steps, no reliance on local-only tooling or folders. Everything must be reproducible from the repo and the managed platforms (Railway, Supabase).

9. **Always respect the browser-based, GitHub-centric workflow.** Changes are commits and pull requests. Secrets live in Railway/Supabase, never in the repo. `.env.example` is the environment contract — keep it current, never commit real secrets.

10. **Keep the MVP narrow.** Honor `docs/MVP.md`. If a request expands scope, call it out and prefer deferring it. Out-of-scope items are parked deliberately, not smuggled in.

## Practical checklist before finishing a change

- [ ] Does this follow `docs/ARCHITECTURE.md` and stay within `docs/MVP.md` scope?
- [ ] Is it the simplest version that works?
- [ ] Did I avoid new dependencies (or justify each one)?
- [ ] Did I avoid unapproved integrations?
- [ ] If I touched the data model, are `docs/DATA_MODEL.md`, `schema.sql`, and `policies.sql` all consistent?
- [ ] Are secrets kept out of the repo, with `.env.example` still accurate?
- [ ] Are my changes explicit, file-by-file, with a clear commit message?
- [ ] Did I avoid assuming any local execution?

## When unsure

Stop and ask rather than guessing on anything that would: add a dependency, add an integration, widen MVP scope, or change the architecture. Prefer a short question over an expansive, hard-to-review change.
