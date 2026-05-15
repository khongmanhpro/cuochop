import { redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/session";
import { logout } from "@/app/actions/auth";
import { FREE_MONTHLY_LIMIT, canViewHistory } from "@/lib/plans";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const isPro = canViewHistory(user);
  const usageRemaining = Math.max(0, FREE_MONTHLY_LIMIT - user.usageThisMonth);
  const showUpsellBanner = !isPro && usageRemaining <= 2;

  return (
    <div className="min-h-screen bg-[#eef3f8]">
      {/* Top nav */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="text-sm font-bold text-blue-700">
            cuochop
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600">{user.name || user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-slate-500 hover:text-slate-800 transition"
              >
                Đăng xuất
              </button>
            </form>
          </div>
        </div>
        {/* Sub nav */}
        <div className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2 sm:px-6">
            <nav className="flex gap-5">
              <Link
                href="/app"
                className="text-sm font-semibold text-blue-700 hover:text-blue-800"
              >
                New Meeting
              </Link>
              <Link
                href="/history"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                History
              </Link>
            </nav>
            {!isPro ? (
              <div className="flex items-center gap-2">
                {showUpsellBanner ? (
                  <span className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
                    {usageRemaining === 0
                      ? "Đã hết lượt miễn phí"
                      : `Còn ${usageRemaining} lượt`}{" "}
                    ·{" "}
                    <Link href="/pricing" className="underline">
                      Nâng cấp Pro
                    </Link>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">
                    Free · {usageRemaining}/{FREE_MONTHLY_LIMIT} còn lại
                  </span>
                )}
              </div>
            ) : (
              <span className="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                Pro
              </span>
            )}
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}
