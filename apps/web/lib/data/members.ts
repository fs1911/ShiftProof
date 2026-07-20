import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/db";

export interface LocationMember {
  userId: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  /** Auth status (from auth.users via the SECURITY DEFINER RPC, server-only). */
  confirmed: boolean;
  lastSignInAt: string | null;
  /** Invited but hasn't confirmed/accepted yet. */
  pending: boolean;
}

export interface OwnedLocation {
  id: string;
  name: string;
  timezone: string;
  isActive: boolean;
}

/**
 * Members of a location, via the list_location_members SECURITY DEFINER RPC
 * (manager+ only, enforced in the function). Returns co-members' emails, which
 * the users_select_self policy would otherwise hide.
 */
export async function getLocationMembers(
  locationId: string,
): Promise<{ members: LocationMember[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("list_location_members", {
      p_location_id: locationId,
    });
    if (error) return { members: [], error: error.message };

    const rows = (data ?? []) as {
      user_id: string;
      email: string;
      full_name: string | null;
      role: UserRole;
      confirmed: boolean;
      last_sign_in_at: string | null;
    }[];
    const members = rows.map((r) => ({
      userId: r.user_id,
      email: r.email,
      fullName: r.full_name,
      role: r.role,
      confirmed: r.confirmed,
      lastSignInAt: r.last_sign_in_at,
      pending: !r.confirmed,
    }));
    return { members, error: null };
  } catch (err) {
    return {
      members: [],
      error: err instanceof Error ? err.message : "Unknown error loading members.",
    };
  }
}

/** Locations the current user owns (for the locations-management screen). */
export async function getOwnedLocations(): Promise<{
  locations: OwnedLocation[];
  error: string | null;
}> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("user_locations")
      .select("role, location:locations(id, name, timezone, is_active)")
      .eq("role", "owner");

    if (error) return { locations: [], error: error.message };

    const locations = (data ?? [])
      .map((row) => {
        const r = row as {
          location:
            | { id: string; name: string; timezone: string; is_active: boolean }
            | { id: string; name: string; timezone: string; is_active: boolean }[]
            | null;
        };
        const loc = Array.isArray(r.location) ? r.location[0] : r.location;
        return loc
          ? {
              id: loc.id,
              name: loc.name,
              timezone: loc.timezone,
              isActive: loc.is_active,
            }
          : null;
      })
      .filter((l): l is OwnedLocation => l !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return { locations, error: null };
  } catch (err) {
    return {
      locations: [],
      error: err instanceof Error ? err.message : "Unknown error loading locations.",
    };
  }
}
