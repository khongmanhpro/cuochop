"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  /** Prefix match: tab is active when pathname starts with this prefix. */
  matchPrefix?: boolean;
};

const TABS: readonly TabItem[] = [
  { href: "/app", label: "New Meeting" },
  { href: "/actions", label: "Actions", matchPrefix: true },
  { href: "/history", label: "History", matchPrefix: true },
  { href: "/settings/account", label: "Account", matchPrefix: true },
] as const;

function isActive(pathname: string, tab: TabItem): boolean {
  if (tab.matchPrefix) {
    // /settings/account should match any /settings/* route EXCEPT /settings/team
    // and /settings/audit which are handled separately below. We treat
    // /settings/account, /settings/team, /settings/audit as distinct tabs.
    if (tab.href === "/settings/account") {
      return (
        pathname.startsWith("/settings/account") ||
        (!pathname.startsWith("/settings/team") &&
          !pathname.startsWith("/settings/audit") &&
          pathname.startsWith("/settings"))
      );
    }
    return pathname.startsWith(tab.href);
  }
  return pathname === tab.href;
}

export function AppNavTabs({
  showTeam,
  showAudit,
}: {
  showTeam: boolean;
  showAudit: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`segmented-tab${isActive(pathname, tab) ? " segmented-tab-active" : ""}`}
        >
          {tab.label}
        </Link>
      ))}
      {showTeam ? (
        <Link
          href="/settings/team"
          className={`segmented-tab${pathname.startsWith("/settings/team") ? " segmented-tab-active" : ""}`}
        >
          Team
        </Link>
      ) : null}
      {showAudit ? (
        <Link
          href="/settings/audit"
          className={`segmented-tab${pathname.startsWith("/settings/audit") ? " segmented-tab-active" : ""}`}
        >
          Audit
        </Link>
      ) : null}
    </nav>
  );
}
