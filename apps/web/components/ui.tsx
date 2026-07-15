import type { ReactNode } from "react";

/**
 * Small, dependency-free UI primitives for a clean B2B look.
 * Intentionally minimal — prefer these over pulling in a component library.
 */

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}

type BadgeTone = "slate" | "green" | "amber" | "red" | "blue";

const badgeTones: Record<BadgeTone, string> = {
  slate: "bg-slate-100 text-slate-700",
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  blue: "bg-brand-100 text-brand-700",
};

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badgeTones[tone]}`}
    >
      {children}
    </span>
  );
}

/**
 * Renders a subtle notice when a data query failed (e.g. Supabase not yet
 * configured), so scaffold screens degrade gracefully instead of crashing.
 */
export function DataNotice({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      Data could not be loaded yet. Connect Supabase to see live records.
      <span className="ml-1 text-amber-600">({error})</span>
    </div>
  );
}

/**
 * Shown on app screens when the signed-in user has no location membership yet.
 * Provisioning a user + location + membership is a server-side/onboarding step.
 */
export function NoLocationNotice() {
  return (
    <EmptyState
      title="No location assigned"
      description="Your account isn't linked to a location yet. An owner or administrator needs to add you to one before you can use ShiftProof."
    />
  );
}

/** Shows a form action error passed back via the `?error=` query param. */
export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

/** A form field: label above its control. */
export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

// Shared control styles for text inputs, selects, and textareas.
export const inputClass =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100";

/** Human labels + badge tones for the enums the screens render. */
export function severityTone(severity: string): BadgeTone {
  if (severity === "high") return "red";
  if (severity === "medium") return "amber";
  return "slate";
}

export function runStatusTone(status: string): BadgeTone {
  if (status === "completed") return "green";
  if (status === "in_progress") return "amber";
  return "slate";
}

export function exceptionStatusTone(status: string): BadgeTone {
  if (status === "resolved") return "green";
  if (status === "in_progress") return "blue";
  return "amber";
}

export function taskRunStatusTone(status: string): BadgeTone {
  if (status === "completed") return "green";
  if (status === "skipped") return "slate";
  if (status === "failed") return "red";
  return "amber";
}
