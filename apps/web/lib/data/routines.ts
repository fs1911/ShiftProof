import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { QueryResult, Routine } from "@/types/db";

/**
 * Thin read helper for routines. RLS scopes results to the caller's
 * location(s). Errors (including "Supabase not configured") are captured and
 * returned so callers can render a graceful notice instead of crashing.
 *
 * This is intentionally read-only for now — full CRUD comes in a later block.
 */
export async function getRoutines(): Promise<QueryResult<Routine>> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routines")
      .select(
        "id, location_id, name, description, frequency, is_active, created_at, updated_at",
      )
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as Routine[], error: null };
  } catch (err) {
    return { rows: [], error: toMessage(err) };
  }
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error loading routines.";
}
