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
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  taskRunStatusTone,
} from "@/components/ui";
import { getRunDetail } from "@/lib/data/runs";
import type { TaskRunWithTask } from "@/types/db";

import { raiseException } from "../../exceptions/actions";
import { abandonRun, completeRun, saveTaskRun } from "../actions";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const { run, error } = await getRunDetail(params.id);

  if (error) {
    return (
      <div>
        <PageHeader title="Run" />
        <DataNotice error={error} />
      </div>
    );
  }
  if (!run) notFound();

  const active = run.status === "in_progress";
  const runPath = `/app/runs/${run.id}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={run.routine_name ?? "Run"}
        description={`Started ${formatDate(run.started_at)}`}
        action={<Badge tone={runStatusTone(run.status)}>{run.status.replace("_", " ")}</Badge>}
      />

      <ErrorBanner message={searchParams.error} />

      <div className="text-sm">
        <Link href="/app/runs" className="text-brand-700 hover:underline">
          ← All runs
        </Link>
      </div>

      <Card>
        <CardHeader>Tasks ({run.task_runs.length})</CardHeader>
        <div className="divide-y divide-slate-100">
          {run.task_runs.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">
              This run has no tasks. The routine had no tasks when it was started.
            </p>
          ) : (
            run.task_runs.map((tr) => (
              <TaskRunItem key={tr.id} taskRun={tr} runId={run.id} runPath={runPath} active={active} />
            ))
          )}
        </div>
      </Card>

      {active ? (
        <Card>
          <CardHeader>Finish</CardHeader>
          <div className="flex flex-wrap gap-3 p-4">
            <form action={completeRun}>
              <input type="hidden" name="run_id" value={run.id} />
              <button type="submit" className={primaryButtonClass}>
                Complete run
              </button>
            </form>
            <form action={abandonRun}>
              <input type="hidden" name="run_id" value={run.id} />
              <button type="submit" className={secondaryButtonClass}>
                Abandon run
              </button>
            </form>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-slate-500">
          {run.completed_at
            ? `Completed ${formatDate(run.completed_at)}.`
            : "This run is closed."}
        </p>
      )}

      {/* Run-level exception */}
      <Card>
        <CardHeader>Raise an exception for this run</CardHeader>
        <div className="p-4">
          <ExceptionForm runId={run.id} runPath={runPath} />
        </div>
      </Card>
    </div>
  );
}

function TaskRunItem({
  taskRun,
  runId,
  runPath,
  active,
}: {
  taskRun: TaskRunWithTask;
  runId: string;
  runPath: string;
  active: boolean;
}) {
  const task = taskRun.task;
  const title = task?.title ?? "Task";
  const type = task?.task_type ?? "checkbox";

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{title}</p>
          {task?.instructions ? (
            <p className="mt-0.5 text-sm text-slate-500">{task.instructions}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge tone="blue">{type}</Badge>
            {task?.is_required ? <Badge tone="amber">required</Badge> : null}
            <Badge tone={taskRunStatusTone(taskRun.status)}>{taskRun.status}</Badge>
          </div>
        </div>
      </div>

      {/* Captured values (always shown when present) */}
      {taskRun.value_text ? (
        <p className="mt-2 text-sm text-slate-700">
          <span className="text-slate-400">Value:</span> {taskRun.value_text}
        </p>
      ) : null}
      {taskRun.comment ? (
        <p className="mt-1 text-sm text-slate-700">
          <span className="text-slate-400">Comment:</span> {taskRun.comment}
        </p>
      ) : null}

      {active ? (
        <form action={saveTaskRun} className="mt-3 space-y-3 rounded-md bg-slate-50 p-3">
          <input type="hidden" name="task_run_id" value={taskRun.id} />
          <input type="hidden" name="run_id" value={runId} />

          {type === "value" ? (
            <Field label="Reading / value">
              <input
                name="value_text"
                type="text"
                defaultValue={taskRun.value_text ?? ""}
                className={inputClass}
                placeholder="e.g. 3.5°C"
              />
            </Field>
          ) : (
            <input type="hidden" name="value_text" value={taskRun.value_text ?? ""} />
          )}

          {type === "photo" ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              Photo capture arrives in the next step. For now, record a comment as proof.
            </p>
          ) : null}

          <Field label="Comment" hint="Optional.">
            <textarea
              name="comment"
              rows={2}
              defaultValue={taskRun.comment ?? ""}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              name="status"
              value="completed"
              className={primaryButtonClass}
            >
              Mark done
            </button>
            <button
              type="submit"
              name="status"
              value="skipped"
              className={secondaryButtonClass}
            >
              Skip
            </button>
            <button
              type="submit"
              name="status"
              value="failed"
              className="inline-flex items-center justify-center rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Mark failed
            </button>
          </div>
        </form>
      ) : null}

      {/* Task-level exception */}
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-medium text-brand-700">
          Raise exception for this task
        </summary>
        <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
          <ExceptionForm runId={runId} taskRunId={taskRun.id} runPath={runPath} />
        </div>
      </details>
    </div>
  );
}

function ExceptionForm({
  runId,
  taskRunId,
  runPath,
}: {
  runId: string;
  taskRunId?: string;
  runPath: string;
}) {
  return (
    <form action={raiseException} className="space-y-3">
      <input type="hidden" name="routine_run_id" value={runId} />
      {taskRunId ? <input type="hidden" name="task_run_id" value={taskRunId} /> : null}
      <input type="hidden" name="redirect_to" value={runPath} />
      <Field label="Title">
        <input
          name="title"
          type="text"
          required
          className={inputClass}
          placeholder="Fridge above safe temperature"
        />
      </Field>
      <Field label="Details" hint="Optional.">
        <textarea name="description" rows={2} className={inputClass} />
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
  );
}

function runStatusTone(status: string): "green" | "amber" | "slate" {
  if (status === "completed") return "green";
  if (status === "in_progress") return "amber";
  return "slate";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
