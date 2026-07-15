import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

/** Cookie holding the user's chosen active location (validated server-side). */
export const ACTIVE_LOCATION_COOKIE = "sp_active_location";

/** One of the user's location memberships (for the switcher). */
export interface LocationMembership {
  locationId: string;
  role: UserRole;
  name: string;
}

/**
 * The signed-in user's working context for a request: who they are, the
 * location they are currently acting in, their role there, and the full list
 * of locations they belong to.
 *
 * The active location is chosen from the `sp_active_location` cookie when it
 * names a location the user is a member of; otherwise it defaults to the
 * earliest-joined membership. Screens and Server Actions scope reads/writes to
 * `locationId` so a user acting in location A never sees or writes location B —
 * even though RLS would permit both of their own locations.
 */
export interface AppContext {
  userId: string;
  email: string | null;
  locationId: string;
  locationName: string;
  role: UserRole;
  memberships: LocationMembership[];
}

export type ContextResult =
  | { ok: true; context: AppContext }
  | {
      ok: false;
      reason: "unauthenticated" | "no_membership" | "error";
      message: string | null;
    };

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
      .select("location_id, role, location:locations(name)")
      .order("created_at", { ascending: true });

    if (error) {
      return { ok: false, reason: "error", message: error.message };
    }
    if (!data || data.length === 0) {
      return { ok: false, reason: "no_membership", message: null };
    }

    const memberships: LocationMembership[] = data.map((row) => {
      const r = row as {
        location_id: string;
        role: UserRole;
        location: { name: string } | { name: string }[] | null;
      };
      const location = Array.isArray(r.location) ? r.location[0] : r.location;
      return {
        locationId: r.location_id,
        role: r.role,
        name: location?.name ?? "Location",
      };
    });

    // Pick the active location from the cookie when valid, else the earliest.
    const cookieValue = cookies().get(ACTIVE_LOCATION_COOKIE)?.value;
    const active =
      memberships.find((m) => m.locationId === cookieValue) ?? memberships[0];

    return {
      ok: true,
      context: {
        userId: user.id,
        email: user.email ?? null,
        locationId: active.locationId,
        locationName: active.name,
        role: active.role,
        memberships,
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
