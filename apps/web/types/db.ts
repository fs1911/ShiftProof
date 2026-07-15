/**
 * Minimal TypeScript shapes for the core ShiftProof entities.
 *
 * These mirror supabase/schema.sql and docs/DATA_MODEL.md. They are a
 * hand-written first pass covering only the fields the current scaffold reads.
 * Once the schema stabilizes, replace this file with generated types
 * (`supabase gen types typescript`).
 */

export type UserRole = "owner" | "manager" | "staff";
export type RoutineFrequency = "daily" | "weekly" | "monthly" | "ad_hoc";
export type TaskType = "checkbox" | "value" | "photo" | "comment";
export type RoutineRunStatus = "in_progress" | "completed" | "abandoned";
export type TaskRunStatus = "pending" | "completed" | "skipped" | "failed";
export type ExceptionSeverity = "low" | "medium" | "high";
export type ExceptionStatus = "open" | "in_progress" | "resolved";

export interface Routine {
  id: string;
  location_id: string;
  name: string;
  description: string | null;
  frequency: RoutineFrequency;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  routine_id: string;
  title: string;
  instructions: string | null;
  task_type: TaskType;
  is_required: boolean;
  requires_photo: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface RoutineWithTasks extends Routine {
  tasks: Task[];
}

export interface RoutineRun {
  id: string;
  routine_id: string;
  location_id: string;
  started_by: string;
  status: RoutineRunStatus;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskRun {
  id: string;
  routine_run_id: string;
  task_id: string;
  status: TaskRunStatus;
  value_text: string | null;
  comment: string | null;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A task_run joined with its task definition, for the run detail screen. */
export interface TaskRunWithTask extends TaskRun {
  task: Task | null;
}

/** A run joined with its routine name and its task_runs. */
export interface RunDetail extends RoutineRun {
  routine_name: string | null;
  task_runs: TaskRunWithTask[];
}

/** A run row joined with its routine name, for list views. */
export interface RoutineRunListItem extends RoutineRun {
  routine_name: string | null;
}

export interface Photo {
  id: string;
  task_run_id: string;
  location_id: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string;
  created_at: string;
}

/** A photo plus a short-lived signed URL for display (generated server-side). */
export interface PhotoWithUrl extends Photo {
  signed_url: string | null;
}

export interface ExceptionRecord {
  id: string;
  location_id: string;
  routine_run_id: string | null;
  task_run_id: string | null;
  title: string;
  description: string | null;
  severity: ExceptionSeverity;
  status: ExceptionStatus;
  raised_by: string;
  assigned_to: string | null;
  resolution_note: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Uniform result wrapper for the thin data-access layer. `error` is a
 * human-readable message when a query could not be completed (e.g. Supabase
 * not yet configured), so pages can render a graceful empty/notice state.
 */
export interface QueryResult<T> {
  rows: T[];
  error: string | null;
}
