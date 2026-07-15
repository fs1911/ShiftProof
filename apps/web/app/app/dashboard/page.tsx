import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  NoLocationNotice,
  PageHeader,
  StatCard,
  runStatusTone,
  severityTone,
} from "@/components/ui";
import { getAppContext } from "@/lib/auth/context";
import { getExceptions } from "@/lib/data/exceptions";
import { getRecentRuns } from "@/lib/data/runs";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <NoLocationNotice />
      </div>
    );
  }
  const { locationId } = ctx.context;

  const [runs, exceptions] = await Promise.all([
    getRecentRuns(locationId, 10),
    getExceptions(locationId, true, 10),
  ]);

  const dataError = runs.error ?? exceptions.error;
  const inProgress = runs.rows.filter((r) => r.status === "in_progress").length;
  const completedToday = runs.rows.filter(
    (r) => r.status === "completed" && isToday(r.completed_at),
  ).length;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Today's shift activity across your location."
      />

      <DataNotice error={dataError} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Runs in progress" value={String(inProgress)} />
        <StatCard label="Completed today" value={String(completedToday)} />
        <StatCard label="Open exceptions" value={String(exceptions.rows.length)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>Today&apos;s routine runs</CardHeader>
          <div className="p-4">
            {runs.rows.length === 0 ? (
              <EmptyState
                title="No runs yet"
                description="Routine runs started by staff will appear here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {runs.rows.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <Link
                      href={`/app/runs/${run.id}`}
                      className="truncate pr-3 text-brand-700 hover:underline"
                    >
                      {run.routine_name ?? "Routine"}
                    </Link>
                    <Badge tone={runStatusTone(run.status)}>
                      {run.status.replace("_", " ")}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>Open exceptions</CardHeader>
          <div className="p-4">
            {exceptions.rows.length === 0 ? (
              <EmptyState
                title="No open exceptions"
                description="Issues raised during shifts will show up here for follow-up."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {exceptions.rows.map((ex) => (
                  <li
                    key={ex.id}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <Link
                      href={`/app/exceptions/${ex.id}`}
                      className="truncate pr-3 text-brand-700 hover:underline"
                    >
                      {ex.title}
                    </Link>
                    <Badge tone={severityTone(ex.severity)}>{ex.severity}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
