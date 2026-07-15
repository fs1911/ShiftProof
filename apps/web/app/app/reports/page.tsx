import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  Field,
  NoLocationNotice,
  PageHeader,
  StatCard,
  exceptionStatusTone,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  severityTone,
} from "@/components/ui";
import { canManage, getAppContext } from "@/lib/auth/context";
import {
  getExceptionSummary,
  getRunSummary,
  parseRange,
} from "@/lib/data/reports";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    return (
      <div>
        <PageHeader title="Reports" />
        <NoLocationNotice />
      </div>
    );
  }
  if (!canManage(ctx.context.role)) {
    return (
      <div>
        <PageHeader title="Reports" />
        <EmptyState
          title="Managers only"
          description="Only managers and owners can view reports."
        />
      </div>
    );
  }

  const { locationId } = ctx.context;
  const range = parseRange(searchParams);

  const [runs, exceptions] = await Promise.all([
    getRunSummary(locationId, range),
    getExceptionSummary(locationId, range),
  ]);

  const dataError = runs.error ?? exceptions.error;
  const runSummary = runs.summary;
  const exSummary = exceptions.summary;
  const completionPct = Math.round(runSummary.completionRate * 100);
  const openExceptions = exSummary.byStatus.open + exSummary.byStatus.in_progress;
  const exportQuery = `from=${range.from}&to=${range.to}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description={`${ctx.context.locationName} · ${range.from} to ${range.to}`}
      />

      <DataNotice error={dataError} />

      {/* Date range filter (GET → updates the URL) */}
      <Card>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <form method="get" className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="From">
              <input type="date" name="from" defaultValue={range.from} className={inputClass} />
            </Field>
            <Field label="To">
              <input type="date" name="to" defaultValue={range.to} className={inputClass} />
            </Field>
            <button type="submit" className={primaryButtonClass}>
              Apply
            </button>
          </form>
          <div className="flex gap-2">
            <a
              href={`/app/reports/export/runs?${exportQuery}`}
              className={secondaryButtonClass}
            >
              Export runs CSV
            </a>
            <a
              href={`/app/reports/export/exceptions?${exportQuery}`}
              className={secondaryButtonClass}
            >
              Export exceptions CSV
            </a>
          </div>
        </div>
      </Card>

      {/* Run summary */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-700">Routine runs</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <StatCard label="Total runs" value={String(runSummary.total)} />
          <StatCard label="Completed" value={String(runSummary.byStatus.completed)} />
          <StatCard
            label="Completion rate"
            value={`${completionPct}%`}
            hint={`${runSummary.byStatus.abandoned} abandoned · ${runSummary.byStatus.in_progress} in progress`}
          />
          <StatCard label="Open exceptions" value={String(openExceptions)} />
        </div>
      </div>

      {/* Per-routine breakdown */}
      <Card>
        <CardHeader>Runs by routine</CardHeader>
        <div className="p-4">
          {runSummary.perRoutine.length === 0 ? (
            <EmptyState
              title="No runs in this range"
              description="Adjust the date range or start some routine runs."
            />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-2 py-2 font-medium">Routine</th>
                  <th className="px-2 py-2 font-medium text-right">Runs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {runSummary.perRoutine.map((r) => (
                  <tr key={r.routineId}>
                    <td className="px-2 py-2 text-slate-800">{r.name}</td>
                    <td className="px-2 py-2 text-right text-slate-700">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>

      {/* Exception summary */}
      <Card>
        <CardHeader>Exceptions ({exSummary.total})</CardHeader>
        <div className="grid gap-6 p-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              By status
            </p>
            <ul className="space-y-1.5 text-sm">
              <SummaryRow
                label={<Badge tone={exceptionStatusTone("open")}>open</Badge>}
                value={exSummary.byStatus.open}
              />
              <SummaryRow
                label={<Badge tone={exceptionStatusTone("in_progress")}>in progress</Badge>}
                value={exSummary.byStatus.in_progress}
              />
              <SummaryRow
                label={<Badge tone={exceptionStatusTone("resolved")}>resolved</Badge>}
                value={exSummary.byStatus.resolved}
              />
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              By severity
            </p>
            <ul className="space-y-1.5 text-sm">
              <SummaryRow
                label={<Badge tone={severityTone("high")}>high</Badge>}
                value={exSummary.bySeverity.high}
              />
              <SummaryRow
                label={<Badge tone={severityTone("medium")}>medium</Badge>}
                value={exSummary.bySeverity.medium}
              />
              <SummaryRow
                label={<Badge tone={severityTone("low")}>low</Badge>}
                value={exSummary.bySeverity.low}
              />
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </li>
  );
}
