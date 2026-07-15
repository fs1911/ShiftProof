import Link from "next/link";

import {
  Badge,
  Card,
  DataNotice,
  EmptyState,
  ErrorBanner,
  PageHeader,
  primaryButtonClass,
} from "@/components/ui";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getRoutines } from "@/lib/data/routines";

export const dynamic = "force-dynamic";

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const ctxResult = await getAppContext();
  const manager = ctxResult.ok && canManage(ctxResult.context.role);
  const routines = await getRoutines();

  return (
    <div>
      <PageHeader
        title="Routines"
        description="Reusable shift routines for your location."
        action={
          manager ? (
            <Link href="/app/routines/new" className={primaryButtonClass}>
              New routine
            </Link>
          ) : undefined
        }
      />

      <ErrorBanner message={searchParams.error} />
      <DataNotice error={routines.error} />

      {routines.rows.length === 0 ? (
        <EmptyState
          title="No routines yet"
          description={
            manager
              ? "Create routines like Opening, Closing, or Weekly deep clean to get started."
              : "No routines have been set up for your location yet."
          }
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
                <tr key={routine.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/routines/${routine.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {routine.name}
                    </Link>
                  </td>
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
