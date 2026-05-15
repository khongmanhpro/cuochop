"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthFormState } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, isPending] = useActionState<AuthFormState, FormData>(
    signup,
    undefined,
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#eef3f8] px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase text-blue-700">cuochop</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Tạo tài khoản</h1>
          <p className="mt-1 text-sm text-slate-500">Miễn phí, không cần thẻ tín dụng.</p>
        </div>

        <form action={action} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-slate-900">
              Họ tên
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.name ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.name[0]}</p>
            ) : null}
          </div>

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
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.email ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.email[0]}</p>
            ) : null}
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
              autoComplete="new-password"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            {state?.errors?.password ? (
              <p className="mt-1 text-xs text-red-600">{state.errors.password[0]}</p>
            ) : null}
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
            {isPending ? "Đang tạo tài khoản..." : "Tạo tài khoản miễn phí"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Đã có tài khoản?{" "}
          <Link href="/auth/login" className="font-semibold text-blue-700 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </main>
  );
}
