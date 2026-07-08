import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { getUserOrganization } from "@/lib/organizations";
import { prisma } from "@/lib/db";
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

  return (
    <div className="min-h-screen bg-surface">
      {/* Top nav — sticky white bar, hairline-soft bottom border */}
      <header className="sticky top-0 z-30 border-b border-hairline-soft bg-canvas">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-ink"
          >
            cuochop
          </Link>
          <div className="flex items-center gap-3">
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
            <span className="text-[14px] text-slate">
              {user.name || user.email}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="text-[14px] text-stone transition-colors hover:text-ink"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>

        {/* Sub nav — segmented tabs (underline style) */}
        <div className="border-t border-hairline-soft bg-canvas">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-2">
            <AppNavTabs
              showTeam={Boolean(activeOrganization)}
              showAudit={
                activeOrganization?.role === "owner" ||
                activeOrganization?.role === "admin"
              }
            />
            <div className="flex items-center gap-2">
              <span className="badge-success">Personal workspace</span>
              {activeOrganization ? (
                <span className="pill-tab">
                  {activeOrganization.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
