import Link from "next/link";

/** Sub-navigation shared by the settings screens. */
export function SettingsTabs({
  active,
  showMembers,
}: {
  active: "members" | "locations";
  showMembers: boolean;
}) {
  const tabs: { key: "members" | "locations"; href: string; label: string }[] = [
    ...(showMembers
      ? [{ key: "members" as const, href: "/app/settings/members", label: "Members" }]
      : []),
    { key: "locations" as const, href: "/app/settings/locations", label: "Locations" },
  ];

  return (
    <div className="mb-4 flex gap-1 border-b border-slate-200">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
            active === tab.key
              ? "border-brand-600 text-brand-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
