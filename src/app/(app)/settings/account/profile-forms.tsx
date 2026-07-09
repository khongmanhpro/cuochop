"use client";

import { useActionState } from "react";
import {
  changePassword,
  updateDisplayName,
  type AccountFormState,
} from "./actions";

const initial: AccountFormState = {};

export function DisplayNameForm({ initialName }: { initialName: string }) {
  const [state, action, pending] = useActionState(updateDisplayName, initial);

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium text-ink">
        Tên hiển thị
        <input
          name="name"
          defaultValue={initialName}
          required
          minLength={2}
          maxLength={80}
          className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="button-primary h-10 px-5 disabled:opacity-50"
      >
        {pending ? "Đang lưu…" : "Lưu tên"}
      </button>
      {state.error ? (
        <p className="text-sm text-error">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success-text">{state.success}</p>
      ) : null}
    </form>
  );
}

export function ChangePasswordForm({ enabled }: { enabled: boolean }) {
  const [state, action, pending] = useActionState(changePassword, initial);

  if (!enabled) {
    return (
      <p className="text-sm text-steel">
        Tài khoản đăng nhập OAuth — không đổi mật khẩu tại đây.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm font-medium text-ink">
        Mật khẩu hiện tại
        <input
          type="password"
          name="currentPassword"
          required
          className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <label className="block text-sm font-medium text-ink">
        Mật khẩu mới
        <input
          type="password"
          name="newPassword"
          required
          minLength={8}
          className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <label className="block text-sm font-medium text-ink">
        Xác nhận mật khẩu mới
        <input
          type="password"
          name="confirmPassword"
          required
          minLength={8}
          className="mt-1 min-h-11 w-full rounded-xl border border-hairline bg-canvas px-4 text-[15px] outline-none focus:border-ink"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="button-primary h-10 px-5 disabled:opacity-50"
      >
        {pending ? "Đang đổi…" : "Đổi mật khẩu"}
      </button>
      {state.error ? (
        <p className="text-sm text-error">{state.error}</p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success-text">{state.success}</p>
      ) : null}
    </form>
  );
}
