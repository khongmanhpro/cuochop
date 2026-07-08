"use client";

import { use, useActionState } from "react";
import Link from "next/link";
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
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-8">
        <div className="mb-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-brand-coral">
            cuochop
          </p>
          <h1 className="mt-3 text-[24px] font-semibold leading-[1.30] text-ink">
            Đăng nhập
          </h1>
        </div>

        <OAuthButtons />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[12px] font-medium uppercase text-stone">or</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        {linkProvider ? (
          <p className="mb-4 rounded-md border border-brand-blue-200 bg-brand-blue-200/40 px-3 py-2 text-[14px] text-brand-blue-deep">
            Nhập mật khẩu cho {params.email} để liên kết tài khoản {linkProvider}.
          </p>
        ) : null}

        {oauthMessage ? (
          <p className="mb-4 rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[14px] text-error">
            {oauthMessage}
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-[14px] font-semibold text-ink">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={params.email ?? ""}
              className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand-blue-deep"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-[14px] font-semibold text-ink">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand-blue-deep"
            />
          </div>

          {state?.message ? (
            <p className="rounded-md border border-error/30 bg-error/10 px-3 py-2 text-[14px] text-error">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="button-primary w-full disabled:!bg-hairline disabled:!text-muted"
          >
            {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-slate">
          Chưa có tài khoản?{" "}
          <Link href="/auth/signup" className="font-semibold text-ink hover:underline">
            Đăng ký miễn phí
          </Link>
        </p>
      </div>
    </main>
  );
}

function OAuthButtons() {
  return (
    <div className="space-y-2">
      <Link
        href="/api/auth/oauth/google"
        className="button-tertiary w-full"
      >
        Continue with Google
      </Link>
      <Link
        href="/api/auth/oauth/microsoft"
        className="button-tertiary w-full"
      >
        Continue with Microsoft
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
  if (value === "missing_code") return "Không nhận được mã xác thực từ nhà cung cấp.";
  if (value === "invalid_state") return "Phiên đăng nhập OAuth không hợp lệ.";
  if (value === "token_exchange_failed") return "Không đổi được mã xác thực OAuth.";
  if (value === "profile_failed") return "Không lấy được thông tin tài khoản OAuth.";
  if (value === "email_unverified") return "Email OAuth chưa được xác minh.";
  return null;
}
