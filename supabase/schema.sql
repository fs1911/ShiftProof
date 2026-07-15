-- ShiftProof — Initial database schema
-- Apply this file first, then policies.sql.
-- Canonical definition lives in this repo; keep aligned with docs/DATA_MODEL.md.
--
-- Conventions:
--   * UUID primary keys (gen_random_uuid()).
--   * created_at / updated_at where sensible; updated_at maintained by a trigger.
--   * Foreign keys with explicit on-delete behavior.
--   * Enums + check constraints for controlled values.
--   * location_id denormalized onto run/photo/exception rows for RLS scoping.

-- Required for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enum types
-- ---------------------------------------------------------------------------

create type user_role       as enum ('owner', 'manager', 'staff');
create type routine_frequency as enum ('daily', 'weekly', 'monthly', 'ad_hoc');
create type task_type        as enum ('checkbox', 'value', 'photo', 'comment');
create type routine_run_status as enum ('in_progress', 'completed', 'abandoned');
create type task_run_status  as enum ('pending', 'completed', 'skipped', 'failed');
create type exception_severity as enum ('low', 'medium', 'high');
create type exception_status as enum ('open', 'in_progress', 'resolved');

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger function
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- locations
-- ---------------------------------------------------------------------------

create table locations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  timezone   text not null default 'UTC',
  address    text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger locations_set_updated_at
  before update on locations
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- users  (mirrors auth.users; id equals auth.users.id)
-- ---------------------------------------------------------------------------

create table users (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger users_set_updated_at
  before update on users
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- user_locations  (membership + per-location role)
-- ---------------------------------------------------------------------------

create table user_locations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users (id) on delete cascade,
  location_id uuid not null references locations (id) on delete cascade,
  role        user_role not null default 'staff',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, location_id)
);

create trigger user_locations_set_updated_at
  before update on user_locations
  for each row execute function set_updated_at();

create index user_locations_user_id_idx     on user_locations (user_id);
create index user_locations_location_id_idx on user_locations (location_id);

-- ---------------------------------------------------------------------------
-- routines  (templates)
-- ---------------------------------------------------------------------------

create table routines (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations (id) on delete cascade,
  name        text not null,
  description text,
  frequency   routine_frequency not null default 'daily',
  -- Optional schedule targets used to derive when a routine is "due":
  --   daily   -> due every day (schedule_* ignored)
  --   weekly  -> due on schedule_weekday (0=Sunday .. 6=Saturday; null => Monday)
  --   monthly -> due on schedule_monthday (1..28; null => 1st)
  --   ad_hoc  -> never "due"
  schedule_weekday  smallint check (schedule_weekday is null or (schedule_weekday between 0 and 6)),
  schedule_monthday smallint check (schedule_monthday is null or (schedule_monthday between 1 and 28)),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger routines_set_updated_at
  before update on routines
  for each row execute function set_updated_at();

create index routines_location_id_idx on routines (location_id);

-- ---------------------------------------------------------------------------
-- tasks  (ordered steps within a routine)
-- ---------------------------------------------------------------------------

create table tasks (
  id            uuid primary key default gen_random_uuid(),
  routine_id    uuid not null references routines (id) on delete cascade,
  title         text not null,
  instructions  text,
  task_type     task_type not null default 'checkbox',
  is_required   boolean not null default true,
  requires_photo boolean not null default false,
  position      integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger tasks_set_updated_at
  before update on tasks
  for each row execute function set_updated_at();

create index tasks_routine_id_idx on tasks (routine_id);
-- Ordering index (non-unique): positions are maintained by the app and may be
-- transiently equal during a reorder swap. Screens order by (position, created_at).
create index tasks_routine_position_idx on tasks (routine_id, position);

-- ---------------------------------------------------------------------------
-- routine_runs  (executions of a routine)
-- ---------------------------------------------------------------------------

create table routine_runs (
  id           uuid primary key default gen_random_uuid(),
  routine_id   uuid not null references routines (id) on delete restrict,
  location_id  uuid not null references locations (id) on delete cascade,
  started_by   uuid not null references users (id) on delete restrict,
  status       routine_run_status not null default 'in_progress',
  started_at   timestamptz not null default now(),
  completed_at timestamptz,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- completed runs must have a completion timestamp
  constraint routine_runs_completed_at_chk
    check (status <> 'completed' or completed_at is not null)
);

create trigger routine_runs_set_updated_at
  before update on routine_runs
  for each row execute function set_updated_at();

create index routine_runs_routine_id_idx  on routine_runs (routine_id);
create index routine_runs_location_id_idx on routine_runs (location_id);
create index routine_runs_started_by_idx  on routine_runs (started_by);
create index routine_runs_status_idx      on routine_runs (status);

-- ---------------------------------------------------------------------------
-- task_runs  (execution + captured proof of a single task)
-- ---------------------------------------------------------------------------

create table task_runs (
  id             uuid primary key default gen_random_uuid(),
  routine_run_id uuid not null references routine_runs (id) on delete cascade,
  task_id        uuid not null references tasks (id) on delete restrict,
  status         task_run_status not null default 'pending',
  value_text     text,
  comment        text,
  completed_by   uuid references users (id) on delete set null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (routine_run_id, task_id)
);

create trigger task_runs_set_updated_at
  before update on task_runs
  for each row execute function set_updated_at();

create index task_runs_routine_run_id_idx on task_runs (routine_run_id);
create index task_runs_task_id_idx        on task_runs (task_id);
create index task_runs_status_idx         on task_runs (status);

-- ---------------------------------------------------------------------------
-- photos  (proof images; binary lives in Supabase Storage)
-- ---------------------------------------------------------------------------

create table photos (
  id           uuid primary key default gen_random_uuid(),
  task_run_id  uuid not null references task_runs (id) on delete cascade,
  location_id  uuid not null references locations (id) on delete cascade,
  storage_path text not null,
  caption      text,
  uploaded_by  uuid not null references users (id) on delete restrict,
  created_at   timestamptz not null default now()
);

create index photos_task_run_id_idx on photos (task_run_id);
create index photos_location_id_idx on photos (location_id);

-- ---------------------------------------------------------------------------
-- exceptions  (issues / follow-ups with a resolution lifecycle)
-- ---------------------------------------------------------------------------

create table exceptions (
  id              uuid primary key default gen_random_uuid(),
  location_id     uuid not null references locations (id) on delete cascade,
  routine_run_id  uuid references routine_runs (id) on delete set null,
  task_run_id     uuid references task_runs (id) on delete set null,
  title           text not null,
  description     text,
  severity        exception_severity not null default 'medium',
  status          exception_status not null default 'open',
  raised_by       uuid not null references users (id) on delete restrict,
  assigned_to     uuid references users (id) on delete set null,
  resolution_note text,
  resolved_by     uuid references users (id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- resolved exceptions must carry a resolution timestamp
  constraint exceptions_resolved_at_chk
    check (status <> 'resolved' or resolved_at is not null)
);

create trigger exceptions_set_updated_at
  before update on exceptions
  for each row execute function set_updated_at();

create index exceptions_location_id_idx    on exceptions (location_id);
create index exceptions_routine_run_id_idx on exceptions (routine_run_id);
create index exceptions_task_run_id_idx    on exceptions (task_run_id);
create index exceptions_status_idx         on exceptions (status);
create index exceptions_assigned_to_idx    on exceptions (assigned_to);
