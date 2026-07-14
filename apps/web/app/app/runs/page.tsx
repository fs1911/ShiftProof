import {
  Badge,
  Card,
  DataNotice,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getRecentRuns } from "@/lib/data/runs";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await getRecentRuns(50);

  return (
    <div>
      <PageHeader
        title="Runs"
        description="Recent executions of your shift routines."
      />

      <DataNotice error={runs.error} />

      {runs.rows.length === 0 ? (
        <EmptyState
          title="No runs yet"
          description="When staff start a routine, each run is recorded here with its status and timing."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Run</th>
                <th className="px-4 py-2 font-medium">Started</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {runs.rows.map((run) => (
                <tr key={run.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">
                    {run.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(run.started_at)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(run.status)}>
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

function statusTone(status: string): "green" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "in_progress") return "amber";
  return "slate";
}
