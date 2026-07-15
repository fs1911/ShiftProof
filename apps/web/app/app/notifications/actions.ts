"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManage, getAppContext } from "@/lib/auth/context";
import { getDueRoutines } from "@/lib/data/schedule";
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
 * Generate today's due/overdue digest for the active location. The figures are
 * computed here (lib/data/schedule.ts — the single source of truth), then the
 * create_digest_notifications RPC fans a summary out to every owner/manager,
 * idempotently per day. Manager/owner only.
 */
export async function generateDigest(): Promise<void> {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    redirect(`${PATH}?error=${encodeURIComponent("Your account is not assigned to a location yet.")}`);
  }
  if (!canManage(ctx.context.role)) {
    redirect(`${PATH}?error=${encodeURIComponent("Only managers and owners can generate the digest.")}`);
  }

  const due = await getDueRoutines(ctx.context.locationId);
  if (due.error) {
    redirect(`${PATH}?error=${encodeURIComponent(due.error)}`);
  }

  const overdue = due.routines.filter((r) => r.status === "overdue").length;
  const dueCount = due.routines.filter((r) => r.status === "due").length;
  const done = due.routines.filter((r) => r.status === "done").length;

  const title = `Due digest — ${due.date}`;
  const body = `${dueCount} due, ${overdue} overdue, ${done} done at ${ctx.context.locationName}.`;

  const supabase = createClient();
  const { error } = await supabase.rpc("create_digest_notifications", {
    p_location_id: ctx.context.locationId,
    p_date: due.date,
    p_title: title,
    p_body: body,
  });

  if (error) {
    const message = error.message.includes("NOT_ALLOWED")
      ? "You don't have permission to do that."
      : error.message;
    redirect(`${PATH}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(PATH);
  redirect(PATH);
}
