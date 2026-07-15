# ShiftProof — Web App (`apps/web`)

This is the home of the ShiftProof web application: a **Next.js** (App Router, TypeScript, Tailwind CSS) app. The **core routine loop is implemented** on top of the initial scaffold: managers author routines and ordered tasks; staff start runs, step through tasks capturing values/comments and **proof photos** (uploaded to the private `shift-photos` Supabase Storage bucket, shown via signed URLs), and complete or abandon them; anyone raises exceptions and managers triage them to resolution. A `requires_photo` task can't be marked done without a photo.

The app is **phone-first** — the primary user is a staff member completing a routine on the floor. It talks directly to Supabase (auth, database under RLS, and storage), and is hosted on Railway.

## Tech

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** for styling (minimal, credible B2B look; no UI library)
- **@supabase/ssr** + **@supabase/supabase-js** for auth, session, and data access
- No other runtime dependencies (kept deliberately lean per `docs/CLAUDE.md`)

## Structure

```
apps/web/
  app/
    layout.tsx              # Root layout + global styles
    page.tsx                # / — public landing page
    login/
      page.tsx              # /login — email + password sign-in form
      actions.ts            # signIn server action
    app/                    # Protected area (guarded by layout + middleware)
      layout.tsx            # Auth check + AppShell (redirects to /login)
      actions.ts            # signOut server action
      page.tsx              # /app → redirects to /app/dashboard
      dashboard/page.tsx    # KPI cards, today's runs, open exceptions
      routines/
        page.tsx            # Routines list (manager sees "New routine")
        new/page.tsx        # Create-routine form (manager only)
        [id]/page.tsx       # Routine detail: edit, tasks, start run
        actions.ts          # create/update routine, task CRUD + reorder
      runs/
        page.tsx            # Routine runs list
        [id]/page.tsx       # Run detail: capture, complete/abandon, raise exception
        actions.ts          # startRun, saveTaskRun, completeRun, abandonRun, uploadPhoto, deletePhoto
      exceptions/
        page.tsx            # Exceptions list + raise form
        [id]/page.tsx       # Exception triage (open → in_progress → resolved)
        actions.ts          # raiseException, setExceptionStatus
      reports/
        page.tsx            # /app/reports — manager/owner summaries + date filter
        export/runs/route.ts        # CSV export of runs
        export/exceptions/route.ts  # CSV export of exceptions
      settings/
        locations/page.tsx  # Create/manage owned locations
        members/page.tsx    # Manage members of the active location
        actions.ts          # createLocation, updateLocation, add/change/removeMember
  components/
    app-shell.tsx           # Top bar + side nav + content area
    ui.tsx                  # Small UI primitives + shared tones/classes
  lib/
    auth/context.ts         # Current user + memberships + active location + role, canManage()
    env.ts                  # Lazy, fail-clearly env access
    supabase/
      client.ts             # Browser client (anon key, RLS)
      server.ts             # Server client (cookies, RLS)
      admin.ts              # Service-role client (server-only, bypasses RLS)
      middleware.ts         # Session refresh + /app route guard
    data/
      routines.ts           # getRoutines(), getRoutineWithTasks()
      runs.ts               # getRecentRuns(), getRunDetail()
      exceptions.ts         # getExceptions(), getException()
      photos.ts             # getRunPhotos() + server-signed URLs (shift-photos)
      reports.ts            # getRunSummary/getExceptionSummary, CSV export helpers
      members.ts            # getLocationMembers() (RPC), getOwnedLocations()
      schedule.ts           # getDueRoutines() — due/overdue/done in location tz
  types/db.ts               # Hand-written entity types (mirror schema.sql)
  middleware.ts             # Wires updateSession() across requests
```

## Roles & the routine loop

- **Managers/owners** author routines and their ordered tasks (`/app/routines`).
- **All members** start a run of a routine, step through its tasks capturing status, value, and comment, then complete (blocked until required tasks are done) or abandon it (`/app/runs/[id]`).
- **All members** raise exceptions (run- or task-level); the **raiser or a manager** triages them to resolution (`/app/exceptions`).
- Every write goes through the RLS-governed server client (anon key). The service-role client is never used for these flows. App-level role checks mirror the database policies for clear UX.

- **Managers/owners** additionally get **Reports** (`/app/reports`): read-only, active-location-scoped summaries for a date range (run counts + completion rate, per-routine counts, exceptions by status/severity) and CSV export of runs and exceptions. Staff don't see the Reports nav item, and the export routes re-check the role server-side.
- **Onboarding / Settings** (`/app/settings`): owners create and rename/activate locations (`/app/settings/locations`); owners/managers manage members of the active location (`/app/settings/members`) — add an existing user by email, change roles (owner-only), and remove members. These go through `SECURITY DEFINER` RPCs (`create_location`, `add_member_by_email`, `set_member_role`, `remove_member`) invoked with the RLS client — never the service-role key. A user with no location can create their own (becoming owner) from the "no location" notice.

**Multiple locations:** a user can belong to several locations, each with its own role. When they belong to more than one, the app shell shows a **location switcher**; the choice is stored in the HTTP-only `sp_active_location` cookie (validated server-side against their memberships, default = earliest-joined). Every screen and Server Action reads/writes only the **active location**, so data from the user's other locations is never mixed in. RLS is still the security boundary; the active-location filter is the in-app scoping among the user's own locations.

## Scripts (run from repo root or this workspace)

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production server (Railway start target)
- `npm run lint` — ESLint (`next lint`)
- `npm run typecheck` — `tsc --noEmit`

## Environment

Required variables (see root `.env.example`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public, browser + server
- `SUPABASE_SERVICE_ROLE_KEY` — server-only (used only by `lib/supabase/admin.ts`)
- `APP_BASE_URL` — public base URL of the deployment

Env is read lazily in `lib/env.ts`; a missing required value throws a clear error at request time rather than failing the build silently.

## Auth & routing

- `/` and `/login` are **public**; everything under `/app` is **protected**.
- Protection is enforced twice: at the edge in `middleware.ts` (redirects unauthenticated users to `/login`) and again in `app/app/layout.tsx` at render time (fail-closed).
- Sign-in uses Supabase **email + password**. This requires the Supabase project to have email/password auth enabled and a user provisioned — sign-up, password reset, and magic-link flows are intentionally deferred.

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
