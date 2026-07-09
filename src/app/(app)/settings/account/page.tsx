import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ExportDataSection } from "@/components/export-data-section";
import { disconnectOAuthProvider } from "./actions";
import {
  ChangePasswordForm,
  DisplayNameForm,
} from "./profile-forms";

const providers = [
  { id: "google", label: "Google" },
  { id: "microsoft", label: "Microsoft" },
] as const;

export default async function AccountSettingsPage() {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      email: true,
      name: true,
      passwordAuthEnabled: true,
      oauthAccounts: {
        select: {
          provider: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!account) redirect("/auth/login");

  const connectedProviders = new Set(
    account.oauthAccounts.map((oauthAccount) => oauthAccount.provider),
  );
  const authMethodLabel =
    user.authMethod === "google"
      ? "Google"
      : user.authMethod === "microsoft"
        ? "Microsoft"
        : "Mật khẩu";

  return (
    <main className="page-container space-y-6 sm:space-y-8">
      <header className="page-header">
        <p className="page-eyebrow">Tài khoản</p>
        <h1 className="page-title">Cài đặt</h1>
        <p className="page-description">
          {account.email} · đăng nhập bằng {authMethodLabel}.
        </p>
      </header>

      <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Hồ sơ
        </h2>
        <div className="mt-6">
          <DisplayNameForm initialName={account.name || ""} />
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Mật khẩu
        </h2>
        <div className="mt-6">
          <ChangePasswordForm enabled={account.passwordAuthEnabled} />
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Phương thức đăng nhập
        </h2>
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-hairline px-4 py-3">
            <div>
              <p className="text-[16px] font-semibold leading-[1.50] text-ink">
                Mật khẩu
              </p>
              <p className="text-[14px] leading-[1.50] text-steel">
                {account.passwordAuthEnabled ? "Đã bật" : "Chưa cấu hình"}
              </p>
            </div>
            <span
              className={
                account.passwordAuthEnabled ? "badge-success" : "pill-tab"
              }
            >
              {account.passwordAuthEnabled ? "Connected" : "Unavailable"}
            </span>
          </div>

          {providers.map((provider) => {
            const connected = connectedProviders.has(provider.id);
            return (
              <div
                key={provider.id}
                className="flex items-center justify-between rounded-lg border border-hairline px-4 py-3"
              >
                <div>
                  <p className="text-[16px] font-semibold leading-[1.50] text-ink">
                    {provider.label}
                  </p>
                  <p className="text-[14px] leading-[1.50] text-steel">
                    {connected ? "Đã kết nối" : "Chưa kết nối"}
                  </p>
                </div>
                {connected ? (
                  <form action={disconnectOAuthProvider}>
                    <input type="hidden" name="provider" value={provider.id} />
                    <button
                      type="submit"
                      className="button-tertiary h-9 px-4 text-[13px] !border-error !text-error"
                    >
                      Ngắt kết nối
                    </button>
                  </form>
                ) : (
                  <Link
                    href={`/api/auth/oauth/${provider.id}`}
                    className="button-tertiary h-9 px-4 text-[13px]"
                  >
                    Kết nối
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-hairline bg-canvas p-6 sm:p-8">
        <h2 className="text-[24px] font-semibold leading-[1.30] text-ink">
          Quyền riêng tư & dữ liệu
        </h2>
        <div className="mt-4 space-y-3 text-[15px] leading-[1.60] text-slate">
          <p>
            <strong className="text-ink">File audio/video</strong> được upload
            tạm lên máy chủ (thư mục uploads) để Gemini phiên âm, rồi có thể bị
            dọn khi hết hạn. App không dùng file đó để huấn luyện model của
            cuochop.
          </p>
          <p>
            <strong className="text-ink">Transcript & notes</strong> được gửi
            tới Google Gemini để tạo ghi chú. Nội dung đã lưu (notes, action,
            decision) nằm trong database SQLite trên server bạn triển khai.
          </p>
          <p>
            <strong className="text-ink">Backup</strong> — tải JSON hoặc Markdown
            bất kỳ lúc nào; import lại khi cần khôi phục.
          </p>
        </div>
      </section>

      <ExportDataSection />
    </main>
  );
}
