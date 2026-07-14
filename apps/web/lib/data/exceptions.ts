import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExceptionRecord, QueryResult } from "@/types/db";

/**
 * Thin read helper for exceptions. RLS scopes results to the caller's
 * location(s). Pass `openOnly` to fetch just unresolved items (used by the
 * dashboard). Triage/resolution actions come in a later block.
 */
export async function getExceptions(
  openOnly = false,
  limit = 50,
): Promise<QueryResult<ExceptionRecord>> {
  try {
    const supabase = createClient();
    let query = supabase
      .from("exceptions")
      .select(
        "id, location_id, routine_run_id, task_run_id, title, description, severity, status, raised_by, assigned_to, resolution_note, resolved_by, resolved_at, created_at, updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(limit);

    if (openOnly) {
      query = query.in("status", ["open", "in_progress"]);
    }

    const { data, error } = await query;
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as ExceptionRecord[], error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading exceptions.",
    };
  }
}
