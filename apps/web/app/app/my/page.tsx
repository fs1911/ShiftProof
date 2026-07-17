import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  NoLocationNotice,
  PageHeader,
  exceptionStatusTone,
  severityTone,
} from "@/components/ui";
import { getAppContext } from "@/lib/auth/context";
import { getMyOpenExceptions, getMyOpenRuns } from "@/lib/data/my-work";
import type { ExceptionRecord } from "@/types/db";
import type { MyOpenRun } from "@/lib/data/my-work";

export const dynamic = "force-dynamic";

export default async function MyWorkPage() {
  const ctxResult = await getAppContext();
  if (!ctxResult.ok) {
    return (
      <div>
        <PageHeader title="My work" />
        <NoLocationNotice />
      </div>
    );
  }
  const { locationId, userId } = ctxResult.context;

  const [runs, exceptions] = await Promise.all([
    getMyOpenRuns(locationId, userId),
    getMyOpenExceptions(locationId, userId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My work"
        description="Runs you have in progress and exceptions that need your attention."
      />

      {/* In-progress runs */}
      <Card>
        <CardHeader>My runs in progress ({runs.rows.length})</CardHeader>
        <DataNotice error={runs.error} />
        {runs.rows.length === 0 ? (
          <EmptyState
            title="Nothing in progress"
            description="Runs you start will appear here until you complete or abandon them."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {runs.rows.map((run) => (
              <MyRunRow key={run.id} run={run} />
            ))}
          </ul>
        )}
      </Card>

      {/* Exceptions raised by or assigned to me */}
      <Card>
        <CardHeader>My open exceptions ({exceptions.rows.length})</CardHeader>
        <DataNotice error={exceptions.error} />
        {exceptions.rows.length === 0 ? (
          <EmptyState
            title="No open exceptions"
            description="Exceptions you raise or that are assigned to you show here until resolved."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {exceptions.rows.map((ex) => (
              <MyExceptionRow key={ex.id} exception={ex} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function MyRunRow({ run }: { run: MyOpenRun }) {
  return (
    <li className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/app/runs/${run.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {run.routine_name ?? "Run"}
        </Link>
        <p className="mt-0.5 text-xs text-slate-500">Started {formatDate(run.started_at)}</p>
      </div>
      <Badge tone={run.pending_tasks > 0 ? "amber" : "green"}>
        {run.pending_tasks > 0
          ? `${run.pending_tasks} of ${run.total_tasks} left`
          : "ready to finish"}
      </Badge>
    </li>
  );
}

function MyExceptionRow({ exception }: { exception: ExceptionRecord }) {
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <Link
          href={`/app/exceptions/${exception.id}`}
          className="font-medium text-brand-700 hover:underline"
        >
          {exception.title}
        </Link>
        {exception.description ? (
          <p className="mt-0.5 truncate text-sm text-slate-500">{exception.description}</p>
        ) : null}
        <p className="mt-1 text-xs text-slate-400">Raised {formatDate(exception.created_at)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <Badge tone={severityTone(exception.severity)}>{exception.severity}</Badge>
        <Badge tone={exceptionStatusTone(exception.status)}>
          {exception.status.replace("_", " ")}
        </Badge>
      </div>
    </li>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
