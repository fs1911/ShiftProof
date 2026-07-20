# ShiftProof — Data Model

This document describes the core entities and how they relate. It is the human-readable companion to `supabase/schema.sql`; the two must stay aligned. All entities use **UUID** primary keys and, where sensible, `created_at` / `updated_at` timestamps.

## Entity overview

```
locations ─┬─< user_locations >─ users
           │
           ├─< routines ─< tasks
           │
           └─< routine_runs ─< task_runs ─< photos
                                   │
                                   └─< exceptions
```

- A **location** is the top-level tenant boundary — access is scoped by location.
- **users** belong to one or more locations (with a role per location).
- **routines** and their **tasks** are the templates.
- **routine_runs** and **task_runs** are the executions of those templates.
- **photos** and **exceptions** attach to the executed work.

---

## locations

**Purpose:** A physical venue (restaurant, café, hotel). The primary access-scoping boundary — nearly all data belongs to a location.

**Key fields:**
- `id` (uuid, PK)
- `name`
- `timezone` (for correct "today" / shift boundaries)
- `address` (optional)
- `is_active`
- `created_at`, `updated_at`

**Relationships:**
- Has many `users` (through `user_locations`).
- Has many `routines`.
- Has many `routine_runs`.

---

## users

**Purpose:** A person who uses ShiftProof — owner, manager, or staff. Mirrors a Supabase Auth user and carries app-level profile data. Role is assigned **per location** via the `user_locations` join, so the same person can have different roles at different venues.

**Key fields:**
- `id` (uuid, PK — matches `auth.users.id`)
- `email`
- `full_name`
- `is_active`
- `created_at`, `updated_at`

**Join — `user_locations`:**
- `user_id` → `users.id`
- `location_id` → `locations.id`
- `role` (enum: `owner` | `manager` | `staff`)
- Unique on (`user_id`, `location_id`).

