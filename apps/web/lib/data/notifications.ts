import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface AppNotification {
  id: string;
  location_id: string;
  type: string;
  title: string;
  body: string | null;
  related_routine_id: string | null;
  is_read: boolean;
  emailed_at: string | null;
  created_at: string;
}

const COLUMNS =
  "id, location_id, type, title, body, related_routine_id, is_read, emailed_at, created_at";

/** The current user's notifications (RLS returns only their own rows). */
export async function getNotifications(
  limit = 50,
): Promise<{ rows: AppNotification[]; error: string | null }> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("notifications")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as AppNotification[], error: null };
  } catch (err) {
    return {
      rows: [],
      error: err instanceof Error ? err.message : "Unknown error loading notifications.",
    };
  }
}

/** The current user's digest-email opt-in (defaults to true if unavailable). */
export async function getEmailOptIn(): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return true;
    const { data } = await supabase
      .from("users")
      .select("notify_email")
      .eq("id", user.id)
      .maybeSingle();
    return (data as { notify_email?: boolean } | null)?.notify_email ?? true;
  } catch {
    return true;
  }
}

/** Count of the current user's unread notifications (for the shell bell). */
export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}
