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

## Standing execution rules (owner-directed)

These apply to every ShiftProof task and take precedence over generic defaults:

1. Do not ask the user to create files manually. Create them in the repo.
2. Do not ask the user to organize repository structure manually. Do it.
3. Do not suggest local setup. The workflow is browser-only.
4. Do not suggest Claude Projects.
5. Do not stop after planning if implementation was requested — implement.
6. Do not ask whether to continue to the obvious next step. Proceed.
7. Minimize manual work for the user.
8. If something truly cannot be done without GitHub/platform UI interaction, say so explicitly and list only the absolute minimum manual actions.
9. Keep architecture, schema, docs, and implementation aligned.
10. Do not invent scope outside the documented MVP unless strictly necessary.
11. Do not introduce unnecessary dependencies.
12. Prefer simple, explicit, file-by-file implementation.
13. Preserve security boundaries, especially Supabase service-role use (server-only, never shipped to the browser, used sparingly).
14. Keep all work compatible with GitHub-centric, browser-only execution.
15. When in doubt on a low-risk decision, make the best reasonable choice and proceed; state the assumption in the handoff report.

## When unsure

Proceed by default (rule 15). Only pause to ask when a choice is both high-impact and hard to reverse — specifically anything that would add a dependency, add an unapproved integration, widen MVP scope, change the architecture, or weaken a security boundary. Even then, prefer one short, specific question over an expansive, hard-to-review change. Verify work before reporting it done (typecheck, lint, build for the web app).

## Mandatory handoff report

At the end of **every** implementation task, always output a final handoff report in plain text that the user can copy-paste to another AI assistant. Never ask whether they want it — always include it automatically. Rules: plain text only; no markdown tables; be specific with file paths; state whether a PR was created; state whether any branch or GitHub/platform setting still needs manual action; list any required environment variables; note anything that would block the next task; never end with "Do you want me to continue?"; always include a complete, copy-paste-ready next prompt. When asked for "the next step," provide one coherent master prompt for the next logical phase, not fragmented mini-prompts.

Use exactly this structure and headings:

```
=== SHIFTPROOF HANDOFF START ===

PHASE NAME:
<short name of the implementation block>

STATUS:
<done / done with caveats / blocked>

WHAT WAS IMPLEMENTED:
- bullet list

FILES CREATED:
- path

FILES CHANGED:
- path

DATABASE / SUPABASE CHANGES:
- bullet list, or "none"

AUTH / SECURITY NOTES:
- bullet list, or "none"

DEFERRED ITEMS:
- bullet list

KNOWN RISKS / ASSUMPTIONS:
- bullet list

MANUAL ACTIONS I MUST DO:
- bullet list, or "none"

NEXT BEST IMPLEMENTATION BLOCK:
<one concise paragraph>

RECOMMENDED NEXT PROMPT:
<the full next prompt to paste into Claude Code, in one complete block>

=== SHIFTPROOF HANDOFF END ===
```