**Provisioning (onboarding):** locations and memberships are created in-app via `SECURITY DEFINER` functions in `supabase/policies.sql`, invoked from the RLS-governed client (never the service-role key): `create_location` (caller becomes owner; self-provisions the caller's `users` row from `auth.users`), `add_member_by_email`, `set_member_role`, and `remove_member`. These enforce the role rules (owners grant any role and manage everyone; managers manage staff; the last owner is protected) and the by-email lookup that `users_select_self` would otherwise block.

**Inviting new people:** an owner/manager can invite an email that has no account yet (`inviteMember` in `app/app/settings/actions.ts`). This is the one sanctioned use of the service-role admin client for member management: it calls Supabase `auth.admin.inviteUserByEmail` (which creates `auth.users` and emails a set-password link → `/auth/callback` → `/auth/update-password`) and then upserts the `users` profile and the first `user_locations` membership. The action enforces the same role rules first (only an owner may grant owner/manager). If the email already has an account, it falls back to the RLS `add_member_by_email` RPC. Otherwise `auth.users` is created by Supabase Auth on sign-up.

**Invite status:** `list_location_members` (SECURITY DEFINER, manager-gated) also returns each member's `confirmed` and `last_sign_in_at` from `auth.users`, so the members screen can flag an invited-but-not-yet-confirmed person as **pending** and offer **Resend invite** (`resendInvite`, which sends a fresh set-password email via `resetPasswordForEmail`). These auth columns are read server-side only and never exposed to the browser.

**Relationships:**
- Belongs to many `locations` (through `user_locations`), each with a role.
- Starts many `routine_runs` (as the runner).
- Authors `photos`, `task_runs`, and `exceptions`.

---

## routines

**Purpose:** A reusable template of shift work for a location — e.g. "Opening", "Closing", "Weekly deep clean". Contains an ordered set of tasks.

**Key fields:**
- `id` (uuid, PK)
- `location_id` → `locations.id`
- `name`
- `description` (optional)
- `frequency` (enum: `daily` | `weekly` | `monthly` | `ad_hoc`)
- `schedule_weekday` (smallint, nullable, 0=Sunday..6=Saturday) — weekly target day; null ⇒ Monday
- `schedule_monthday` (smallint, nullable, 1..28) — monthly target day; null ⇒ 1st
- `is_active`
- `created_at`, `updated_at`

**Scheduling / "due":** the frequency + schedule fields derive when a routine is *due* on a given day (computed in the app, in the location's timezone): `daily` ⇒ every day; `weekly` ⇒ on `schedule_weekday`; `monthly` ⇒ on `schedule_monthday`; `ad_hoc` ⇒ never. A routine is *done* for a day when a `completed` `routine_run` exists for it that day, and *overdue* when a scheduled day within a short look-back window was missed. There is no separate schedule table and no server-side scheduler yet.

**Relationships:**
- Belongs to one `location`.
- Has many `tasks`.
- Has many `routine_runs`.

---

## tasks

**Purpose:** A single step within a routine template, defining what proof to capture.

**Key fields:**
- `id` (uuid, PK)
- `routine_id` → `routines.id`
- `title`
- `instructions` (optional)
- `task_type` (enum: `checkbox` | `value` | `photo` | `comment`)
- `is_required` (must be completed to finish the run)
- `requires_photo` (proof photo required)
- `value_min`, `value_max` (numeric, nullable) — optional target range for `value` tasks
- `value_unit` (text, nullable) — display unit for the reading (e.g. `°C`, `kg`, `pH`)
- `position` (integer, ordering within the routine)
- `created_at`, `updated_at`

**Typed value capture:** for a `value` task, a manager may set a numeric target range (`value_min`/`value_max`, either bound optional) and a `value_unit`. During a run, a captured reading parsed as a number that falls outside the range is **automatically flagged as an `exception`** (linked to the `task_run`), idempotently — re-saving the same reading never stacks duplicate exceptions. The range is advisory: it does not block completing the task, it records the breach for follow-up. `value_text` remains free-form, so non-numeric readings are simply not range-checked.

**Relationships:**
- Belongs to one `routine`.
- Has many `task_runs` (one per time it's executed).

---

## routine_runs

**Purpose:** A single execution of a routine on a shift — the "this routine, this time" record.

**Key fields:**
- `id` (uuid, PK)
- `routine_id` → `routines.id`
- `location_id` → `locations.id` (denormalized for access scoping and querying)
- `started_by` → `users.id`
- `status` (enum: `in_progress` | `completed` | `abandoned`)
- `started_at`
- `completed_at` (nullable)
- `notes` (optional, run-level)
- `created_at`, `updated_at`

**Relationships:**
- Belongs to one `routine` and one `location`.
- Started by one `user`.
- Has many `task_runs`.
- Has many `exceptions` (run-level).

---

## task_runs

**Purpose:** The execution and captured proof of a single task within a routine run.

**Key fields:**
- `id` (uuid, PK)
- `routine_run_id` → `routine_runs.id`
- `task_id` → `tasks.id`
- `status` (enum: `pending` | `completed` | `skipped` | `failed`)
- `value_text` (captured value, e.g. a temperature or reading; free-form for MVP)
- `comment` (optional)
- `completed_by` → `users.id` (nullable until completed)
- `completed_at` (nullable)
- `created_at`, `updated_at`

**Relationships:**
- Belongs to one `routine_run` and references one `task`.
- Completed by one `user`.
- Has many `photos`.
- Has many `exceptions` (task-level).

---

## photos

**Purpose:** Proof image captured for a task run. The binary lives in Supabase Storage; this row holds the reference and metadata.

**Key fields:**
- `id` (uuid, PK)
- `task_run_id` → `task_runs.id`
- `location_id` → `locations.id` (denormalized for access scoping)
- `storage_path` (path/key in the Storage bucket)
- `caption` (optional)
- `uploaded_by` → `users.id`
- `created_at`

**Storage:** binaries live in the private Supabase Storage bucket **`shift-photos`**, with object paths following the convention `<location_id>/<task_run_id>/<filename>`. The first path segment is the owning location, so Storage RLS (in `supabase/policies.sql`) scopes read/upload to location members and delete to managers — mirroring the `photos` table policies. Images are displayed via short-lived server-generated signed URLs.

**Lifecycle:** photos are **immutable** — the app only adds and (manager) deletes them; there is no edit. A `photo`-type or `requires_photo` task cannot be marked *completed* in a run until at least one photo is attached.

**Relationships:**
- Belongs to one `task_run` and one `location`.
- Uploaded by one `user`.

---

## exceptions

**Purpose:** Something that went wrong or needs follow-up — a task that couldn't be done to standard, or an issue observed during the shift. Carries a lifecycle so it can be tracked to resolution.

**Key fields:**
- `id` (uuid, PK)
- `location_id` → `locations.id` (denormalized for access scoping)
- `routine_run_id` → `routine_runs.id` (nullable — run-level context)
- `task_run_id` → `task_runs.id` (nullable — task-level context)
- `title`
- `description`
- `severity` (enum: `low` | `medium` | `high`)
- `status` (enum: `open` | `in_progress` | `resolved`)
- `raised_by` → `users.id`
- `assigned_to` → `users.id` (nullable)
- `resolution_note` (optional)
- `resolved_by` → `users.id` (nullable)
- `resolved_at` (nullable)
- `created_at`, `updated_at`

**Relationships:**
- Belongs to one `location`.
- Optionally linked to a `routine_run` and/or a `task_run`.
- Raised by one `user`; optionally assigned to and resolved by users.

---

## notifications

**Purpose:** In-app inbox message for a user (e.g. a daily due/overdue digest). No external delivery — the app surfaces these directly.

**Key fields:**
- `id` (uuid, PK)
- `location_id` → `locations.id`
- `user_id` → `users.id` (the recipient)
- `type` (text, e.g. `due_digest`)
- `title`, `body` (optional)
- `related_routine_id` → `routines.id` (nullable)
- `dedupe_key` (text, nullable) — makes generation idempotent; unique per (`user_id`, `dedupe_key`). NULLs are distinct, so ad-hoc notifications are never deduped
- `is_read` (default false)
- `emailed_at` (timestamptz, nullable) — when the digest email was sent; null = not emailed
- `created_at`

Recipients' digest-email opt-in lives on `users.notify_email` (boolean, default true), which each user manages for their own row.

**Access / creation:** RLS lets a user read and mark-read only their **own** notifications; there is no client INSERT/DELETE policy. Rows are created only by the `create_digest_notifications` `SECURITY DEFINER` function, which fans a digest (computed app-side in `lib/data/schedule.ts`) out to every owner/manager of a location, idempotently per day via `dedupe_key`.

**Relationships:**
- Belongs to one `location` and one recipient `user`.
- Optionally references a `routine`.

---

## Notes on modeling choices

- **`location_id` is denormalized** onto `routine_runs`, `photos`, and `exceptions` so Row Level Security policies can scope access with a single join to `user_locations`, without walking the whole chain.
- **Templates vs. executions** are kept separate (`routines`/`tasks` vs. `routine_runs`/`task_runs`) so editing a routine never rewrites historical proof.
- **Captured proof favors immutability.** Values, comments, and photos represent what happened at a point in time; the app should avoid destructive edits to completed captures.
- **Value capture is free-form text for MVP.** Typed/validated values (numeric ranges for temperatures, etc.) are a deliberate later enhancement.
