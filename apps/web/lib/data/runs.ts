import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { QueryResult, RoutineRun } from "@/types/db";

/**
 * Thin read helper for recent routine runs. RLS scopes results to the
 * caller's location(s). Read-only for now; starting/stepping runs comes later.
 */
export async function getRecentRuns(limit = 20): Promise<QueryResult<RoutineRun>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routine_runs")
      .select(
        "id, routine_id, location_id, started_by, status, started_at, completed_at, notes, created_at, updated_at",
      )
      .order("started_at", { ascending: false })
      .limit(limit);

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as RoutineRun[], error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading runs.",
    };
  }
}
