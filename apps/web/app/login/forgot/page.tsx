import Link from "next/link";

import { requestPasswordReset } from "./actions";

export const dynamic = "force-dynamic";

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: { error?: string; sent?: string };
}) {
  const sent = searchParams.sent === "1";
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
          <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>

          {sent ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                If an account exists for that email, we&apos;ve sent a link to reset your
                password. Check your inbox (and spam folder).
              </p>
              <Link
                href="/login"
                className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-slate-500">
                Enter your work email and we&apos;ll send you a link to set a new password.
              </p>

              {error ? (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <form action={requestPasswordReset} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    placeholder="you@venue.com"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Send reset link
                </button>
              </form>

              <Link
                href="/login"
                className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
