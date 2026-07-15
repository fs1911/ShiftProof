-- ShiftProof — Row Level Security (RLS) policies
-- Apply this file AFTER schema.sql.
--
-- Access model:
--   * Access is scoped by LOCATION via the user_locations membership table.
--   * Roles are location-aware: 'owner', 'manager', 'staff'.
--       - staff   : can run routines and capture proof at their location(s).
--       - manager : staff abilities + manage routines/tasks and exceptions.
--       - owner   : manager abilities + manage the location and memberships.
--   * RLS is the primary authorization boundary. The service role key bypasses
--     RLS and must only be used server-side, sparingly.
--
-- PROVISIONAL: These policies are an initial, deliberately conservative pass.
-- They will be tightened/expanded as real app access patterns are implemented
-- (e.g. immutability of completed captures, storage policies, invitations).
-- Review every policy marked "PROVISIONAL" before relying on it in production.

-- ---------------------------------------------------------------------------
-- Helper functions
-- Marked SECURITY DEFINER + stable so they can be used inside policies without
-- causing recursive RLS evaluation on user_locations.
-- ---------------------------------------------------------------------------

-- Is the current user a member of the given location?
create or replace function is_location_member(target_location uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_locations ul
    where ul.location_id = target_location
      and ul.user_id = auth.uid()
  );
$$;

