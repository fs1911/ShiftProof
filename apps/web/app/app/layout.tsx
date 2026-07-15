import { redirect } from "next/navigation";

import { AppShell, type ShellLocation } from "@/components/app-shell";
import { canManage, getAppContext } from "@/lib/auth/context";
import { getUnreadNotificationCount } from "@/lib/data/notifications";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout for all protected /app routes. Verifies the session server-side and
 * redirects unauthenticated users to /login. The middleware performs the same
 * guard at the edge; this is the defense-in-depth check at render time.
 *
 * Also resolves the user's locations so the shell can render the active-location
 * switcher. A user with no membership still gets the shell chrome; individual
 * pages render a "no location" notice.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let email: string | null = null;
  let authed = false;

  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      authed = true;
      email = user.email ?? null;
    }
  } catch {
    // If auth can't be verified (e.g. Supabase not configured), fail closed.
    authed = false;
  }

  if (!authed) redirect("/login");

  const ctx = await getAppContext();
  const locations: ShellLocation[] = ctx.ok
    ? ctx.context.memberships.map((m) => ({ id: m.locationId, name: m.name }))
    : [];
  const activeLocationId = ctx.ok ? ctx.context.locationId : null;
  const userCanManage = ctx.ok && canManage(ctx.context.role);
  const unreadCount = ctx.ok ? await getUnreadNotificationCount() : 0;

  return (
    <AppShell
      email={email}
      locations={locations}
      activeLocationId={activeLocationId}
      canManage={userCanManage}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
