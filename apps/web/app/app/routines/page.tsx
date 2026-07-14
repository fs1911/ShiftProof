import {
  Badge,
  Card,
  DataNotice,
  EmptyState,
  PageHeader,
} from "@/components/ui";
import { getRoutines } from "@/lib/data/routines";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const routines = await getRoutines();

  return (
    <div>
      <PageHeader
        title="Routines"
        description="Reusable shift routines for your location."
        action={
          <button
            type="button"
            disabled
            title="Routine creation is coming in a later step."
            className="cursor-not-allowed rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white opacity-60"
          >
            New routine
          </button>
        }
      />

      <DataNotice error={routines.error} />

      {routines.rows.length === 0 ? (
        <EmptyState
          title="No routines yet"
          description="Create routines like Opening, Closing, or Weekly deep clean. Creation lands in the next implementation step."
        />
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Frequency</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routines.rows.map((routine) => (
                <tr key={routine.id}>
                  <td className="px-4 py-3 text-slate-800">{routine.name}</td>
                  <td className="px-4 py-3 text-slate-600">{routine.frequency}</td>
                  <td className="px-4 py-3">
                    <Badge tone={routine.is_active ? "green" : "slate"}>
                      {routine.is_active ? "active" : "inactive"}
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
