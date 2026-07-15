import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { getAppBaseUrl } from "@/lib/env";
import { getDueRoutines } from "@/lib/data/schedule";
import { isEmailConfigured, sendEmail } from "@/lib/email/resend";

export interface DigestOutcome {
  locationId: string;
  date: string;
  recipients: number;
  emailed: number;
  error: string | null;
}

/**
 * Generate the due/overdue digest for one location: create in-app notifications
 * for every owner/manager (idempotent per day) and, when enabled, email the
 * opted-in recipients (recording emailed_at so a re-run never double-sends).
 *
 * Runs with the ADMIN client (service-role) because it must insert notifications
 * for other users and read their emails — impossible under RLS. It is only ever
 * called server-side: from the CRON route (shared-secret protected) or from an
 * app action AFTER the caller is verified as a manager/owner of the location.
 */
export async function generateAndSendDigest(
  admin: SupabaseClient,
  locationId: string,
  opts: { date?: string; sendEmails?: boolean } = {},
): Promise<DigestOutcome> {
  const sendEmails = opts.sendEmails ?? true;

  const { data: loc } = await admin
    .from("locations")
    .select("name")
    .eq("id", locationId)
    .maybeSingle();
  const locationName = (loc as { name?: string } | null)?.name ?? "your location";

  const due = await getDueRoutines(locationId, opts.date, admin);
  if (due.error) {
    return { locationId, date: due.date, recipients: 0, emailed: 0, error: due.error };
  }

  const overdue = due.routines.filter((r) => r.status === "overdue").length;
  const dueCount = due.routines.filter((r) => r.status === "due").length;
  const done = due.routines.filter((r) => r.status === "done").length;
  const title = `Due digest — ${due.date}`;
  const body = `${dueCount} due, ${overdue} overdue, ${done} done at ${locationName}.`;
  const dedupeKey = `due_digest:${due.date}`;

  // Recipients: owners + managers of the location.
  const { data: memberRows, error: memberError } = await admin
    .from("user_locations")
    .select("user_id")
    .eq("location_id", locationId)
    .in("role", ["owner", "manager"]);
  if (memberError) {
    return { locationId, date: due.date, recipients: 0, emailed: 0, error: memberError.message };
  }
  const recipientIds = (memberRows ?? []).map((r) => (r as { user_id: string }).user_id);
  if (recipientIds.length === 0) {
    return { locationId, date: due.date, recipients: 0, emailed: 0, error: null };
  }

  // Create in-app notifications idempotently (one per recipient per day).
  const payload = recipientIds.map((userId) => ({
    location_id: locationId,
    user_id: userId,
    type: "due_digest",
    title,
    body,
    dedupe_key: dedupeKey,
  }));
  const { error: upsertError } = await admin
    .from("notifications")
    .upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  if (upsertError) {
    return { locationId, date: due.date, recipients: recipientIds.length, emailed: 0, error: upsertError.message };
  }

  let emailed = 0;
  if (sendEmails && isEmailConfigured()) {
    // Pending = this digest's notifications not yet emailed, joined to the
    // recipient's email + opt-in flag.
    const { data: pending } = await admin
      .from("notifications")
      .select("id, user:users(email, notify_email)")
      .eq("location_id", locationId)
      .eq("dedupe_key", dedupeKey)
      .is("emailed_at", null);

    for (const row of pending ?? []) {
      const r = row as {
        id: string;
        user: { email: string; notify_email: boolean } | { email: string; notify_email: boolean }[] | null;
      };
      const user = Array.isArray(r.user) ? r.user[0] : r.user;
      if (!user?.email || user.notify_email === false) continue;

      const result = await sendEmail({
        to: user.email,
        subject: title,
        html: digestHtml(title, body),
        text: body,
      });
      if (result.ok) {
        await admin
          .from("notifications")
          .update({ emailed_at: new Date().toISOString() })
          .eq("id", r.id);
        emailed += 1;
      }
    }
  }

  return { locationId, date: due.date, recipients: recipientIds.length, emailed, error: null };
}

function digestHtml(title: string, body: string): string {
  const url = `${getAppBaseUrl()}/app/notifications`;
  return `
    <div style="font-family:system-ui,sans-serif;color:#0f172a;max-width:520px">
      <h2 style="margin:0 0 8px">${escapeHtml(title)}</h2>
      <p style="margin:0 0 16px;color:#334155">${escapeHtml(body)}</p>
      <a href="${url}" style="display:inline-block;background:#1f57e6;color:#fff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:14px">Open ShiftProof</a>
    </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
