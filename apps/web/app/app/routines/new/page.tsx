import Link from "next/link";

import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { canManage, getAppContext } from "@/lib/auth/context";

import { createRoutine } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewRoutinePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const ctxResult = await getAppContext();
  const manager = ctxResult.ok && canManage(ctxResult.context.role);

  if (!manager) {
    return (
      <div>
        <PageHeader title="New routine" />
        <EmptyState
          title="Managers only"
          description="Only managers and owners can create routines."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New routine"
        description="Give the routine a name and how often it runs. Add tasks next."
      />

      <ErrorBanner message={searchParams.error} />

      <Card className="max-w-xl p-6">
        <form action={createRoutine} className="space-y-4">
          <Field label="Name" htmlFor="name">
            <input
              id="name"
              name="name"
              type="text"
              required
              className={inputClass}
              placeholder="Opening checklist"
            />
          </Field>
          <Field label="Description" htmlFor="description" hint="Optional.">
            <textarea
              id="description"
              name="description"
              rows={3}
              className={inputClass}
              placeholder="What this routine covers and when to run it."
            />
          </Field>
          <Field label="Frequency" htmlFor="frequency">
            <select id="frequency" name="frequency" className={inputClass} defaultValue="daily">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="ad_hoc">Ad hoc</option>
            </select>
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="submit" className={primaryButtonClass}>
              Create routine
            </button>
            <Link href="/app/routines" className={secondaryButtonClass}>
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
