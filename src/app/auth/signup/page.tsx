"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { signup, type AuthFormState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, isPending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined,
  );

  return (
    <main className="auth-shell">
      <div className="auth-card">
        <div className="mb-8">
          <Link href="/" aria-label="Trang chủ">
            <Logo width={148} height={40} className="mb-4" />
          </Link>
          <h1 className="text-[24px] font-semibold leading-[1.30] text-ink">
            Tạo tài khoản
          </h1>
          <p className="mt-2 text-[14px] leading-[1.50] text-slate">
            Dành cho team nội bộ — không cần thẻ tín dụng.
          </p>
        </div>

        <OAuthButtons />

        <div className="auth-divider">
          <span>hoặc</span>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="name" className="field-label">
              Họ tên
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="field-input"
            />
            {state?.errors?.name ? (
              <p className="mt-2 text-[13px] text-error">
                {state.errors.name[0]}
              </p>
            ) : null}
          </div>

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
              className="field-input"
            />
            {state?.errors?.email ? (
              <p className="mt-2 text-[13px] text-error">
                {state.errors.email[0]}
              </p>
            ) : null}
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
              autoComplete="new-password"
              className="field-input"
            />
            {state?.errors?.password ? (
              <p className="mt-2 text-[13px] text-error">
                {state.errors.password[0]}
              </p>
            ) : null}
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
            {isPending ? "Đang tạo…" : "Tạo tài khoản"}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-slate">
          Đã có tài khoản?{" "}
          <Link
            href="/auth/login"
            className="font-semibold text-ink hover:underline"
          >
            Đăng nhập
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
