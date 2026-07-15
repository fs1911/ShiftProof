import Link from "next/link";

import {
  Badge,
  Card,
  CardHeader,
  DataNotice,
  EmptyState,
  ErrorBanner,
  NoLocationNotice,
  PageHeader,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getEmailOptIn, getNotifications } from "@/lib/data/notifications";

import { generateDigest, markAllRead, markRead, setEmailOptIn } from "./actions";

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const ctx = await getAppContext();
  if (!ctx.ok) {
    return (
      <div>
        <PageHeader title="Notifications" />
        <NoLocationNotice />
      </div>
    );
  }

  const manager = canManage(ctx.context.role);
  const [{ rows, error }, emailOptIn] = await Promise.all([
    getNotifications(50),
    getEmailOptIn(),
  ]);
  const hasUnread = rows.some((n) => !n.is_read);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Digests and alerts for your locations."
        action={
          <div className="flex gap-2">
            {manager ? (
              <form action={generateDigest}>
                <button type="submit" className={secondaryButtonClass}>
                  Generate today&apos;s digest
                </button>
              </form>
            ) : null}
            {hasUnread ? (
              <form action={markAllRead}>
                <button type="submit" className={primaryButtonClass}>
                  Mark all read
                </button>
              </form>
            ) : null}
          </div>
        }
      />

      <ErrorBanner message={searchParams.error} />
      <DataNotice error={error} />

      <Card className="mb-6 p-4">
        <form action={setEmailOptIn} className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-700">Email me digests</p>
            <p className="text-xs text-slate-500">
              Receive the daily due/overdue digest for your locations by email.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="notify_email"
              defaultChecked={emailOptIn}
              className="h-4 w-4 rounded border-slate-300"
            />
            <button type="submit" className={secondaryButtonClass}>
              Save
            </button>
          </label>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No notifications"
          description={
            manager
              ? "Generate today's digest to notify managers of what's due."
              : "You're all caught up. Digests and alerts will appear here."
          }
        />
      ) : (
        <Card>
          <CardHeader>Inbox</CardHeader>
          <ul className="divide-y divide-slate-100">
            {rows.map((n) => (
              <li
                key={n.id}
                className={`flex items-start justify-between gap-3 px-4 py-3 ${
                  n.is_read ? "" : "bg-brand-50/40"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800">{n.title}</p>
                    {n.is_read ? null : <Badge tone="blue">new</Badge>}
                  </div>
                  {n.body ? (
                    <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-slate-400">
                    {formatDate(n.created_at)}
                    {n.emailed_at ? " · emailed" : null}
                    {n.related_routine_id ? (
                      <>
                        {" · "}
                        <Link
                          href={`/app/routines/${n.related_routine_id}`}
                          className="text-brand-700 hover:underline"
                        >
                          View routine
                        </Link>
                      </>
                    ) : null}
                  </p>
                </div>
                {n.is_read ? null : (
                  <form action={markRead} className="shrink-0">
                    <input type="hidden" name="id" value={n.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Mark read
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
