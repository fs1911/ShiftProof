# ShiftProof — Web App (`apps/web`)

This is the home of the ShiftProof web application. It is currently a **placeholder**: the Next.js app is scaffolded here as the first implementation step (see the root `README.md` implementation path).

The app is **phone-first** — the primary user is a staff member completing a routine on the floor. It talks directly to Supabase (auth, database under RLS, and storage), and is hosted on Railway.

## Intended responsibilities

### Marketing pages
- Public landing page explaining ShiftProof and its value.
- Basic content (features, pricing later, contact) — minimal for MVP.
- Clear call-to-action into sign in / sign up.

### Auth entry
- Sign in and sign up via Supabase Auth (email/password to start).
- Session handling and route protection.
- Redirect authenticated users into the dashboard; gate app routes behind auth.

### Dashboard
- The post-login home for managers and owners.
- Overview per location: today's routine runs and open exceptions.
- Location switcher for users with access to more than one location.
- Role-aware UI (owner/manager see management actions; staff see their run flow).

### Routines
- List, create, and edit routines for a location (owner/manager).
- Manage each routine's ordered tasks and their types (checkbox, value, photo, comment) and requirements.

### Runs
- Start a routine run and step through its tasks (staff-facing, phone-first).
- Capture proof per task: completion, value, comment, and photo upload to Supabase Storage.
- Complete or abandon a run; view completed runs and their captured proof.

### Exceptions
- Raise an exception during a run (task- or run-level) with severity and detail.
- Manager view to triage: open → in progress → resolved, assign, and record resolution notes.

### Reports (later)
- Deferred beyond MVP. For now, simple list/detail views of runs and exceptions.
- Later: trends, filtering, and exportable records for compliance.

## Notes

- Keep the capture flow fast and one-handed; it is the heart of the product.
- All access is governed by Supabase Row Level Security (see `supabase/policies.sql`) — the UI reflects, but does not replace, those rules.
- Read `docs/CLAUDE.md` and `docs/MVP.md` before adding surface area here.
