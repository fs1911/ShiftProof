import Link from "next/link";
import { notFound } from "next/navigation";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getRoutineWithTasks } from "@/lib/data/routines";
import type { Task, TaskType } from "@/types/db";

import { startRun } from "../../runs/actions";
import {
  createTask,
  deleteTask,
  moveTask,
  setRoutineActive,
  updateRoutine,
  updateTask,
} from "../actions";

export const dynamic = "force-dynamic";

const TASK_TYPE_OPTIONS: { value: TaskType; label: string }[] = [
  { value: "checkbox", label: "Checkbox" },
  { value: "value", label: "Value (reading)" },
  { value: "photo", label: "Photo" },
  { value: "comment", label: "Comment" },
];

export default async function RoutineDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const ctxResult = await getAppContext();
  const manager = ctxResult.ok && canManage(ctxResult.context.role);
  const { routine, error } = await getRoutineWithTasks(params.id);

  if (error) {
    return (
      <div>
        <PageHeader title="Routine" />
        <DataNotice error={error} />
      </div>
    );
  }
  if (!routine) notFound();

  const tasks = routine.tasks;

  return (
    <div className="space-y-6">
      <PageHeader
        title={routine.name}
        description={routine.description ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={routine.is_active ? "green" : "slate"}>
              {routine.is_active ? "active" : "inactive"}
            </Badge>
            <form action={startRun}>
              <input type="hidden" name="routine_id" value={routine.id} />
              <button
                type="submit"
                className={primaryButtonClass}
                disabled={!routine.is_active || tasks.length === 0}
                title={
                  tasks.length === 0
                    ? "Add at least one task before starting a run."
                    : undefined
                }
              >
                Start run
              </button>
            </form>
          </div>
        }
      />

      <ErrorBanner message={searchParams.error} />

      <div className="text-sm">
        <Link href="/app/routines" className="text-brand-700 hover:underline">
          ← All routines
        </Link>
      </div>

      {/* Tasks */}
      <Card>
        <CardHeader>Tasks ({tasks.length})</CardHeader>
        <div className="p-4">
          {tasks.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              description={
                manager
                  ? "Add the steps staff should complete during this routine."
                  : "This routine has no tasks configured yet."
              }
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {tasks.map((task, index) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  routineId={routine.id}
                  manager={manager}
                  isFirst={index === 0}
                  isLast={index === tasks.length - 1}
                />
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Manager-only editing */}
      {manager ? (
        <>
          <Card>
            <CardHeader>Add a task</CardHeader>
            <div className="p-4">
              <TaskForm routineId={routine.id} action={createTask} submitLabel="Add task" />
            </div>
          </Card>

          <Card>
            <CardHeader>Routine settings</CardHeader>
            <div className="space-y-4 p-4">
              <form action={updateRoutine} className="max-w-xl space-y-4">
                <input type="hidden" name="id" value={routine.id} />
                <Field label="Name" htmlFor="r-name">
                  <input
                    id="r-name"
                    name="name"
                    type="text"
                    required
                    defaultValue={routine.name}
                    className={inputClass}
                  />
                </Field>
                <Field label="Description" htmlFor="r-description">
                  <textarea
                    id="r-description"
                    name="description"
                    rows={3}
                    defaultValue={routine.description ?? ""}
                    className={inputClass}
                  />
                </Field>
                <Field label="Frequency" htmlFor="r-frequency">
                  <select
                    id="r-frequency"
                    name="frequency"
                    className={inputClass}
                    defaultValue={routine.frequency}
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="ad_hoc">Ad hoc</option>
                  </select>
                </Field>
                <button type="submit" className={primaryButtonClass}>
                  Save changes
                </button>
              </form>

              <form action={setRoutineActive} className="border-t border-slate-100 pt-4">
                <input type="hidden" name="id" value={routine.id} />
                <input
                  type="hidden"
                  name="is_active"
                  value={(!routine.is_active).toString()}
                />
                <button type="submit" className={secondaryButtonClass}>
                  {routine.is_active ? "Deactivate routine" : "Reactivate routine"}
                </button>
              </form>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  routineId,
  manager,
  isFirst,
  isLast,
}: {
  task: Task;
  routineId: string;
  manager: boolean;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{task.title}</p>
          {task.instructions ? (
            <p className="mt-0.5 text-sm text-slate-500">{task.instructions}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <Badge tone="blue">{task.task_type}</Badge>
            {task.is_required ? <Badge tone="amber">required</Badge> : null}
            {task.requires_photo ? <Badge tone="slate">photo</Badge> : null}
          </div>
        </div>

        {manager ? (
          <div className="flex shrink-0 items-center gap-1">
            <MoveButton routineId={routineId} taskId={task.id} direction="up" disabled={isFirst} />
            <MoveButton routineId={routineId} taskId={task.id} direction="down" disabled={isLast} />
          </div>
        ) : null}
      </div>

      {manager ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-brand-700">
            Edit
          </summary>
          <div className="mt-3 rounded-md border border-slate-100 bg-slate-50 p-3">
            <TaskForm
              routineId={routineId}
              task={task}
              action={updateTask}
              submitLabel="Save task"
            />
            <form action={deleteTask} className="mt-3">
              <input type="hidden" name="id" value={task.id} />
              <input type="hidden" name="routine_id" value={routineId} />
              <button
                type="submit"
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Delete task
              </button>
            </form>
          </div>
        </details>
      ) : null}
    </li>
  );
}

function MoveButton({
  routineId,
  taskId,
  direction,
  disabled,
}: {
  routineId: string;
  taskId: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveTask}>
      <input type="hidden" name="id" value={taskId} />
      <input type="hidden" name="routine_id" value={routineId} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {direction === "up" ? "↑" : "↓"}
      </button>
    </form>
  );
}

function TaskForm({
  routineId,
  task,
  action,
  submitLabel,
}: {
  routineId: string;
  task?: Task;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-3">
      {task ? <input type="hidden" name="id" value={task.id} /> : null}
      <input type="hidden" name="routine_id" value={routineId} />
      <Field label="Title">
        <input
          name="title"
          type="text"
          required
          defaultValue={task?.title ?? ""}
          className={inputClass}
          placeholder="Check walk-in fridge temperature"
        />
      </Field>
      <Field label="Instructions" hint="Optional guidance for staff.">
        <textarea
          name="instructions"
          rows={2}
          defaultValue={task?.instructions ?? ""}
          className={inputClass}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Type">
          <select
            name="task_type"
            className={inputClass}
            defaultValue={task?.task_type ?? "checkbox"}
          >
            {TASK_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="is_required"
              defaultChecked={task?.is_required ?? true}
              className="h-4 w-4 rounded border-slate-300"
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="requires_photo"
              defaultChecked={task?.requires_photo ?? false}
              className="h-4 w-4 rounded border-slate-300"
            />
            Photo
          </label>
        </div>
      </div>
      <button type="submit" className={primaryButtonClass}>
        {submitLabel}
      </button>
    </form>
  );
}
