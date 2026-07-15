"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { canManage, getAppContext } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import type { RoutineFrequency, TaskType } from "@/types/db";

const FREQUENCIES: RoutineFrequency[] = ["daily", "weekly", "monthly", "ad_hoc"];
const TASK_TYPES: TaskType[] = ["checkbox", "value", "photo", "comment"];

/**
 * All routine/task writes are manager+ only. RLS enforces the same rule in the
 * database (policies.sql); these checks provide clear UX and defense-in-depth.
 * Writes use the RLS-governed server client — never the service-role key.
 */
async function requireManager() {
  const result = await getAppContext();
  if (!result.ok) {
    redirect(`/app/routines?error=${encodeURIComponent(contextError(result.reason))}`);
  }
  if (!canManage(result.context.role)) {
    redirect(
      `/app/routines?error=${encodeURIComponent("Only managers and owners can manage routines.")}`,
    );
  }
  return result.context;
}

function contextError(reason: string): string {
  return reason === "no_membership"
    ? "Your account is not assigned to a location yet."
    : "Could not verify your access. Please sign in again.";
}

export async function createRoutine(formData: FormData): Promise<void> {
  const ctx = await requireManager();
  const name = String(formData.get("name") ?? "").trim();
  const description = emptyToNull(String(formData.get("description") ?? ""));
  const frequency = asFrequency(String(formData.get("frequency") ?? "daily"));

  if (!name) {
    redirect(`/app/routines/new?error=${encodeURIComponent("Name is required.")}`);
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("routines")
    .insert({
      location_id: ctx.locationId,
      name,
      description,
      frequency,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/app/routines/new?error=${encodeURIComponent(error?.message ?? "Could not create routine.")}`,
    );
  }

  redirect(`/app/routines/${data.id}`);
}

export async function updateRoutine(formData: FormData): Promise<void> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = emptyToNull(String(formData.get("description") ?? ""));
  const frequency = asFrequency(String(formData.get("frequency") ?? "daily"));

  if (!id) redirect("/app/routines");
  if (!name) {
    redirect(`/app/routines/${id}?error=${encodeURIComponent("Name is required.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("routines")
    .update({ name, description, frequency })
    .eq("id", id);

  if (error) {
    redirect(`/app/routines/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/routines/${id}`);
  redirect(`/app/routines/${id}`);
}

export async function setRoutineActive(formData: FormData): Promise<void> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const isActive = String(formData.get("is_active") ?? "") === "true";
  if (!id) redirect("/app/routines");

  const supabase = createClient();
  const { error } = await supabase
    .from("routines")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) {
    redirect(`/app/routines/${id}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/routines/${id}`);
  redirect(`/app/routines/${id}`);
}

export async function createTask(formData: FormData): Promise<void> {
  await requireManager();
  const routineId = String(formData.get("routine_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructions = emptyToNull(String(formData.get("instructions") ?? ""));
  const taskType = asTaskType(String(formData.get("task_type") ?? "checkbox"));
  const isRequired = formData.get("is_required") != null;
  const requiresPhoto = formData.get("requires_photo") != null;

  if (!routineId) redirect("/app/routines");
  if (!title) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent("Task title is required.")}`);
  }

  const supabase = createClient();

  // Append to the end: next position after the current max for this routine.
  const { data: last } = await supabase
    .from("tasks")
    .select("position")
    .eq("routine_id", routineId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = last ? (last.position as number) + 1 : 0;

  const { error } = await supabase.from("tasks").insert({
    routine_id: routineId,
    title,
    instructions,
    task_type: taskType,
    is_required: isRequired,
    requires_photo: requiresPhoto,
    position: nextPosition,
  });

  if (error) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/routines/${routineId}`);
  redirect(`/app/routines/${routineId}`);
}

export async function updateTask(formData: FormData): Promise<void> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const routineId = String(formData.get("routine_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const instructions = emptyToNull(String(formData.get("instructions") ?? ""));
  const taskType = asTaskType(String(formData.get("task_type") ?? "checkbox"));
  const isRequired = formData.get("is_required") != null;
  const requiresPhoto = formData.get("requires_photo") != null;

  if (!id || !routineId) redirect("/app/routines");
  if (!title) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent("Task title is required.")}`);
  }

  const supabase = createClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      title,
      instructions,
      task_type: taskType,
      is_required: isRequired,
      requires_photo: requiresPhoto,
    })
    .eq("id", id);

  if (error) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/routines/${routineId}`);
  redirect(`/app/routines/${routineId}`);
}

export async function deleteTask(formData: FormData): Promise<void> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const routineId = String(formData.get("routine_id") ?? "");
  if (!id || !routineId) redirect("/app/routines");

  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", id);

  if (error) {
    redirect(`/app/routines/${routineId}?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`/app/routines/${routineId}`);
  redirect(`/app/routines/${routineId}`);
}

/** Swap a task's position with its neighbor in the given direction. */
export async function moveTask(formData: FormData): Promise<void> {
  await requireManager();
  const id = String(formData.get("id") ?? "");
  const routineId = String(formData.get("routine_id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || !routineId || (direction !== "up" && direction !== "down")) {
    redirect(`/app/routines/${routineId || ""}`);
  }

  const supabase = createClient();
  const { data: current } = await supabase
    .from("tasks")
    .select("id, position")
    .eq("id", id)
    .maybeSingle();

  if (!current) {
    redirect(`/app/routines/${routineId}`);
  }

  const currentPos = current.position as number;
  const neighborQuery = supabase
    .from("tasks")
    .select("id, position")
    .eq("routine_id", routineId);

  const { data: neighbor } =
    direction === "up"
      ? await neighborQuery
          .lt("position", currentPos)
          .order("position", { ascending: false })
          .limit(1)
          .maybeSingle()
      : await neighborQuery
          .gt("position", currentPos)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();

  if (neighbor) {
    // Non-unique position index allows a direct two-step swap.
    await supabase
      .from("tasks")
      .update({ position: neighbor.position as number })
      .eq("id", current.id);
    await supabase
      .from("tasks")
      .update({ position: currentPos })
      .eq("id", neighbor.id);
  }

  revalidatePath(`/app/routines/${routineId}`);
  redirect(`/app/routines/${routineId}`);
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function asFrequency(value: string): RoutineFrequency {
  return (FREQUENCIES as string[]).includes(value)
    ? (value as RoutineFrequency)
    : "daily";
}

function asTaskType(value: string): TaskType {
  return (TASK_TYPES as string[]).includes(value) ? (value as TaskType) : "checkbox";
}