-- Does the current user have at least the given role at the location?
-- Role ranking: owner(3) > manager(2) > staff(1).
create or replace function has_location_role(target_location uuid, min_role user_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from user_locations ul
    where ul.location_id = target_location
      and ul.user_id = auth.uid()
      and (
        case ul.role
          when 'owner'   then 3
          when 'manager' then 2
          when 'staff'   then 1
        end
      ) >=
      (
        case min_role
          when 'owner'   then 3
          when 'manager' then 2
          when 'staff'   then 1
        end
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on all tables
-- ---------------------------------------------------------------------------

alter table locations      enable row level security;
alter table users          enable row level security;
alter table user_locations enable row level security;
alter table routines       enable row level security;
alter table tasks          enable row level security;
alter table routine_runs   enable row level security;
alter table task_runs      enable row level security;
alter table photos         enable row level security;
alter table exceptions     enable row level security;

-- ---------------------------------------------------------------------------
-- users
-- A user can see and update their own profile row.
-- PROVISIONAL: colleagues at the same location cannot yet see each other's
-- profiles; add a read policy for co-members when the UI needs it.
-- ---------------------------------------------------------------------------

create policy users_select_self
  on users for select
  to authenticated
  using (id = auth.uid());

create policy users_update_self
  on users for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- PROVISIONAL: profile row creation is expected to be handled server-side
-- (service role) on sign-up. No public insert policy is granted here.

-- ---------------------------------------------------------------------------
-- locations
-- Members can read their locations. Only owners can update.
-- Creation is done via the create_location() SECURITY DEFINER function (see the
-- Onboarding section at the end of this file), which also makes the caller the
-- owner — so no raw INSERT policy is granted here. Deletion stays out of scope.
-- ---------------------------------------------------------------------------

create policy locations_select_member
  on locations for select
  to authenticated
  using (is_location_member(id));

create policy locations_update_owner
  on locations for update
  to authenticated
  using (has_location_role(id, 'owner'))
  with check (has_location_role(id, 'owner'));

-- ---------------------------------------------------------------------------
-- user_locations (memberships)
-- A user can read their own memberships. Owners can read/manage memberships
-- at their location.
-- PROVISIONAL: invitations/onboarding flow not yet designed; owner-managed
-- membership is a starting point and may move server-side.
-- ---------------------------------------------------------------------------

create policy user_locations_select_self
  on user_locations for select
  to authenticated
  using (user_id = auth.uid());

create policy user_locations_select_owner
  on user_locations for select
  to authenticated
  using (has_location_role(location_id, 'owner'));

create policy user_locations_manage_owner
  on user_locations for all
  to authenticated
  using (has_location_role(location_id, 'owner'))
  with check (has_location_role(location_id, 'owner'));

-- ---------------------------------------------------------------------------
-- routines
-- Members read; managers+ manage.
-- ---------------------------------------------------------------------------

create policy routines_select_member
  on routines for select
  to authenticated
  using (is_location_member(location_id));

create policy routines_manage_manager
  on routines for all
  to authenticated
  using (has_location_role(location_id, 'manager'))
  with check (has_location_role(location_id, 'manager'));

-- ---------------------------------------------------------------------------
-- tasks
-- Access derives from the parent routine's location.
-- Members read; managers+ manage.
-- ---------------------------------------------------------------------------

create policy tasks_select_member
  on tasks for select
  to authenticated
  using (
    exists (
      select 1 from routines r
      where r.id = tasks.routine_id
        and is_location_member(r.location_id)
    )
  );

create policy tasks_manage_manager
  on tasks for all
  to authenticated
  using (
    exists (
      select 1 from routines r
      where r.id = tasks.routine_id
        and has_location_role(r.location_id, 'manager')
    )
  )
  with check (
    exists (
      select 1 from routines r
      where r.id = tasks.routine_id
        and has_location_role(r.location_id, 'manager')
    )
  );

-- ---------------------------------------------------------------------------
-- routine_runs
-- Members read runs at their location.
-- Staff+ may create runs (as themselves) at their location.
-- The runner or a manager+ may update the run.
-- PROVISIONAL: no immutability yet on completed runs; enforce later.
-- ---------------------------------------------------------------------------

create policy routine_runs_select_member
  on routine_runs for select
  to authenticated
  using (is_location_member(location_id));

create policy routine_runs_insert_staff
  on routine_runs for insert
  to authenticated
  with check (
    is_location_member(location_id)
    and started_by = auth.uid()
  );

create policy routine_runs_update_owner_or_runner
  on routine_runs for update
  to authenticated
  using (
    started_by = auth.uid()
    or has_location_role(location_id, 'manager')
  )
  with check (
    is_location_member(location_id)
  );

-- ---------------------------------------------------------------------------
-- task_runs
-- Access derives from the parent routine_run's location.
-- Members read; staff+ at the location may create/update.
-- PROVISIONAL: capture immutability and "only your own run" narrowing to come.
-- ---------------------------------------------------------------------------

create policy task_runs_select_member
  on task_runs for select
  to authenticated
  using (
    exists (
      select 1 from routine_runs rr
      where rr.id = task_runs.routine_run_id
        and is_location_member(rr.location_id)
    )
  );

create policy task_runs_write_member
  on task_runs for all
  to authenticated
  using (
    exists (
      select 1 from routine_runs rr
      where rr.id = task_runs.routine_run_id
        and is_location_member(rr.location_id)
    )
  )
  with check (
    exists (
      select 1 from routine_runs rr
      where rr.id = task_runs.routine_run_id
        and is_location_member(rr.location_id)
    )
  );

-- ---------------------------------------------------------------------------
-- photos
-- Location-scoped read for members; upload by members (as themselves).
-- PROVISIONAL: this governs the metadata rows only. Supabase STORAGE bucket
-- policies must be added separately (mirroring location scoping) when the
-- upload flow is implemented. Photos are treated as immutable once created
-- (no update policy).
-- ---------------------------------------------------------------------------

create policy photos_select_member
  on photos for select
  to authenticated
  using (is_location_member(location_id));

create policy photos_insert_member
  on photos for insert
  to authenticated
  with check (
    is_location_member(location_id)
    and uploaded_by = auth.uid()
  );

create policy photos_delete_manager
  on photos for delete
  to authenticated
  using (has_location_role(location_id, 'manager'));

-- ---------------------------------------------------------------------------
-- exceptions
-- Members read exceptions at their location.
-- Staff+ may raise exceptions (as themselves).
-- Managers+ (or the raiser) may update; managers+ handle triage/resolution.
-- PROVISIONAL: assignment/resolution rules will tighten with the manager UI.
-- ---------------------------------------------------------------------------

create policy exceptions_select_member
  on exceptions for select
  to authenticated
  using (is_location_member(location_id));

create policy exceptions_insert_staff
  on exceptions for insert
  to authenticated
  with check (
    is_location_member(location_id)
    and raised_by = auth.uid()
  );

create policy exceptions_update_owner_or_raiser
  on exceptions for update
  to authenticated
  using (
    raised_by = auth.uid()
    or has_location_role(location_id, 'manager')
  )
  with check (
    is_location_member(location_id)
  );

create policy exceptions_delete_manager
  on exceptions for delete
  to authenticated
  using (has_location_role(location_id, 'manager'));

-- ---------------------------------------------------------------------------
-- Storage: proof photos bucket
--
-- Bucket "shift-photos" holds proof images. Object paths follow the convention
--   <location_id>/<task_run_id>/<filename>
-- so the first path segment is the owning location. Access mirrors the table
-- RLS: members of the location may read and upload; managers may delete.
--
-- The `photos` table (above) holds the metadata row for each object; the binary
-- lives here in Storage. These two are kept in sync by the app.
--
-- NOTE: creating the bucket via SQL requires running this file as a privileged
-- role (e.g. the Supabase SQL editor). Alternatively create the bucket in the
-- Storage dashboard (name: shift-photos, Public: off) and then apply just the
-- policies below.
-- ---------------------------------------------------------------------------

-- Create the private bucket (id == name). Idempotent.
insert into storage.buckets (id, name, public)
values ('shift-photos', 'shift-photos', false)
on conflict (id) do nothing;

-- Members of the location (first path segment) may read objects.
create policy shift_photos_select_member
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'shift-photos'
    and is_location_member(((storage.foldername(name))[1])::uuid)
  );

-- Members of the location may upload objects under their location's prefix.
create policy shift_photos_insert_member
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'shift-photos'
    and is_location_member(((storage.foldername(name))[1])::uuid)
  );

