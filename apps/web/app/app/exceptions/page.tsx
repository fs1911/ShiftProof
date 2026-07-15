import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  exceptionStatusTone,
  inputClass,
  secondaryButtonClass,
  severityTone,
} from "@/components/ui";
import { getExceptions } from "@/lib/data/exceptions";

import { raiseException } from "./actions";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const exceptions = await getExceptions(false, 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exceptions"
        description="Issues raised during shifts and their follow-up status."
      />

      <ErrorBanner message={searchParams.error} />
      <DataNotice error={exceptions.error} />

      <Card>
        <CardHeader>Raise an exception</CardHeader>
        <div className="p-4">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-brand-700">
              New exception
            </summary>
            <div className="mt-3 max-w-xl">
              <form action={raiseException} className="space-y-3">
                <input type="hidden" name="redirect_to" value="/app/exceptions" />
                <Field label="Title">
                  <input
                    name="title"
                    type="text"
                    required
                    className={inputClass}
                    placeholder="Walk-in fridge running warm"
                  />
                </Field>
                <Field label="Details" hint="Optional.">
                  <textarea name="description" rows={3} className={inputClass} />
                </Field>
                <Field label="Severity">
                  <select name="severity" className={inputClass} defaultValue="medium">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </Field>
                <button type="submit" className={secondaryButtonClass}>
                  Raise exception
                </button>
              </form>
            </div>
          </details>
        </div>
      </Card>

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
                <tr key={ex.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/exceptions/${ex.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {ex.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={severityTone(ex.severity)}>{ex.severity}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={exceptionStatusTone(ex.status)}>
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
