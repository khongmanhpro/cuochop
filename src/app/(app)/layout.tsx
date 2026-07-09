import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { getUserOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/db";
import { Logo } from "@/components/logo";
import { NotificationBell } from "./notifications/notification-bell";
import { GlobalSearch } from "@/components/global-search";
import { AppNavTabs } from "./app-nav-tabs";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const activeOrganization = await getUserOrganization(user.id);
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notification.count({
      where: { userId: user.id, read: false },
    }),
  ]);

  const displayName = user.name || user.email;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/app" className="shrink-0" aria-label="Về workspace">
              <Logo width={140} height={36} />
            </Link>
            <span className="hidden text-[12px] font-medium text-stone sm:inline">
              Workspace
            </span>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <GlobalSearch />
            <NotificationBell
              initialUnreadCount={unreadCount}
              initialNotifications={notifications.map((notification) => ({
                id: notification.id,
                type: notification.type,
                title: notification.title,
                body: notification.body,
                read: notification.read,
                actionUrl: notification.actionUrl,
                createdAt: notification.createdAt.toISOString(),
              }))}
            />
            <span className="user-chip" title={displayName}>
              {displayName}
            </span>
            <form action={logout}>
              <button type="submit" className="link-quiet px-1">
                Đăng xuất
              </button>
            </form>
          </div>
        </div>

        <div className="app-nav-row">
          <div className="app-nav-inner">
            <AppNavTabs
              showTeam={Boolean(activeOrganization)}
              showAudit={
                activeOrganization?.role === "owner" ||
                activeOrganization?.role === "admin"
              }
            />
            <div className="hidden shrink-0 items-center gap-2 py-2 pr-2 sm:flex">
              {activeOrganization ? (
                <span className="pill-tab text-[12px]">
                  {activeOrganization.name}
                </span>
              ) : (
                <span className="badge-success text-[12px]">Cá nhân</span>
              )}
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
