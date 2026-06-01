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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-blue-700">cuochop</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Đăng nhập</h1>
        </div>

        <OAuthButtons />

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs font-medium uppercase text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {linkProvider ? (
          <p className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            Nhập mật khẩu cho {params.email} để liên kết tài khoản {linkProvider}.
          </p>
        ) : null}

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-slate-900">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue={params.email ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-slate-900">
              Mật khẩu
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {state?.message ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-md bg-blue-700 text-sm font-semibold text-white transition enabled:hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {isPending ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Chưa có tài khoản?{" "}
          <Link href="/auth/signup" className="font-semibold text-blue-700 hover:underline">
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
        className="flex h-10 w-full items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Continue with Google
      </Link>
      <Link
        href="/api/auth/oauth/microsoft"
        className="flex h-10 w-full items-center justify-center rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50"
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
