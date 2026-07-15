"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { AppContext } from "@/lib/auth/context";
import type { TaskRunStatus } from "@/types/db";

const TASK_RUN_STATUSES: TaskRunStatus[] = [
  "pending",
  "completed",
  "skipped",
  "failed",
];

/**
 * Run execution is open to any location member (staff and up). RLS enforces
 * membership in the database; these helpers give clear UX. All writes use the
 * RLS-governed server client.
 */
async function requireMember(redirectTo = "/app/runs"): Promise<AppContext> {
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

/** Start a run of a routine: create the run and a task_run per routine task. */
export async function startRun(formData: FormData): Promise<void> {
  const ctx = await requireMember();
  const routineId = String(formData.get("routine_id") ?? "");
  if (!routineId) redirect("/app/routines");

  const supabase = createClient();

  // Confirm the routine is visible (RLS) and grab its tasks.
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("id")
    .eq("routine_id", routineId)
    .order("position", { ascending: true });

  if (tasksError) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent(tasksError.message)}`);
  }

  const { data: run, error: runError } = await supabase
    .from("routine_runs")
    .insert({
      routine_id: routineId,
      location_id: ctx.locationId,
      started_by: ctx.userId,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (runError || !run) {
    redirect(
      `/app/routines/${routineId}?error=${encodeURIComponent(runError?.message ?? "Could not start run.")}`,
    );
  }

  if (tasks && tasks.length > 0) {
    const taskRuns = tasks.map((t) => ({
      routine_run_id: run.id,
      task_id: t.id as string,
      status: "pending" as TaskRunStatus,
    }));
    const { error: trError } = await supabase.from("task_runs").insert(taskRuns);
    if (trError) {
      redirect(`/app/runs/${run.id}?error=${encodeURIComponent(trError.message)}`);
    }
  }

  redirect(`/app/runs/${run.id}`);
}

/** Capture or update a single task within a run. */
export async function saveTaskRun(formData: FormData): Promise<void> {
  const ctx = await requireMember();
  const taskRunId = String(formData.get("task_run_id") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  const status = asTaskRunStatus(String(formData.get("status") ?? "completed"));
  const valueText = emptyToNull(String(formData.get("value_text") ?? ""));
  const comment = emptyToNull(String(formData.get("comment") ?? ""));

  if (!taskRunId || !runId) redirect("/app/runs");

  const isDone = status === "completed" || status === "skipped" || status === "failed";

  const supabase = createClient();
  const { error } = await supabase
    .from("task_runs")
    .update({
      status,
      value_text: valueText,
      comment,
      completed_by: isDone ? ctx.userId : null,
      completed_at: isDone ? new Date().toISOString() : null,
    })
    .eq("id", taskRunId);

  if (error) {
    redirect(`/app/runs/${runId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/runs/${runId}`);
  redirect(`/app/runs/${runId}`);
}

/** Complete a run. Blocks if any required task is still pending. */
export async function completeRun(formData: FormData): Promise<void> {
  await requireMember();
  const runId = String(formData.get("run_id") ?? "");
  if (!runId) redirect("/app/runs");

  const supabase = createClient();

  // A required task blocks completion while its task_run is still pending.
  const { data: taskRuns, error: trError } = await supabase
    .from("task_runs")
    .select("status, task:tasks(is_required)")
    .eq("routine_run_id", runId);

  if (trError) {
    redirect(`/app/runs/${runId}?error=${encodeURIComponent(trError.message)}`);
  }

  const blocking = (taskRuns ?? []).some((tr) => {
    const row = tr as {
      status: string;
      task: { is_required: boolean } | { is_required: boolean }[] | null;
    };
    const task = Array.isArray(row.task) ? row.task[0] : row.task;
    return Boolean(task?.is_required) && row.status === "pending";
  });

  if (blocking) {
    redirect(
      `/app/runs/${runId}?error=${encodeURIComponent("Complete or skip all required tasks before finishing the run.")}`,
    );
  }

  const { error } = await supabase
    .from("routine_runs")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", runId);

  if (error) {
    redirect(`/app/runs/${runId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/runs/${runId}`);
  redirect(`/app/runs/${runId}`);
}

/** Abandon a run (e.g. started by mistake or the shift ended). */
export async function abandonRun(formData: FormData): Promise<void> {
  await requireMember();
  const runId = String(formData.get("run_id") ?? "");
  if (!runId) redirect("/app/runs");

  const supabase = createClient();
  const { error } = await supabase
    .from("routine_runs")
    .update({ status: "abandoned" })
    .eq("id", runId);

  if (error) {
    redirect(`/app/runs/${runId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/runs/${runId}`);
  redirect(`/app/runs/${runId}`);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asTaskRunStatus(value: string): TaskRunStatus {
  return (TASK_RUN_STATUSES as string[]).includes(value)
    ? (value as TaskRunStatus)
    : "completed";
}
