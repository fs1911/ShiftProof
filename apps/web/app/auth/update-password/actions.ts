"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

const PATH = "/auth/update-password";
const MIN_LENGTH = 8;

/**
 * Set a new password for the currently-authenticated user. Reached only after
 * /auth/callback has exchanged a recovery (or invite) code for a session, so
 * the user is authenticated as themselves here. On success they land in the app.
 */
export async function updatePassword(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < MIN_LENGTH) {
    redirect(`${PATH}?error=${encodeURIComponent(`Use at least ${MIN_LENGTH} characters.`)}`);
  }
  if (password !== confirm) {
    redirect(`${PATH}?error=${encodeURIComponent("The two passwords do not match.")}`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // No active recovery/invite session — the link expired or was already used.
  if (!user) {
    redirect(`/login?error=${encodeURIComponent("Your link expired. Request a new one.")}`);
  }

  let errorMsg: string | null = null;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) errorMsg = error.message;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Could not update your password.";
  }

  if (errorMsg) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMsg)}`);
  }
  redirect("/app/dashboard");
}
