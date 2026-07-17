import Link from "next/link";

import { signIn } from "./actions";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; redirect?: string };
}) {
  const error = searchParams.error;
  const redirectTo = searchParams.redirect ?? "/app/dashboard";

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
          <h1 className="text-lg font-semibold text-slate-900">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">
            Use your work email to access your location&apos;s routines and runs.
          </p>

          {error ? (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <form action={signIn} className="mt-5 space-y-4">
            <input type="hidden" name="redirect" value={redirectTo} />
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
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <Link
                  href="/login/forgot"
                  className="text-xs font-medium text-brand-700 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Accounts are provisioned by your ShiftProof administrator.
        </p>
      </div>
    </main>
  );
}
