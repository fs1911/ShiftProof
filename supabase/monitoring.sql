-- ShiftProof — operations monitoring
-- ===========================================================================
-- Ops-only views for the daily digest cron. They live in the `ops` schema,
-- which is NOT exposed via PostgREST (only `public` / `graphql_public` are), so
-- these infra views are never reachable from the app or the public API. Query
-- them from the Supabase SQL editor or the connector (as postgres/service_role).
--
-- Apply after schema.sql and policies.sql. Requires the pg_cron and pg_net
-- extensions (created when the digest cron is scheduled — see
-- docs/ARCHITECTURE.md, "Deployment & operations").
-- ===========================================================================

create schema if not exists ops;

-- The scheduled job (expect exactly one row, active = true).
create or replace view ops.digest_cron_schedule as
select jobid, jobname, schedule, active
from cron.job
where jobname = 'shiftproof-due-digest';

-- Scheduler execution history: did the cron SQL fire? status = 'succeeded'
-- means the net.http_post call was issued — NOT the app's HTTP status.
create or replace view ops.digest_cron_runs as
select jrd.runid, jrd.status, jrd.return_message, jrd.start_time, jrd.end_time
from cron.job_run_details jrd
join cron.job j on j.jobid = jrd.jobid
where j.jobname = 'shiftproof-due-digest';

-- The app's actual HTTP replies via pg_net. ok = false flags a non-200
-- (e.g. 401 = CRON_SECRET mismatch). pg_net keeps rows only for a short
-- retention window, so this is a near-real-time signal, not long-term history.
-- Only the digest cron uses pg_net here, so every row is a digest call.
create or replace view ops.digest_http_responses as
select id as response_id,
       status_code,
       (status_code = 200) as ok,
       error_msg,
       timed_out,
       created as responded_at
from net._http_response;
