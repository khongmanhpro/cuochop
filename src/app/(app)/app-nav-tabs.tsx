"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type TabItem = {
  href: string;
  label: string;
  matchPrefix?: boolean;
};

const TABS: readonly TabItem[] = [
  { href: "/app", label: "Tổng quan" },
  { href: "/actions", label: "Công việc", matchPrefix: true },
  { href: "/history", label: "Lịch sử", matchPrefix: true },
  { href: "/settings/account", label: "Tài khoản", matchPrefix: true },
] as const;

function isActive(pathname: string, tab: TabItem): boolean {
  if (tab.matchPrefix) {
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
    <nav className="flex min-w-0 items-stretch gap-0" aria-label="Điều hướng chính">
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
          Nhóm
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
