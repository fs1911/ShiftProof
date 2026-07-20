import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { getAppBaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Email OTP confirmation for the server-side (@supabase/ssr) flow. Supabase's
 * recovery/invite email templates link here with a `token_hash` + `type`; we
 * verify it (which sets the auth session cookies) and forward to `next` — the
 * set-password page. This is the SSR-correct alternative to the implicit
 * (hash-token) flow, which a server route cannot read.
 *
 * Redirects are built from APP_BASE_URL, never the incoming request host —
 * behind the Railway/Cloudflare proxy the request host is the internal
 * bind address (localhost:PORT), which must never leak into a user-facing URL.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const next = safeNext(params.get("next"));
  const base = getAppBaseUrl();

  if (tokenHash && type) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(next, base));
    }
  }

  const loginUrl = new URL("/login", base);
  loginUrl.searchParams.set(
    "error",
    "This link is invalid or has expired. Request a new one.",
  );
  return NextResponse.redirect(loginUrl);
}

/** Only allow internal, same-site destinations. */
function safeNext(target: string | null): string {
  return target && target.startsWith("/") && !target.startsWith("//")
    ? target
    : "/app/dashboard";
}
