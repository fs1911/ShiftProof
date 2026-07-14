"use server";

import { redirect } from "next/navigation";

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
