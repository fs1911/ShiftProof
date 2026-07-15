"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/auth/context";
import type { ExceptionSeverity, ExceptionStatus } from "@/types/db";

const SEVERITIES: ExceptionSeverity[] = ["low", "medium", "high"];
const STATUSES: ExceptionStatus[] = ["open", "in_progress", "resolved"];

/**
 * Raising an exception is open to any location member. Triage/resolution is
 * limited by RLS to the raiser or a manager+. All writes use the RLS-governed
 * server client.
 */
async function requireMember(redirectTo = "/app/exceptions"): Promise<AppContext> {
  const result = await getAppContext();
  if (!result.ok) {
    const message =
      result.reason === "no_membership"
        ? "Your account is not assigned to a location yet."
        : "Could not verify your access. Please sign in again.";
    redirect(`${redirectTo}?error=${encodeURIComponent(message)}`);
  }
  return result.context;
}

/** Raise a new exception, optionally linked to a run and/or task run. */
export async function raiseException(formData: FormData): Promise<void> {
  const ctx = await requireMember();
  const title = String(formData.get("title") ?? "").trim();
  const description = emptyToNull(String(formData.get("description") ?? ""));
  const severity = asSeverity(String(formData.get("severity") ?? "medium"));
  const routineRunId = emptyToNull(String(formData.get("routine_run_id") ?? ""));
  const taskRunId = emptyToNull(String(formData.get("task_run_id") ?? ""));
  const redirectTo = safeInternal(String(formData.get("redirect_to") ?? "/app/exceptions"));

  if (!title) {
    redirect(`${redirectTo}?error=${encodeURIComponent("A short title is required.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase.from("exceptions").insert({
    location_id: ctx.locationId,
    routine_run_id: routineRunId,
    task_run_id: taskRunId,
    title,
    description,
    severity,
    status: "open",
    raised_by: ctx.userId,
  });

  if (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

/**
 * Move an exception through its lifecycle. Resolving requires a resolution note
 * and stamps resolver + timestamp; re-opening clears those fields.
 */
export async function setExceptionStatus(formData: FormData): Promise<void> {
  const ctx = await requireMember();
  const id = String(formData.get("id") ?? "");
  const status = asStatus(String(formData.get("status") ?? ""));
  const resolutionNote = emptyToNull(String(formData.get("resolution_note") ?? ""));
  const redirectTo = safeInternal(
    String(formData.get("redirect_to") ?? `/app/exceptions/${id}`),
  );

  if (!id) redirect("/app/exceptions");

  if (status === "resolved" && !resolutionNote) {
    redirect(
      `${redirectTo}?error=${encodeURIComponent("Add a resolution note before resolving.")}`,
    );
  }

  const patch =
    status === "resolved"
      ? {
          status,
          resolution_note: resolutionNote,
          resolved_by: ctx.userId,
          resolved_at: new Date().toISOString(),
        }
      : {
          status,
          resolved_by: null,
          resolved_at: null,
        };

  const supabase = createClient();
  const { error } = await supabase.from("exceptions").update(patch).eq("id", id);

  if (error) {
    redirect(`${redirectTo}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(redirectTo);
  redirect(redirectTo);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asSeverity(value: string): ExceptionSeverity {
  return (SEVERITIES as string[]).includes(value)
    ? (value as ExceptionSeverity)
    : "medium";
}

function asStatus(value: string): ExceptionStatus {
  return (STATUSES as string[]).includes(value) ? (value as ExceptionStatus) : "open";
}

/** Only permit redirects that stay inside the app area. */
function safeInternal(target: string): string {
  return target.startsWith("/app") ? target : "/app/exceptions";
}
