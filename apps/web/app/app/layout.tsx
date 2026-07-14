import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout for all protected /app routes. Verifies the session server-side and
 * redirects unauthenticated users to /login. The middleware performs the same
 * guard at the edge; this is the defense-in-depth check at render time.
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

  return <AppShell email={email}>{children}</AppShell>;
}
