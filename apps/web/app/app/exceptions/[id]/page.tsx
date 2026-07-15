import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  ErrorBanner,
  Field,
  PageHeader,
  exceptionStatusTone,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  severityTone,
} from "@/components/ui";
import { getException } from "@/lib/data/exceptions";

import { setExceptionStatus } from "../actions";

export const dynamic = "force-dynamic";

export default async function ExceptionDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const { exception, error } = await getException(params.id);

  if (error) {
    return (
      <div>
        <PageHeader title="Exception" />
        <DataNotice error={error} />
      </div>
    );
  }
  if (!exception) notFound();

  const detailPath = `/app/exceptions/${exception.id}`;
  const resolved = exception.status === "resolved";

  return (
    <div className="space-y-6">
      <PageHeader
        title={exception.title}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={severityTone(exception.severity)}>{exception.severity}</Badge>
            <Badge tone={exceptionStatusTone(exception.status)}>
              {exception.status.replace("_", " ")}
            </Badge>
          </div>
        }
      />

      <ErrorBanner message={searchParams.error} />

      <div className="text-sm">
        <Link href="/app/exceptions" className="text-brand-700 hover:underline">
          ← All exceptions
        </Link>
      </div>

      <Card>
        <CardHeader>Details</CardHeader>
        <div className="space-y-2 p-4 text-sm">
          <p className="text-slate-700">
            {exception.description ?? "No further detail provided."}
          </p>
          <p className="text-slate-400">Raised {formatDate(exception.created_at)}</p>
          {exception.routine_run_id ? (
            <p>
              <Link
                href={`/app/runs/${exception.routine_run_id}`}
                className="text-brand-700 hover:underline"
              >
                View the related run →
              </Link>
            </p>
          ) : null}
          {resolved ? (
            <div className="mt-2 rounded-md border border-green-200 bg-green-50 p-3">
              <p className="text-slate-700">
                <span className="text-slate-400">Resolution:</span>{" "}
                {exception.resolution_note ?? "—"}
              </p>
              {exception.resolved_at ? (
                <p className="mt-1 text-xs text-slate-400">
                  Resolved {formatDate(exception.resolved_at)}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader>Triage</CardHeader>
        <div className="space-y-4 p-4">
          {!resolved ? (
            <>
              {exception.status === "open" ? (
                <form action={setExceptionStatus}>
                  <input type="hidden" name="id" value={exception.id} />
                  <input type="hidden" name="status" value="in_progress" />
                  <input type="hidden" name="redirect_to" value={detailPath} />
                  <button type="submit" className={secondaryButtonClass}>
                    Start working on it
                  </button>
                </form>
              ) : null}

              <form action={setExceptionStatus} className="max-w-xl space-y-3 border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={exception.id} />
                <input type="hidden" name="status" value="resolved" />
                <input type="hidden" name="redirect_to" value={detailPath} />
                <Field label="Resolution note" hint="Required to resolve.">
                  <textarea
                    name="resolution_note"
                    rows={3}
                    required
                    className={inputClass}
                    placeholder="What was done to resolve this."
                  />
                </Field>
                <button type="submit" className={primaryButtonClass}>
                  Mark resolved
                </button>
              </form>
            </>
          ) : (
            <form action={setExceptionStatus}>
              <input type="hidden" name="id" value={exception.id} />
              <input type="hidden" name="status" value="open" />
              <input type="hidden" name="redirect_to" value={detailPath} />
              <button type="submit" className={secondaryButtonClass}>
                Reopen
              </button>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
