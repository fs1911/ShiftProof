"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { setActiveLocation, signOut } from "@/app/app/actions";

const BASE_NAV_ITEMS = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/routines", label: "Routines" },
  { href: "/app/runs", label: "Runs" },
  { href: "/app/exceptions", label: "Exceptions" },
];

const MANAGE_NAV_ITEMS = [
  { href: "/app/reports", label: "Reports" },
  { href: "/app/settings/members", label: "Settings" },
];

export interface ShellLocation {
  id: string;
  name: string;
}

/**
 * Protected app shell: top bar (with location switcher) + side navigation +
 * content area. Responsive — the nav collapses to a horizontal scroll row on
 * small screens.
 */
export function AppShell({
  email,
  locations,
  activeLocationId,
  canManage,
  children,
}: {
  email: string | null;
  locations: ShellLocation[];
  activeLocationId: string | null;
  canManage: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const navItems = canManage
    ? [...BASE_NAV_ITEMS, ...MANAGE_NAV_ITEMS]
    : BASE_NAV_ITEMS;

  return (
    <div className="flex min-h-full flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/app/dashboard"
            className="text-base font-semibold tracking-tight text-slate-900"
          >
            Shift<span className="text-brand-600">Proof</span>
          </Link>
          <div className="flex items-center gap-3">
            {locations.length > 1 ? (
              <LocationSwitcher
                locations={locations}
                activeLocationId={activeLocationId}
                pathname={pathname}
              />
            ) : locations.length === 1 ? (
              <span className="hidden text-sm text-slate-500 sm:inline">
                {locations[0].name}
              </span>
            ) : null}
            <span className="hidden text-sm text-slate-500 md:inline">
              {email ?? "Signed in"}
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row">
        {/* Side nav (compact horizontal on mobile) */}
        <nav className="md:w-48 md:shrink-0">
          <ul className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5">
            {navItems.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ${
                      active
                        ? "bg-brand-50 text-brand-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function LocationSwitcher({
  locations,
  activeLocationId,
  pathname,
}: {
  locations: ShellLocation[];
  activeLocationId: string | null;
  pathname: string;
}) {
  return (
    <form action={setActiveLocation}>
      <input type="hidden" name="redirect_to" value={pathname} />
      <label className="sr-only" htmlFor="location-switcher">
        Active location
      </label>
      <select
        id="location-switcher"
        name="location_id"
        defaultValue={activeLocationId ?? undefined}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="max-w-[10rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
      >
        {locations.map((loc) => (
          <option key={loc.id} value={loc.id}>
            {loc.name}
          </option>
        ))}
      </select>
    </form>
  );
}
