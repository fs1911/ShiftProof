import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

import { updatePassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const error = searchParams.error;

  return (
    <main className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-8 block text-center text-lg font-semibold tracking-tight text-slate-900"
        >
          Shift<span className="text-brand-600">Proof</span>
        </Link>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Set a new password</h1>

          {!user ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                This page opens from a password-reset or invite link. Yours looks
                invalid or expired — request a new one.
              </p>
              <Link
                href="/login/forgot"
                className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                Request a reset link
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Choose a new password for {user.email ?? "your account"}.
              </p>

              {error ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form action={updatePassword} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder="At least 8 characters"
                  />
                </div>
                <div>
                  <label
                    htmlFor="confirm"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder="Re-enter the password"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Save password
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
