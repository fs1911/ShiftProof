import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExceptionSeverity, ExceptionStatus, RoutineRunStatus } from "@/types/db";

/**
 * Read-only reporting helpers. All queries are scoped to the active location
 * and a date range, and run through the RLS-governed server client (never the
 * service-role key). Aggregation is done in JS to avoid extra dependencies or
 * database RPCs; result sets are capped (see MAX_ROWS) for the reporting MVP.
 */

const MAX_ROWS = 2000;

export interface ReportRange {
  from: string; // YYYY-MM-DD (inclusive)
  to: string; // YYYY-MM-DD (inclusive)
  fromISO: string;
  toISO: string;
  /** Filename-safe label, e.g. 2026-06-15_2026-07-15 */
  label: string;
}

export interface RunSummary {
  total: number;
  byStatus: Record<RoutineRunStatus, number>;
  completionRate: number; // completed / total, 0..1 (0 when total is 0)
  perRoutine: { routineId: string; name: string; count: number }[];
}

export interface ExceptionSummary {
  total: number;
  byStatus: Record<ExceptionStatus, number>;
  bySeverity: Record<ExceptionSeverity, number>;
}

/**
 * Parse and validate a `from`/`to` range from query params, defaulting to the
 * last 30 days. Dates are treated as UTC day boundaries (see handoff note).
 */
export function parseRange(params: {
  from?: string;
  to?: string;
}): ReportRange {
  const today = new Date();
  const defaultTo = toDateString(today);
  const defaultFrom = toDateString(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000));

  const from = isValidDate(params.from) ? (params.from as string) : defaultFrom;
  const toRaw = isValidDate(params.to) ? (params.to as string) : defaultTo;
  // Guard against an inverted range.
  const to = toRaw < from ? from : toRaw;

  return {
    from,
    to,
    fromISO: `${from}T00:00:00.000Z`,
    toISO: `${to}T23:59:59.999Z`,
    label: `${from}_${to}`,
  };
}

export async function getRunSummary(
  locationId: string,
  range: ReportRange,
): Promise<{ summary: RunSummary; error: string | null }> {
  const empty: RunSummary = {
    total: 0,
    byStatus: { in_progress: 0, completed: 0, abandoned: 0 },
    completionRate: 0,
    perRoutine: [],
  };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("routine_runs")
      .select("status, routine_id, routine:routines(name)")
      .eq("location_id", locationId)
      .gte("started_at", range.fromISO)
      .lte("started_at", range.toISO)
      .limit(MAX_ROWS);

    if (error) return { summary: empty, error: error.message };

    const summary: RunSummary = {
      total: 0,
      byStatus: { in_progress: 0, completed: 0, abandoned: 0 },
      completionRate: 0,
      perRoutine: [],
    };
    const perRoutine = new Map<string, { name: string; count: number }>();

    for (const row of data ?? []) {
      const r = row as {
        status: RoutineRunStatus;
        routine_id: string;
        routine: { name: string } | { name: string }[] | null;
      };
      summary.total += 1;
      if (r.status in summary.byStatus) summary.byStatus[r.status] += 1;
      const routine = Array.isArray(r.routine) ? r.routine[0] : r.routine;
      const existing = perRoutine.get(r.routine_id);
      if (existing) existing.count += 1;
      else perRoutine.set(r.routine_id, { name: routine?.name ?? "Routine", count: 1 });
    }

    summary.completionRate =
      summary.total === 0 ? 0 : summary.byStatus.completed / summary.total;
    summary.perRoutine = Array.from(perRoutine.entries())
      .map(([routineId, v]) => ({ routineId, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count);

    return { summary, error: null };
  } catch (err) {
    return {
      summary: empty,
      error: err instanceof Error ? err.message : "Unknown error building run report.",
    };
  }
}

export async function getExceptionSummary(
  locationId: string,
  range: ReportRange,
): Promise<{ summary: ExceptionSummary; error: string | null }> {
  const empty: ExceptionSummary = {
    total: 0,
    byStatus: { open: 0, in_progress: 0, resolved: 0 },
    bySeverity: { low: 0, medium: 0, high: 0 },
  };
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("exceptions")
      .select("status, severity")
      .eq("location_id", locationId)
      .gte("created_at", range.fromISO)
      .lte("created_at", range.toISO)
      .limit(MAX_ROWS);

    if (error) return { summary: empty, error: error.message };

    const summary: ExceptionSummary = {
      total: 0,
      byStatus: { open: 0, in_progress: 0, resolved: 0 },
      bySeverity: { low: 0, medium: 0, high: 0 },
    };
    for (const row of data ?? []) {
      const r = row as { status: ExceptionStatus; severity: ExceptionSeverity };
      summary.total += 1;
      if (r.status in summary.byStatus) summary.byStatus[r.status] += 1;
      if (r.severity in summary.bySeverity) summary.bySeverity[r.severity] += 1;
    }

    return { summary, error: null };
  } catch (err) {
    return {
      summary: empty,
      error: err instanceof Error ? err.message : "Unknown error building exception report.",
    };
  }
}

// --- CSV export fetchers ---------------------------------------------------

export interface RunExportRow {
  started_at: string;
  routine_name: string;
  status: string;
  completed_at: string;
  notes: string;
}

export interface ExceptionExportRow {
  created_at: string;
  title: string;
  severity: string;
  status: string;
  description: string;
  resolution_note: string;
  resolved_at: string;
}

export async function getRunsForExport(
  locationId: string,
  range: ReportRange,
): Promise<RunExportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("routine_runs")
    .select("started_at, completed_at, status, notes, routine:routines(name)")
    .eq("location_id", locationId)
    .gte("started_at", range.fromISO)
    .lte("started_at", range.toISO)
    .order("started_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error || !data) return [];
  return data.map((row) => {
    const r = row as {
      started_at: string;
      completed_at: string | null;
      status: string;
      notes: string | null;
      routine: { name: string } | { name: string }[] | null;
    };
    const routine = Array.isArray(r.routine) ? r.routine[0] : r.routine;
    return {
      started_at: r.started_at,
      routine_name: routine?.name ?? "",
      status: r.status,
      completed_at: r.completed_at ?? "",
      notes: r.notes ?? "",
    };
  });
}

export async function getExceptionsForExport(
  locationId: string,
  range: ReportRange,
): Promise<ExceptionExportRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exceptions")
    .select(
      "created_at, title, severity, status, description, resolution_note, resolved_at",
    )
    .eq("location_id", locationId)
    .gte("created_at", range.fromISO)
    .lte("created_at", range.toISO)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);

  if (error || !data) return [];
  return data.map((row) => {
    const r = row as {
      created_at: string;
      title: string;
      severity: string;
      status: string;
      description: string | null;
      resolution_note: string | null;
      resolved_at: string | null;
    };
    return {
      created_at: r.created_at,
      title: r.title,
      severity: r.severity,
      status: r.status,
      description: r.description ?? "",
      resolution_note: r.resolution_note ?? "",
      resolved_at: r.resolved_at ?? "",
    };
  });
}

// --- CSV builder -----------------------------------------------------------

/** Build a CSV string (RFC-4180-ish) with a UTF-8 BOM for spreadsheet apps. */
export function buildCsv(header: string[], rows: string[][]): string {
  const bom = String.fromCharCode(0xfeff);
  const lines = [header, ...rows].map((cells) => cells.map(csvCell).join(","));
  return bom + lines.join("\r\n") + "\r\n";
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isValidDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}
