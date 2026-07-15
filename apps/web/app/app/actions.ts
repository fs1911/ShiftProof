"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ACTIVE_LOCATION_COOKIE, getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";

/** Signs the current user out and returns them to the login page. */
export async function signOut(): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch {
    // Even if sign-out fails server-side, send the user to /login; the
    // middleware will re-guard protected routes on the next request.
  }
  redirect("/login");
}

/**
 * Switch the active location. The requested id is only accepted when it names
 * a location the user actually belongs to (never trust the client), then it is
 * stored in an HTTP-only cookie for subsequent requests.
 */
export async function setActiveLocation(formData: FormData): Promise<void> {
  const locationId = String(formData.get("location_id") ?? "");
  const redirectTo = safeInternal(String(formData.get("redirect_to") ?? "/app/dashboard"));

  const result = await getAppContext();
  const allowed =
    result.ok && result.context.memberships.some((m) => m.locationId === locationId);

  if (allowed) {
    cookies().set(ACTIVE_LOCATION_COOKIE, locationId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  redirect(redirectTo);
}

/** Only allow redirects that stay inside the protected app area. */
function safeInternal(target: string): string {
  return target.startsWith("/app") ? target : "/app/dashboard";
}
