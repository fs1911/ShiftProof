import Link from "next/link";

import {
  Badge,
  Card,
  DataNotice,
  EmptyState,
  ErrorBanner,
  NoLocationNotice,
  PageHeader,
  runStatusTone,
} from "@/components/ui";
import { getAppContext } from "@/lib/auth/context";
import { getRecentRuns } from "@/lib/data/runs";

export const dynamic = "force-dynamic";

export default async function RunsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    return (
      <div>
        <PageHeader title="Runs" />
        <NoLocationNotice />
      </div>
    );
  }
  const runs = await getRecentRuns(ctx.context.locationId, 50);

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Recent executions of your shift routines. Start a run from a routine."
      />

      <ErrorBanner message={searchParams.error} />
      <DataNotice error={runs.error} />

      {runs.rows.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="Open a routine and choose Start run to record a shift routine here."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Routine</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.rows.map((run) => (
                <tr key={run.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/runs/${run.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {run.routine_name ?? "Routine"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(run.started_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={runStatusTone(run.status)}>
                      {run.status.replace("_", " ")}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
