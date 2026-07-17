"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/**
 * Email + password sign-in (MVP auth foundation).
 *
 * Dependency note: this requires the Supabase project to have email/password
 * auth enabled and at least one user provisioned. Password reset lives in
 * /login/forgot + /auth/update-password (via /auth/callback). Self-serve
 * sign-up and magic-link flows remain deferred.
 */
export async function signIn(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/app/dashboard");

  if (!email || !password) {
    redirect(`/login?error=${encodeURIComponent("Enter your email and password.")}`);
  }

  let signInError: string | null = null;
  try {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) signInError = error.message;
  } catch (err) {
    signInError =
      err instanceof Error ? err.message : "Sign-in is not available right now.";
  }

  if (signInError) {
    redirect(`/login?error=${encodeURIComponent(signInError)}`);
  }

  redirect(safeRedirect(redirectTo));
}

/** Only allow internal redirects back into the app area. */
function safeRedirect(target: string): string {
  return target.startsWith("/app") ? target : "/app/dashboard";
}
