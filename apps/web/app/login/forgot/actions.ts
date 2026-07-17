"use server";

import { redirect } from "next/navigation";

import { getAppBaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const PATH = "/login/forgot";

/**
 * Send a password-reset email. The link points at /auth/callback (which
 * exchanges the code for a session) and then on to /auth/update-password.
 *
 * Always redirects to the same confirmation regardless of whether the email
 * belongs to an account — never reveal which addresses are registered.
 */
export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) {
    redirect(`${PATH}?error=${encodeURIComponent("Enter your email address.")}`);
  }

  try {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAppBaseUrl()}/auth/callback?next=/auth/update-password`,
    });
  } catch {
    // Swallow all errors so the response can't be used to probe for accounts.
  }

  redirect(`${PATH}?sent=1`);
}
