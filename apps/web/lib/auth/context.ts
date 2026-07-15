import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

/**
 * The signed-in user's working context for a request: who they are, the
 * location they're acting in, and their role there.
 *
 * MVP simplification: a user may belong to several locations, but there is no
 * location switcher yet — we act in the earliest-joined membership. A proper
 * active-location selector is a deferred enhancement.
 */
export interface AppContext {
  userId: string;
  email: string | null;
  locationId: string;
  role: UserRole;
}

export type ContextResult =
  | { ok: true; context: AppContext }
  | { ok: false; reason: "unauthenticated" | "no_membership" | "error"; message: string | null };

/** Resolve the current user's working context, or an explanatory failure. */
export async function getAppContext(): Promise<ContextResult> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, reason: "unauthenticated", message: null };
    }

    const { data, error } = await supabase
      .from("user_locations")
      .select("location_id, role")
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      return { ok: false, reason: "error", message: error.message };
    }
    if (!data || data.length === 0) {
      return { ok: false, reason: "no_membership", message: null };
    }

    return {
      ok: true,
      context: {
        userId: user.id,
        email: user.email ?? null,
        locationId: data[0].location_id as string,
        role: data[0].role as UserRole,
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      message: err instanceof Error ? err.message : "Unknown error resolving context.",
    };
  }
}

/** True for roles allowed to author routines/tasks and triage exceptions. */
export function canManage(role: UserRole): boolean {
  return role === "owner" || role === "manager";
}
