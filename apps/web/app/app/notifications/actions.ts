"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManage, getAppContext } from "@/lib/auth/context";
import { generateAndSendDigest } from "@/lib/data/digest";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PATH = "/app/notifications";

/** Mark one of the current user's notifications as read (RLS scopes to self). */
export async function markRead(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect(PATH);

  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);

  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(PATH);
  redirect(PATH);
}

/** Mark all of the current user's notifications as read. */
export async function markAllRead(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("is_read", false);

  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(PATH);
  redirect(PATH);
}

/**
 * Generate today's due/overdue digest for the active location — creating in-app
 * notifications and (when email is configured) emailing opted-in owners/managers.
 * Manager/owner only: gated here, then run with the admin client because it must
 * write for other users and read their emails. Idempotent per day.
 */
export async function generateDigest(): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    redirect(`${PATH}?error=${encodeURIComponent("Your account is not assigned to a location yet.")}`);
  }
  if (!canManage(ctx.context.role)) {
    redirect(`${PATH}?error=${encodeURIComponent("Only managers and owners can generate the digest.")}`);
  }

  let errorMsg: string | null = null;
  try {
    const admin = createAdminClient();
    const outcome = await generateAndSendDigest(admin, ctx.context.locationId);
    errorMsg = outcome.error;
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : "Could not generate the digest.";
  }

  if (errorMsg) {
    redirect(`${PATH}?error=${encodeURIComponent(errorMsg)}`);
  }
  revalidatePath(PATH);
  redirect(PATH);
}

/** Toggle the current user's digest-email opt-in (RLS scopes to self). */
export async function setEmailOptIn(formData: FormData): Promise<void> {
  const optIn = formData.get("notify_email") != null;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("users")
    .update({ notify_email: optIn })
    .eq("id", user.id);

  if (error) redirect(`${PATH}?error=${encodeURIComponent(error.message)}`);
  revalidatePath(PATH);
  redirect(PATH);
}
