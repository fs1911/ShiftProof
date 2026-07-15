import { NextResponse } from "next/server";

import { generateAndSendDigest } from "@/lib/data/digest";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Daily due/overdue digest trigger. Iterates every active location, creates
 * in-app notifications, and emails opted-in owners/managers (idempotent per
 * location + day). Machine-triggered (no user session), so it uses the admin
 * client and is protected by a shared secret — never reachable from the browser
 * in a meaningful way without CRON_SECRET.
 *
 * Schedule it (e.g. Supabase pg_cron + pg_net) with:
 *   Authorization: Bearer <CRON_SECRET>
 * against POST <APP_BASE_URL>/api/cron/due-digest . If CRON_SECRET is unset the
 * endpoint refuses all requests (safe by default).
 */
async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization");
  if (!secret || provided !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const { data: locations, error } = await admin
    .from("locations")
    .select("id")
    .eq("is_active", true);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const loc of locations ?? []) {
    results.push(await generateAndSendDigest(admin, (loc as { id: string }).id));
  }

  return NextResponse.json({ ok: true, locations: results.length, results });
}

export async function POST(request: Request): Promise<Response> {
  return handle(request);
}

// Allow GET too, for schedulers that only issue GET (still secret-gated).
export async function GET(request: Request): Promise<Response> {
  return handle(request);
}
