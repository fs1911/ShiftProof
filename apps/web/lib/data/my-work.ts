import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExceptionRecord, QueryResult } from "@/types/db";

const EXCEPTION_COLUMNS =
  "id, location_id, routine_run_id, task_run_id, title, description, severity, status, raised_by, assigned_to, resolution_note, resolved_by, resolved_at, created_at, updated_at";

/** An in-progress run started by the current user, with its task progress. */
export interface MyOpenRun {
  id: string;
  routine_name: string | null;
  started_at: string;
  pending_tasks: number;
  total_tasks: number;
}

type RawRun = {
  id: string;
  started_at: string;
  routine: { name: string } | { name: string }[] | null;
  task_runs: { status: string }[] | null;
};

/**
 * Runs the current user started that are still in progress, in the active
 * location — the "pick up where I left off" list. RLS already scopes to the
 * user's locations; we additionally filter to this location and this user.
 */
export async function getMyOpenRuns(
  locationId: string,
  userId: string,
): Promise<QueryResult<MyOpenRun>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routine_runs")
      .select("id, started_at, routine:routines(name), task_runs(status)")
      .eq("location_id", locationId)
      .eq("started_by", userId)
      .eq("status", "in_progress")
      .order("started_at", { ascending: false });

    if (error) return { rows: [], error: error.message };

    const rows: MyOpenRun[] = ((data ?? []) as unknown as RawRun[]).map((r) => {
      const taskRuns = Array.isArray(r.task_runs) ? r.task_runs : [];
      const routine = Array.isArray(r.routine) ? r.routine[0] : r.routine;
      return {
        id: r.id,
        routine_name: routine?.name ?? null,
        started_at: r.started_at,
        pending_tasks: taskRuns.filter((t) => t.status === "pending").length,
        total_tasks: taskRuns.length,
      };
    });

    return { rows, error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading your runs.",
    };
  }
}

/**
 * Unresolved exceptions that involve the current user — ones they raised or
 * that are assigned to them — in the active location. This is the staff/owner
 * "what needs my attention" list.
 */
export async function getMyOpenExceptions(
  locationId: string,
  userId: string,
): Promise<QueryResult<ExceptionRecord>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("exceptions")
      .select(EXCEPTION_COLUMNS)
      .eq("location_id", locationId)
      .in("status", ["open", "in_progress"])
      .or(`raised_by.eq.${userId},assigned_to.eq.${userId}`)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as ExceptionRecord[], error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading your exceptions.",
    };
  }
}
