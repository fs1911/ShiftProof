import "server-only";

import { createClient } from "@/lib/supabase/server";
import type {
  QueryResult,
  Routine,
  RoutineWithTasks,
  Task,
} from "@/types/db";

const ROUTINE_COLUMNS =
  "id, location_id, name, description, frequency, schedule_weekday, schedule_monthday, is_active, created_at, updated_at";
const TASK_COLUMNS =
  "id, routine_id, title, instructions, task_type, is_required, requires_photo, position, created_at, updated_at";

/**
 * Routines for the management screen, scoped to the active location. RLS also
 * confines results to the caller's own locations; the location_id filter
 * narrows further to the one location the user is currently acting in.
 * Includes inactive routines so managers can re-activate them. Pass
 * `activeOnly` for pickers (e.g. starting a run).
 */
export async function getRoutines(
  locationId: string,
  activeOnly = false,
): Promise<QueryResult<Routine>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from("routines")
      .select(ROUTINE_COLUMNS)
      .eq("location_id", locationId);
    if (activeOnly) query = query.eq("is_active", true);
    const { data, error } = await query.order("name", { ascending: true });

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as Routine[], error: null };
  } catch (err) {
    return { rows: [], error: toMessage(err, "routines") };
  }
}

/**
 * A single routine (in the active location) with its ordered tasks, or null if
 * not found/visible. The location_id filter prevents opening a routine that
 * belongs to another of the user's locations while acting here.
 */
export async function getRoutineWithTasks(
  routineId: string,
  locationId: string,
): Promise<{ routine: RoutineWithTasks | null; error: string | null }> {
  try {
    const supabase = createClient();

    const { data: routine, error: routineError } = await supabase
      .from("routines")
      .select(ROUTINE_COLUMNS)
      .eq("id", routineId)
      .eq("location_id", locationId)
      .maybeSingle();

    if (routineError) return { routine: null, error: routineError.message };
    if (!routine) return { routine: null, error: null };

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select(TASK_COLUMNS)
      .eq("routine_id", routineId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (tasksError) return { routine: null, error: tasksError.message };

    return {
      routine: { ...(routine as Routine), tasks: (tasks ?? []) as Task[] },
      error: null,
    };
  } catch (err) {
    return { routine: null, error: toMessage(err, "routine") };
  }
}

function toMessage(err: unknown, what: string): string {
  return err instanceof Error ? err.message : `Unknown error loading ${what}.`;
}
