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
    <main className="flex min-h-screen items-center justify-center bg-surface px-6">
      <div className="w-full max-w-sm rounded-xl border border-hairline bg-canvas p-8">
        <div className="mb-8">
          <Logo width={120} height={32} className="mb-3" />
          <h1 className="text-[24px] font-semibold leading-[1.30] text-ink">
            Tạo tài khoản
          </h1>
          <p className="mt-2 text-[14px] leading-[1.50] text-steel">
            Miễn phí, không cần thẻ tín dụng.
          </p>
        </div>

        <OAuthButtons />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-hairline" />
          <span className="text-[12px] font-medium uppercase text-stone">or</span>
          <div className="h-px flex-1 bg-hairline" />
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-[14px] font-semibold text-ink">
              Họ tên
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand-blue-deep"
            />
            {state?.errors?.name ? (
              <p className="mt-2 text-[13px] text-error">{state.errors.name[0]}</p>
            ) : null}
          </div>

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
              className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand-blue-deep"
            />
            {state?.errors?.email ? (
              <p className="mt-2 text-[13px] text-error">{state.errors.email[0]}</p>
            ) : null}
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
              autoComplete="new-password"
              className="mt-2 h-10 w-full rounded-md border border-hairline bg-canvas px-3 text-[14px] text-ink outline-none focus:border-brand-blue-deep"
            />
            {state?.errors?.password ? (
              <p className="mt-2 text-[13px] text-error">{state.errors.password[0]}</p>
            ) : null}
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
            {isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
          </button>
        </form>

        <p className="mt-6 text-center text-[14px] text-slate">
          Đã có tài khoản?{" "}
          <Link href="/auth/login" className="font-semibold text-ink hover:underline">
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
