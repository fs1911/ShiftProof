import {
  Badge,
  Card,
  DataNotice,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getExceptions } from "@/lib/data/exceptions";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const exceptions = await getExceptions(false, 100);

  return (
    <div>
      <PageHeader
        title="Exceptions"
        description="Issues raised during shifts and their follow-up status."
      />

      <DataNotice error={exceptions.error} />

      {exceptions.rows.length === 0 ? (
        <EmptyState
          title="No exceptions"
          description="Anything that can't be completed to standard is raised here and tracked to resolution."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Title</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {exceptions.rows.map((ex) => (
                <tr key={ex.id}>
                  <td className="px-4 py-3 text-slate-800">{ex.title}</td>
                  <td className="px-4 py-3">
                    <Badge tone={severityTone(ex.severity)}>{ex.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={statusTone(ex.status)}>
                      {ex.status.replace("_", " ")}
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

function severityTone(severity: string): "red" | "amber" | "slate" {
  if (severity === "high") return "red";
  if (severity === "medium") return "amber";
  return "slate";
}

function statusTone(status: string): "green" | "amber" | "blue" {
  if (status === "resolved") return "green";
  if (status === "in_progress") return "blue";
  return "amber";
}
