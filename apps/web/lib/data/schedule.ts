import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { RoutineFrequency } from "@/types/db";

/**
 * Derives which routines are due / overdue / done for a location on a given
 * calendar day, in the location's timezone. All reads are RLS-governed and
 * scoped to the active location; nothing here writes.
 *
 * Timezone note (documented simplification): "today" and each run's day are
 * computed from the location's `timezone` via Intl. We fetch completed runs in
 * a slightly wide UTC window and bucket them into local calendar days in JS, so
 * we avoid fragile local-midnight-to-UTC offset math (DST-safe enough for MVP).
 */

const LOOKBACK_DAYS = 7;

export type DueStatus = "due" | "overdue" | "done";

export interface DueRoutine {
  routineId: string;
  name: string;
  frequency: RoutineFrequency;
  status: DueStatus;
  /** Number of earlier scheduled days in the window that were missed. */
  missedCount: number;
}

export interface DueResult {
  date: string; // YYYY-MM-DD (location-local)
  routines: DueRoutine[];
  error: string | null;
}

interface ScheduleRow {
  id: string;
  name: string;
  frequency: RoutineFrequency;
  schedule_weekday: number | null;
  schedule_monthday: number | null;
}

/**
 * Resolve due status for a location on `dateParam` (or local today). Pass a
 * Supabase client to reuse a specific one — the RLS server client for user
 * requests (default), or the admin client for the cron job (no user session).
 */
export async function getDueRoutines(
  locationId: string,
  dateParam?: string,
  client?: SupabaseClient,
): Promise<DueResult> {
  try {
    const supabase = client ?? createClient();

    const { data: location } = await supabase
      .from("locations")
      .select("timezone")
      .eq("id", locationId)
      .maybeSingle();
    const timeZone = normalizeTimeZone((location as { timezone?: string } | null)?.timezone);

    const targetYmd = isValidYmd(dateParam)
      ? (dateParam as string)
      : localYmd(new Date(), timeZone);

    const { data: routineRows, error: routinesError } = await supabase
      .from("routines")
      .select("id, name, frequency, schedule_weekday, schedule_monthday")
      .eq("location_id", locationId)
      .eq("is_active", true)
      .neq("frequency", "ad_hoc");

    if (routinesError) return { date: targetYmd, routines: [], error: routinesError.message };
    const routines = (routineRows ?? []) as ScheduleRow[];
    if (routines.length === 0) return { date: targetYmd, routines: [], error: null };

    // Build the window of local days: target and the LOOKBACK_DAYS before it.
    const days = buildDays(targetYmd, LOOKBACK_DAYS);

    // Fetch completed runs in a wide UTC window and bucket by local day.
    const fromUtc = `${addDaysYmd(targetYmd, -(LOOKBACK_DAYS + 1))}T00:00:00.000Z`;
    const toUtc = `${addDaysYmd(targetYmd, 1)}T00:00:00.000Z`;
    const { data: runRows, error: runsError } = await supabase
      .from("routine_runs")
      .select("routine_id, status, started_at, completed_at")
      .eq("location_id", locationId)
      .eq("status", "completed")
      .gte("completed_at", fromUtc)
      .lte("completed_at", toUtc);

    if (runsError) return { date: targetYmd, routines: [], error: runsError.message };

    // done set of `${routineId}|${localYmd}`.
    const done = new Set<string>();
    for (const row of runRows ?? []) {
      const r = row as {
        routine_id: string;
        completed_at: string | null;
        started_at: string;
      };
      const stamp = r.completed_at ?? r.started_at;
      if (!stamp) continue;
      done.add(`${r.routine_id}|${localYmd(new Date(stamp), timeZone)}`);
    }

    const result: DueRoutine[] = [];
    for (const routine of routines) {
      const doneToday = done.has(`${routine.id}|${targetYmd}`);
      let missedCount = 0;
      let dueToday = false;

      for (const day of days) {
        if (!isScheduledOn(routine, day)) continue;
        const wasDone = done.has(`${routine.id}|${day.ymd}`);
        if (day.ymd === targetYmd) {
          dueToday = !wasDone;
        } else if (!wasDone) {
          missedCount += 1;
        }
      }

      let status: DueStatus | null = null;
      if (doneToday) status = "done";
      else if (missedCount > 0) status = "overdue";
      else if (dueToday) status = "due";

      if (status) {
        result.push({
          routineId: routine.id,
          name: routine.name,
          frequency: routine.frequency,
          status,
          missedCount,
        });
      }
    }

    // Overdue first, then due, then done; alphabetical within each group.
    const order: Record<DueStatus, number> = { overdue: 0, due: 1, done: 2 };
    result.sort(
      (a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name),
    );

    return { date: targetYmd, routines: result, error: null };
  } catch (err) {
    return {
      date: dateParam ?? "",
      routines: [],
      error: err instanceof Error ? err.message : "Unknown error computing due routines.",
    };
  }
}

interface DayInfo {
  ymd: string;
  weekday: number; // 0=Sunday .. 6=Saturday
  monthday: number; // 1..31
}

function isScheduledOn(routine: ScheduleRow, day: DayInfo): boolean {
  switch (routine.frequency) {
    case "daily":
      return true;
    case "weekly":
      return day.weekday === (routine.schedule_weekday ?? 1);
    case "monthly":
      return day.monthday === (routine.schedule_monthday ?? 1);
    default:
      return false;
  }
}

/** Build [target-lookback .. target] as DayInfo, oldest first. */
function buildDays(targetYmd: string, lookback: number): DayInfo[] {
  const days: DayInfo[] = [];
  for (let offset = -lookback; offset <= 0; offset += 1) {
    const ymd = addDaysYmd(targetYmd, offset);
    days.push({ ymd, weekday: weekdayOf(ymd), monthday: monthdayOf(ymd) });
  }
  return days;
}

/** The local calendar date (YYYY-MM-DD) of an instant in a timezone. */
function localYmd(date: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Weekday (0=Sunday) of a calendar date string; tz-independent. */
function weekdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00.000Z`).getUTCDay();
}

function monthdayOf(ymd: string): number {
  return new Date(`${ymd}T12:00:00.000Z`).getUTCDate();
}

/** Add days to a YYYY-MM-DD string, returning YYYY-MM-DD. */
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isValidYmd(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00.000Z`).getTime());
}

/** Fall back to UTC if the stored timezone is missing or unrecognized. */
function normalizeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}