-- Managers+ of the location may delete objects.
create policy shift_photos_delete_manager
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'shift-photos'
    and has_location_role(((storage.foldername(name))[1])::uuid, 'manager')
  );

-- ===========================================================================
-- Onboarding: location creation + membership management (SECURITY DEFINER)
--
-- These functions are invoked from the RLS-governed client via
-- supabase.rpc(...), NOT with the service-role key. Each enforces auth.uid()
-- and role rules internally.
--
-- Why functions instead of a plain locations INSERT policy: creating the FIRST
-- owner membership for a brand-new location cannot satisfy the "already an
-- owner" check in user_locations_manage_owner, so that bootstrap must be done
-- in one privileged, self-contained step. Managing members (add/role/remove)
-- lives here too, so the finer rules (owners grant any role; managers manage
-- staff; the last owner is protected; look users up by email past
-- users_select_self) are enforced consistently in one place.
--
-- This section is idempotent (create or replace / grant) and safe to re-run on
-- its own without re-running the rest of the file.
--
-- Error codes raised (the app maps these to friendly messages):
--   NOT_AUTHENTICATED, NAME_REQUIRED, NOT_ALLOWED, USER_NOT_FOUND,
--   ALREADY_MEMBER, NOT_A_MEMBER, LAST_OWNER
-- ===========================================================================

-- Create a location and make the caller its owner. Self-provisions the caller's
-- profile row from auth.users when missing so a brand-new user can bootstrap.
create or replace function create_location(p_name text, p_timezone text default 'UTC')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_location_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if coalesce(btrim(p_name), '') = '' then
    raise exception 'NAME_REQUIRED';
  end if;

  insert into users (id, email)
  select v_uid, au.email from auth.users au where au.id = v_uid
  on conflict (id) do nothing;

  insert into locations (name, timezone)
  values (btrim(p_name), coalesce(nullif(btrim(p_timezone), ''), 'UTC'))
  returning id into v_location_id;

  insert into user_locations (user_id, location_id, role)
  values (v_uid, v_location_id, 'owner');

  return v_location_id;
end;
$$;

