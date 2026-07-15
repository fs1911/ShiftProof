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
import { canManage, getAppContext } from "@/lib/auth/context";
import { getRunPhotos } from "@/lib/data/photos";
import { getRunDetail } from "@/lib/data/runs";
import type { PhotoWithUrl, TaskRunWithTask } from "@/types/db";

import { raiseException } from "../../exceptions/actions";
import {
  abandonRun,
  completeRun,
  deletePhoto,
  saveTaskRun,
  uploadPhoto,
} from "../actions";

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

  const ctxResult = await getAppContext();
  const manager = ctxResult.ok && canManage(ctxResult.context.role);
  const { byTaskRun: photosByTaskRun } = await getRunPhotos(
    run.task_runs.map((tr) => tr.id),
  );

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
              <TaskRunItem
                key={tr.id}
                taskRun={tr}
                runId={run.id}
                runPath={runPath}
                active={active}
                manager={manager}
                photos={photosByTaskRun[tr.id] ?? []}
              />
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
  manager,
  photos,
}: {
  taskRun: TaskRunWithTask;
  runId: string;
  runPath: string;
  active: boolean;
  manager: boolean;
  photos: PhotoWithUrl[];
}) {
  const task = taskRun.task;
  const title = task?.title ?? "Task";
  const type = task?.task_type ?? "checkbox";
  const requiresPhoto = task?.requires_photo ?? false;

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
            {requiresPhoto ? <Badge tone="slate">photo required</Badge> : null}
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

      {/* Captured photos (shown for active and closed runs) */}
      <PhotoGallery
        photos={photos}
        runId={runId}
        manager={manager}
      />

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

          {requiresPhoto && photos.length === 0 ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
              This task requires a photo. Add one below before marking it done.
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

      {/* Photo upload (separate form; the capture form uses multi-value submit) */}
      {active ? (
        <form
          action={uploadPhoto}
          className="mt-3 flex flex-col gap-2 rounded-md border border-slate-100 bg-white p-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="task_run_id" value={taskRun.id} />
          <input type="hidden" name="run_id" value={runId} />
          <div className="flex-1">
            <Field label="Add a proof photo" hint="JPG/PNG, up to 10 MB.">
              <input
                type="file"
                name="photo"
                accept="image/*"
                capture="environment"
                required
                className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </Field>
          </div>
          <input
            type="text"
            name="caption"
            placeholder="Caption (optional)"
            className={`${inputClass} sm:w-48`}
          />
          <button type="submit" className={secondaryButtonClass}>
            Upload
          </button>
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

function PhotoGallery({
  photos,
  runId,
  manager,
}: {
  photos: PhotoWithUrl[];
  runId: string;
  manager: boolean;
}) {
  if (photos.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Photos
      </p>
      <ul className="mt-2 flex flex-wrap gap-3">
        {photos.map((photo) => (
          <li key={photo.id} className="w-28">
            <div className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              {photo.signed_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.signed_url}
                  alt={photo.caption ?? "Proof photo"}
                  className="h-28 w-28 object-cover"
                />
              ) : (
                <div className="flex h-28 w-28 items-center justify-center text-xs text-slate-400">
                  unavailable
                </div>
              )}
            </div>
            {photo.caption ? (
              <p className="mt-1 truncate text-xs text-slate-500">{photo.caption}</p>
            ) : null}
            {manager ? (
              <form action={deletePhoto} className="mt-1">
                <input type="hidden" name="photo_id" value={photo.id} />
                <input type="hidden" name="storage_path" value={photo.storage_path} />
                <input type="hidden" name="run_id" value={runId} />
                <button
                  type="submit"
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  Delete
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
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
