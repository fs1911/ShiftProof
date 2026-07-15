# ShiftProof — MVP

The MVP proves one loop end-to-end: **a staff member completes a routine with proof, and a manager sees the result and any exceptions.** Everything that does not serve that loop is out of scope for the first release.

## In Scope

- **Authentication** via Supabase Auth (email/password to start).
- **Single organization / small multi-location** support: a user belongs to one or more locations.
- **Locations**: create and manage locations.
- **Users & roles**: three roles — `owner`, `manager`, `staff` — with location-based access.
- **Routines**: create routines per location, each with an ordered list of tasks.
- **Tasks**: each task has a type (checkbox, value, photo, comment) and whether proof/photo is required.
- **Routine runs**: a staff member starts a run of a routine, works through tasks, and completes it.
- **Task runs**: per-task capture — completed state, value, comment, and photo(s).
- **Photos**: upload proof photos to Supabase Storage, linked to task runs.
- **Exceptions**: raise an exception against a task run or run, with a status lifecycle (`open → in_progress → resolved`) and an optional follow-up note.
- **Basic dashboard**: managers/owners see recent runs and open exceptions per location.
- **Basic reporting & export**: managers/owners see per-location run/exception summaries for a date range and export runs and exceptions as CSV.
- **Multiple locations**: users belonging to more than one location switch the active location; the app scopes to it.

## Out of Scope (for MVP)

- Rich analytics dashboards, charts, and trend lines (basic count summaries + CSV export are in scope; graphical analytics are not).
- Scheduling / rostering / who-works-when.
- Automated reminders, push notifications, SMS, or email digests.
- Offline mode and PWA installability.
- Payments, billing, and subscription management.
- Multi-org / agency / franchise hierarchies beyond simple multi-location.
- Integrations (POS, accounting, HR, IoT temperature sensors).
- Native mobile apps (the web app must be mobile-friendly instead).
- Fine-grained custom roles/permissions beyond owner/manager/staff.
- Internationalization / multi-language.

## MVP success criteria

The MVP is successful when, in a real venue:

1. A staff member can complete a full routine on their phone in under a minute per few tasks, including at least one photo.
2. Captured proof (photos, values, comments) is reliably stored and viewable afterward.
3. An exception raised during a shift is visible to a manager without anyone being told verbally.
4. A manager can see, for a location, which routines ran today and which exceptions are open.
5. Access is correctly scoped: users only see data for their own location(s), and roles gate management actions.
6. The whole flow works deployed on Railway against a real Supabase project — no local-only assumptions.

## First release principles

- **Narrow beats broad.** Ship the single loop exceptionally well before adding surface area.
- **Phone-first.** The capture flow is designed for a staff member on the floor, one-handed.
- **Proof is the point.** Every routine run should produce evidence, not just checkmarks.
- **Trustworthy records.** Timestamps, authorship, and immutability of captured proof matter more than editing convenience.
- **Boring, reliable tech.** Prefer well-understood Supabase + Next.js + Railway patterns over novelty.
- **Docs and schema lead.** Keep `docs/`, `supabase/schema.sql`, and the app in sync as scope evolves.
- **Deferred, not deleted.** Out-of-scope items are parked deliberately, to be revisited once the core loop is loved.
