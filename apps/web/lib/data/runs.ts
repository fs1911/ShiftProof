import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  QueryResult,
  RoutineRun,
  RoutineRunListItem,
  RunDetail,
  Task,
  TaskRun,
  TaskRunWithTask,
} from "@/types/db";

/**
 * PostgREST types embedded relations as arrays even for many-to-one joins,
 * while at runtime a to-one embed is a single object (or null). Normalize both.
 */
function embedOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

type RawListRow = RoutineRun & { routine: { name: string } | { name: string }[] | null };
type RawTaskRun = TaskRun & { task: Task | Task[] | null };
type RawRunDetail = RoutineRun & {
  routine: { name: string } | { name: string }[] | null;
  task_runs: RawTaskRun[] | null;
};

/**
 * Recent routine runs joined with their routine name. RLS scopes results to
 * the caller's location(s).
 */
export async function getRecentRuns(
  limit = 20,
): Promise<QueryResult<RoutineRunListItem>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routine_runs")
      .select(
        "id, routine_id, location_id, started_by, status, started_at, completed_at, notes, created_at, updated_at, routine:routines(name)",
      )
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) return { rows: [], error: error.message };

    const rows: RoutineRunListItem[] = ((data ?? []) as unknown as RawListRow[]).map(
      (row) => ({
        ...(row as unknown as RoutineRun),
        routine_name: embedOne(row.routine)?.name ?? null,
      }),
    );

    return { rows, error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading runs.",
    };
  }
}

/** A single run with its routine name and its task_runs (each joined to its task). */
export async function getRunDetail(
  runId: string,
): Promise<{ run: RunDetail | null; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routine_runs")
      .select(
        `id, routine_id, location_id, started_by, status, started_at, completed_at, notes, created_at, updated_at,
         routine:routines(name),
         task_runs(
           id, routine_run_id, task_id, status, value_text, comment, completed_by, completed_at, created_at, updated_at,
           task:tasks(id, routine_id, title, instructions, task_type, is_required, requires_photo, position, created_at, updated_at)
         )`,
      )
      .eq("id", runId)
      .maybeSingle();

    if (error) return { run: null, error: error.message };
    if (!data) return { run: null, error: null };

    const raw = data as unknown as RawRunDetail;

    const taskRuns: TaskRunWithTask[] = (raw.task_runs ?? [])
      .map((tr) => ({
        ...(tr as unknown as TaskRun),
        task: embedOne(tr.task),
      }))
      .sort((a, b) => (a.task?.position ?? 0) - (b.task?.position ?? 0));

    const run: RunDetail = {
      ...(raw as unknown as RoutineRun),
      routine_name: embedOne(raw.routine)?.name ?? null,
      task_runs: taskRuns,
    };

    return { run, error: null };
  } catch (err) {
    return {
      run: null,
      error: err instanceof Error ? err.message : "Unknown error loading run.",
    };
  }
}
