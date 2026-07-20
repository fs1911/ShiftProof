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
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { SettingsTabs } from "@/components/settings-tabs";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getLocationMembers, type LocationMember } from "@/lib/data/members";
import type { UserRole } from "@/types/db";

import { changeMemberRole, inviteMember, removeMember } from "../actions";

export const dynamic = "force-dynamic";

export default async function MembersSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; ok?: string };
}) {
  const ctx = await getAppContext();

  if (!ctx.ok) {
    return (
      <div>
        <PageHeader title="Settings" />
        <EmptyState
          title="No location assigned"
          description="Create your first location to start adding members."
        />
        <div className="mt-4">
          <Link href="/app/settings/locations" className={primaryButtonClass}>
            Create a location
          </Link>
        </div>
      </div>
    );
  }

  const isOwner = ctx.context.role === "owner";
  const isManager = canManage(ctx.context.role);

  if (!isManager) {
    return (
      <div>
        <PageHeader title="Settings" />
        <SettingsTabs active="members" showMembers={false} />
        <EmptyState
          title="Managers only"
          description="Only managers and owners can manage members."
        />
      </div>
    );
  }

  const { members, error } = await getLocationMembers(ctx.context.locationId);

  return (
    <div>
      <PageHeader
        title="Settings"
        description={`Members of ${ctx.context.locationName}.`}
      />
      <SettingsTabs active="members" showMembers />
      <ErrorBanner message={searchParams.error} />
      {searchParams.ok ? (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {searchParams.ok}
        </div>
      ) : null}

      <div className="space-y-6">
        <Card className="max-w-xl p-6">
          <h2 className="text-sm font-semibold text-slate-700">Invite a member</h2>
          <p className="mt-1 text-sm text-slate-500">
            We&apos;ll email them a link to set a password and join. If they already
            have a ShiftProof account, they&apos;re added straight away.
            {isOwner ? "" : " Managers can invite staff."}
          </p>
          <form action={inviteMember} className="mt-4 space-y-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                className={inputClass}
                placeholder="colleague@venue.com"
              />
            </Field>
            <Field label="Role" htmlFor="role">
              <select id="role" name="role" className={inputClass} defaultValue="staff">
                <option value="staff">Staff</option>
                {isOwner ? <option value="manager">Manager</option> : null}
                {isOwner ? <option value="owner">Owner</option> : null}
              </select>
            </Field>
            <button type="submit" className={primaryButtonClass}>
              Send invite
            </button>
          </form>
        </Card>

        <Card>
          <CardHeader>Members ({members.length})</CardHeader>
          <div className="p-4">
            <DataNotice error={error} />
            {members.length === 0 ? (
              <EmptyState title="No members yet" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {members.map((member) => (
                  <MemberRow
                    key={member.userId}
                    member={member}
                    isOwner={isOwner}
                  />
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
}: {
  member: LocationMember;
  isOwner: boolean;
}) {
  // Owners manage everyone; managers may only remove staff.
  const canRemove = isOwner || member.role === "staff";

  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-800">{member.email}</p>
        {member.fullName ? (
          <p className="text-sm text-slate-500">{member.fullName}</p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isOwner ? (
          <form action={changeMemberRole} className="flex items-center gap-1">
            <input type="hidden" name="user_id" value={member.userId} />
            <select
              name="role"
              defaultValue={member.role}
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
            >
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="staff">Staff</option>
            </select>
            <button
              type="submit"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              Update
            </button>
          </form>
        ) : (
          <Badge tone={roleTone(member.role)}>{member.role}</Badge>
        )}

        {canRemove ? (
          <form action={removeMember}>
            <input type="hidden" name="user_id" value={member.userId} />
            <button
              type="submit"
              className="rounded-md border border-red-300 px-2 py-1 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Remove
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function roleTone(role: UserRole): "blue" | "amber" | "slate" {
  if (role === "owner") return "blue";
  if (role === "manager") return "amber";
  return "slate";
}
