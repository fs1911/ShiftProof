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
import { SettingsTabs } from "@/components/settings-tabs";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getOwnedLocations } from "@/lib/data/members";

import { createLocation, updateLocation } from "../actions";

export const dynamic = "force-dynamic";

export default async function LocationsSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const ctx = await getAppContext();
  const showMembers = ctx.ok && canManage(ctx.context.role);
  const { locations, error } = await getOwnedLocations();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Create and manage the locations you own."
      />
      <SettingsTabs active="locations" showMembers={showMembers} />
      <ErrorBanner message={searchParams.error} />

      <div className="space-y-6">
        <Card className="max-w-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700">New location</h2>
          <p className="mt-1 text-sm text-slate-500">
            You become the owner of any location you create.
          </p>
          <form action={createLocation} className="mt-4 space-y-4">
            <Field label="Name" htmlFor="name">
              <input
                id="name"
                name="name"
                type="text"
                required
                className={inputClass}
                placeholder="Main Street Café"
              />
            </Field>
            <Field label="Timezone" htmlFor="timezone" hint="e.g. Europe/Zurich, Europe/Berlin, UTC.">
              <input
                id="timezone"
                name="timezone"
                type="text"
                defaultValue="UTC"
                className={inputClass}
              />
            </Field>
            <button type="submit" className={primaryButtonClass}>
              Create location
            </button>
          </form>
        </Card>

        <div>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            Locations you own
          </h2>
          <DataNotice error={error} />
          {locations.length === 0 ? (
            <EmptyState
              title="No owned locations yet"
              description="Create one above to get started."
            />
          ) : (
            <div className="space-y-4">
              {locations.map((loc) => (
                <Card key={loc.id}>
                  <CardHeader>
                    <span className="flex items-center gap-2">
                      {loc.name}
                      <Badge tone={loc.isActive ? "green" : "slate"}>
                        {loc.isActive ? "active" : "inactive"}
                      </Badge>
                    </span>
                  </CardHeader>
                  <div className="p-4">
                    <form action={updateLocation} className="grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={loc.id} />
                      <Field label="Name">
                        <input
                          name="name"
                          type="text"
                          required
                          defaultValue={loc.name}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Timezone">
                        <input
                          name="timezone"
                          type="text"
                          defaultValue={loc.timezone}
                          className={inputClass}
                        />
                      </Field>
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          name="is_active"
                          value="true"
                          defaultChecked={loc.isActive}
                          className="h-4 w-4 rounded border-slate-300"
                        />
                        Active
                      </label>
                      <div className="sm:col-span-2">
                        <button type="submit" className={secondaryButtonClass}>
                          Save changes
                        </button>
                      </div>
                    </form>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
