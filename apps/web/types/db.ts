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
export type RoutineRunStatus = "in_progress" | "completed" | "abandoned";
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
