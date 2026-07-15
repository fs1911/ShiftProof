import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES Row Level Security.
 *
 * SERVER-ONLY. Never import this into a Client Component. Use only for
 * trusted, privileged operations that genuinely cannot run under RLS
 * (e.g. provisioning during onboarding). Prefer the RLS-governed server
 * client (lib/supabase/server.ts) for everything else.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[shiftproof] createAdminClient() must never be called in the browser.",
    );
  }

  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
