import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * OAuth/OTP callback. Supabase password-recovery and invite emails link here
 * with a `code` (PKCE). We exchange it for a session (sets the auth cookies),
 * then send the user on to `next` — the set-password page for recovery/invite.
 * The redirect is built from the incoming request URL so it keeps the host the
 * user actually hit (custom domain), not the internal origin.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get("code");
  const next = safeNext(request.nextUrl.searchParams.get("next"));

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.search = "";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirectUrl.pathname = next;
      return NextResponse.redirect(redirectUrl);
    }
  }

  redirectUrl.pathname = "/login";
  redirectUrl.searchParams.set(
    "error",
    "This link is invalid or has expired. Request a new one.",
  );
  return NextResponse.redirect(redirectUrl);
}

/** Only allow internal, same-site destinations. */
function safeNext(target: string | null): string {
  return target && target.startsWith("/") && !target.startsWith("//")
    ? target
    : "/app/dashboard";
}
