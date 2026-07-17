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

  // Load the task definition once (for photo enforcement + value-range check).
  const { data: taskRunRow } = await supabase
    .from("task_runs")
    .select("task:tasks(title, task_type, requires_photo, value_min, value_max, value_unit)")
    .eq("id", taskRunId)
    .maybeSingle();
  const taskField = (taskRunRow as { task: TaskSpec | TaskSpec[] | null } | null)?.task;
  const task = (Array.isArray(taskField) ? taskField[0] : taskField) ?? null;

  // Enforce requires_photo: a photo task cannot be marked "completed" without
  // at least one attached photo. Skipped/failed are allowed (the proof gap is
  // captured by the status itself).
  if (status === "completed" && task?.requires_photo) {
    const { count } = await supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("task_run_id", taskRunId);
    if (!count || count === 0) {
      redirect(
        `/app/runs/${runId}?error=${encodeURIComponent("This task requires a photo before it can be marked done.")}`,
      );
    }
  }

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

  // Auto-flag an out-of-range reading as an exception (best-effort, idempotent).
  await maybeFlagOutOfRange(supabase, ctx, { runId, taskRunId, task, valueText });

  revalidatePath(`/app/runs/${runId}`);
  redirect(`/app/runs/${runId}`);
}

interface TaskSpec {
  title: string;
  task_type: string;
  requires_photo: boolean;
  value_min: number | null;
  value_max: number | null;
  value_unit: string | null;
}

const OUT_OF_RANGE_PREFIX = "Out-of-range:";

/**
 * When a `value` task with a target range gets a reading outside it, raise an
 * exception automatically. Idempotent: skips if an unresolved out-of-range
 * exception already exists for this task_run, so re-saving never stacks
 * duplicates. Best-effort — a failure here never blocks the capture itself.
 */
async function maybeFlagOutOfRange(
  supabase: ReturnType<typeof createClient>,
  ctx: AppContext,
  args: { runId: string; taskRunId: string; task: TaskSpec | null; valueText: string | null },
): Promise<void> {
  const { task, valueText, runId, taskRunId } = args;
  if (!task || task.task_type !== "value") return;
  if (task.value_min == null && task.value_max == null) return;

  const reading = parseReading(valueText);
  if (reading == null) return;

  const outside =
    (task.value_min != null && reading < task.value_min) ||
    (task.value_max != null && reading > task.value_max);
  if (!outside) return;

  const { count } = await supabase
    .from("exceptions")
    .select("id", { count: "exact", head: true })
    .eq("task_run_id", taskRunId)
    .ilike("title", `${OUT_OF_RANGE_PREFIX}%`)
    .in("status", ["open", "in_progress"]);
  if (count && count > 0) return;

  const unit = task.value_unit ? ` ${task.value_unit}` : "";
  const range =
    task.value_min != null && task.value_max != null
      ? `${task.value_min}–${task.value_max}${unit}`
      : task.value_min != null
        ? `≥ ${task.value_min}${unit}`
        : `≤ ${task.value_max}${unit}`;

  await supabase.from("exceptions").insert({
    location_id: ctx.locationId,
    routine_run_id: runId,
    task_run_id: taskRunId,
    title: `${OUT_OF_RANGE_PREFIX} ${task.title}`,
    description: `Captured "${valueText}" — outside target ${range}.`,
    severity: "high",
    status: "open",
    raised_by: ctx.userId,
  });
}

/** Extract the first numeric token from a free-form reading (accepts comma). */
function parseReading(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return match ? Number.parseFloat(match[0]) : null;
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

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Upload a proof photo for a task run. The binary goes to Storage under
 * <location_id>/<task_run_id>/<uuid-filename>; a photos row records the
 * reference. Both are governed by RLS (never the service-role key). Photos are
 * immutable — there is no edit, only add and (manager) delete.
 */
export async function uploadPhoto(formData: FormData): Promise<void> {
  const ctx = await requireMember();
  const taskRunId = String(formData.get("task_run_id") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  const caption = emptyToNull(String(formData.get("caption") ?? ""));
  const file = formData.get("photo");

  if (!taskRunId || !runId) redirect("/app/runs");

  const runPath = `/app/runs/${runId}`;
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${runPath}?error=${encodeURIComponent("Choose a photo to upload.")}`);
  }
  const photo = file as File;
  if (!photo.type.startsWith("image/")) {
    redirect(`${runPath}?error=${encodeURIComponent("Only image files can be uploaded.")}`);
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    redirect(`${runPath}?error=${encodeURIComponent("Photo must be 10 MB or smaller.")}`);
  }

  const supabase = createClient();
  const objectName = `${ctx.locationId}/${taskRunId}/${crypto.randomUUID()}-${safeFilename(photo.name)}`;

  const { error: uploadError } = await supabase.storage
    .from("shift-photos")
    .upload(objectName, photo, { contentType: photo.type, upsert: false });

  if (uploadError) {
    redirect(`${runPath}?error=${encodeURIComponent(uploadError.message)}`);
  }

  const { error: insertError } = await supabase.from("photos").insert({
    task_run_id: taskRunId,
    location_id: ctx.locationId,
    storage_path: objectName,
    caption,
    uploaded_by: ctx.userId,
  });

  if (insertError) {
    // Best-effort cleanup so we don't leave an orphaned object behind.
    await supabase.storage.from("shift-photos").remove([objectName]);
    redirect(`${runPath}?error=${encodeURIComponent(insertError.message)}`);
  }

  revalidatePath(runPath);
  redirect(runPath);
}

/** Delete a proof photo (manager+ per RLS on both the row and the object). */
export async function deletePhoto(formData: FormData): Promise<void> {
  await requireMember();
  const photoId = String(formData.get("photo_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const runId = String(formData.get("run_id") ?? "");
  if (!photoId || !runId) redirect("/app/runs");

  const runPath = `/app/runs/${runId}`;
  const supabase = createClient();

  const { error } = await supabase.from("photos").delete().eq("id", photoId);
  if (error) {
    redirect(`${runPath}?error=${encodeURIComponent(error.message)}`);
  }
  // Remove the binary too; RLS allows managers. Best-effort.
  if (storagePath) {
    await supabase.storage.from("shift-photos").remove([storagePath]);
  }

  revalidatePath(runPath);
  redirect(runPath);
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

/** Keep only a safe tail of the original filename for readability. */
function safeFilename(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9.\-_]/g, "-");
  return cleaned.slice(-60) || "photo";
}