-- List the members of a location (manager+ only). Returns emails, which the
-- users_select_self policy would otherwise hide from co-members.
create or replace function list_location_members(p_location_id uuid)
returns table (user_id uuid, email text, full_name text, role user_role)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not has_location_role(p_location_id, 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;
  return query
    select ul.user_id, u.email, u.full_name, ul.role
    from user_locations ul
    join users u on u.id = ul.user_id
    where ul.location_id = p_location_id
    order by
      case ul.role when 'owner' then 0 when 'manager' then 1 else 2 end,
      u.email;
end;
$$;

-- Add an existing ShiftProof user to a location by email. Owners may grant any
-- role; managers may add staff only. Never creates auth users.
create or replace function add_member_by_email(
  p_location_id uuid,
  p_email text,
  p_role user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target uuid;
begin
  if p_role in ('owner', 'manager') then
    if not has_location_role(p_location_id, 'owner') then
      raise exception 'NOT_ALLOWED';
    end if;
  else
    if not has_location_role(p_location_id, 'manager') then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;

  select id into v_target from users where lower(email) = lower(btrim(p_email));
  if v_target is null then
    raise exception 'USER_NOT_FOUND';
  end if;

  if exists (
    select 1 from user_locations
    where location_id = p_location_id and user_id = v_target
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into user_locations (user_id, location_id, role)
  values (v_target, p_location_id, p_role);
end;
$$;

-- Change a member's role. Owner-only (granting owner/manager is sensitive).
-- The last remaining owner cannot be demoted.
create or replace function set_member_role(
  p_location_id uuid,
  p_user_id uuid,
  p_role user_role
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current user_role;
  v_owner_count int;
begin
  if not has_location_role(p_location_id, 'owner') then
    raise exception 'NOT_ALLOWED';
  end if;

  select role into v_current from user_locations
  where location_id = p_location_id and user_id = p_user_id;
  if v_current is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  if v_current = 'owner' and p_role <> 'owner' then
    select count(*) into v_owner_count from user_locations
    where location_id = p_location_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'LAST_OWNER';
    end if;
  end if;

  update user_locations set role = p_role
  where location_id = p_location_id and user_id = p_user_id;
end;
$$;

-- Remove a member. Owners may remove anyone (but not the last owner); managers
-- may remove staff only.
create or replace function remove_member(p_location_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current user_role;
  v_owner_count int;
begin
  select role into v_current from user_locations
  where location_id = p_location_id and user_id = p_user_id;
  if v_current is null then
    raise exception 'NOT_A_MEMBER';
  end if;

  if v_current in ('owner', 'manager') then
    if not has_location_role(p_location_id, 'owner') then
      raise exception 'NOT_ALLOWED';
    end if;
  else
    if not has_location_role(p_location_id, 'manager') then
      raise exception 'NOT_ALLOWED';
    end if;
  end if;

  if v_current = 'owner' then
    select count(*) into v_owner_count from user_locations
    where location_id = p_location_id and role = 'owner';
    if v_owner_count <= 1 then
      raise exception 'LAST_OWNER';
    end if;
  end if;

  delete from user_locations
  where location_id = p_location_id and user_id = p_user_id;
end;
$$;

grant execute on function create_location(text, text) to authenticated;
grant execute on function list_location_members(uuid) to authenticated;
grant execute on function add_member_by_email(uuid, text, user_role) to authenticated;
grant execute on function set_member_role(uuid, uuid, user_role) to authenticated;
grant execute on function remove_member(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- notifications
-- A user reads and updates (mark read) only their own notifications. There is
-- no client INSERT/DELETE policy: rows are created solely by the
-- create_digest_notifications SECURITY DEFINER function below.
-- ---------------------------------------------------------------------------

alter table notifications enable row level security;

create policy notifications_select_self
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy notifications_update_self
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Fan out one digest notification per owner/manager of the location, idempotent
-- per (user, date) via dedupe_key. The "due/overdue" figures are computed in the
-- app (lib/data/schedule.ts) — the single source of truth for scheduling rules —
-- and passed in as title/body; this function only distributes them. Caller must
-- be a manager+ of the location. Runs under the user's session (rpc), never the
-- service-role key.
--
-- Scheduler note: a future daily job can call this per location. Because the due
-- figures are computed app-side, the job should hit an app endpoint that runs the
-- computation and then calls this function, rather than a pure-SQL cron.
create or replace function create_digest_notifications(
  p_location_id uuid,
  p_date date,
  p_title text,
  p_body text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if not has_location_role(p_location_id, 'manager') then
    raise exception 'NOT_ALLOWED';
  end if;

  insert into notifications (location_id, user_id, type, title, body, dedupe_key)
  select p_location_id, ul.user_id, 'due_digest', p_title, p_body,
         'due_digest:' || p_date::text
  from user_locations ul
  where ul.location_id = p_location_id
    and ul.role in ('owner', 'manager')
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function create_digest_notifications(uuid, date, text, text) to authenticated;
