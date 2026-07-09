"use client";

import { use, useActionState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { login, type AuthFormState } from "@/app/actions/auth";

type LoginSearchParams = { link?: string; email?: string; oauth?: string };

export default function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<LoginSearchParams>;
}) {
  const [state, action, isPending] = useActionState<AuthFormState, FormData>(
    login,
    undefined,
  );
  const params = use(searchParams ?? Promise.resolve({} as LoginSearchParams));
  const linkProvider = formatProvider(params.link);
  const oauthMessage = formatOAuthMessage(params.oauth);

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="mb-8">
          <Link href="/" aria-label="Trang chủ">
            <Logo width={148} height={40} className="mb-4" />
          </Link>
          <h1 className="text-[24px] font-semibold leading-[1.30] text-ink">
            Đăng nhập
          </h1>
          <p className="mt-2 text-[14px] leading-[1.50] text-slate">
            Vào workspace để xử lý ghi chú và công việc sau họp.
          </p>
        </div>

        <OAuthButtons />

        <div className="auth-divider">
          <span>hoặc</span>
        </div>

        {linkProvider ? (
          <p className="mb-4 rounded-lg border border-brand-blue-200 bg-brand-blue-200/40 px-3 py-2 text-[14px] text-brand-blue-deep">
            Nhập mật khẩu cho {params.email} để liên kết tài khoản{" "}
            {linkProvider}.
          </p>
        ) : null}

        {oauthMessage ? (
          <p className="mb-4 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[14px] text-error">
            {oauthMessage}
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={params.email ?? ""}
              className="field-input"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="field-input"
            />
          </div>

          {state?.message ? (
            <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-[14px] text-error">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="button-primary w-full"
          >
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-slate">
          Chưa có tài khoản?{" "}
          <Link
            href="/auth/signup"
            className="font-semibold text-ink hover:underline"
          >
            Đăng ký
          </Link>
        </p>
      </div>
    </main>
  );
}

function OAuthButtons() {
  return (
    <div className="space-y-2">
      <Link href="/api/auth/oauth/google" className="button-tertiary w-full">
        Tiếp tục với Google
      </Link>
      <Link href="/api/auth/oauth/microsoft" className="button-tertiary w-full">
        Tiếp tục với Microsoft
      </Link>
    </div>
  );
}

function formatProvider(value?: string) {
  if (value === "google") return "Google";
  if (value === "microsoft") return "Microsoft";
  return null;
}

function formatOAuthMessage(value?: string) {
  if (value === "config_missing") {
    return "Đăng nhập OAuth chưa được cấu hình. Vui lòng kiểm tra Client ID và Client Secret.";
  }
  if (value === "missing_code")
    return "Không nhận được mã xác thực từ nhà cung cấp.";
  if (value === "invalid_state") return "Phiên đăng nhập OAuth không hợp lệ.";
  if (value === "token_exchange_failed")
    return "Không đổi được mã xác thực OAuth.";
  if (value === "profile_failed")
    return "Không lấy được thông tin tài khoản OAuth.";
  if (value === "email_unverified") return "Email OAuth chưa được xác minh.";
  return null;
}
