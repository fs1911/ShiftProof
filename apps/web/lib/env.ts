/**
 * Environment access for ShiftProof.
 *
 * Values are read lazily through functions (not at module load) so that the
 * app builds even when variables are absent, but fails clearly the moment a
 * required value is actually needed at request time.
 *
 * Secret handling:
 *  - NEXT_PUBLIC_* values are safe to expose to the browser.
 *  - SUPABASE_SERVICE_ROLE_KEY is server-only and must never be imported into
 *    a client component. It is read exclusively by lib/supabase/admin.ts.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim().length === 0) {
    throw new Error(
      `[shiftproof] Missing required environment variable: ${name}. ` +
        `Set it in Railway (or your environment) — see .env.example.`,
    );
  }
  return value;
}

/** Supabase project URL (public). */
export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/** Supabase anonymous key (public, RLS-governed). */
export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

/** Supabase service-role key (server-only, bypasses RLS — use sparingly). */
export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** Public base URL of the deployed app; falls back to localhost in dev. */
export function getAppBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}
