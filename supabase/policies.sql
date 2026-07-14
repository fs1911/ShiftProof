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
-- PROVISIONAL: location creation and deletion are handled server-side
-- (service role) during onboarding; no insert/delete policies granted here.
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
