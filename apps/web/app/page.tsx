import Link from "next/link";

const VALUE_POINTS = [
  {
    title: "Complete shift routines",
    body: "Opening, closing, cleaning, temperature logs — run them step by step on any phone.",
  },
  {
    title: "Capture real proof",
    body: "Photos, values, and comments recorded as the work happens, not from memory.",
  },
  {
    title: "Catch exceptions early",
    body: "Flag what's off the moment it happens and track follow-up through to resolution.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-full">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight text-slate-900">
          Shift<span className="text-brand-600">Proof</span>
        </span>
        <Link
          href="/login"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Sign in
        </Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-12 pt-10 sm:pt-16">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Shift routines, provable
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Make every shift routine done, and proven.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">
          ShiftProof helps restaurants, cafés, and boutique hotels complete
          recurring shift routines, capture proof, and track exceptions — so
          standards hold on every shift, with evidence when it&apos;s needed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-md bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open the app
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-3">
          {VALUE_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-base font-semibold text-slate-900">
                {point.title}
              </h2>
              <p className="mt-2 text-sm text-slate-600">{point.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-5xl px-6 pb-10 text-sm text-slate-400">
        © {new Date().getFullYear()} ShiftProof
      </footer>
    </main>
  );
}
