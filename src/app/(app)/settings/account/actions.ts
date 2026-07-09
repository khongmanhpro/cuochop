"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { canDisconnectAuthMethod } from "@/lib/oauth";
import { getSession } from "@/lib/session";

export type AccountFormState = {
  error?: string;
  success?: string;
};

export async function updateDisplayName(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getSession();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const name = String(formData.get("name") || "").trim();
  if (name.length < 2) {
    return { error: "Tên hiển thị phải có ít nhất 2 ký tự." };
  }
  if (name.length > 80) {
    return { error: "Tên hiển thị tối đa 80 ký tự." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name },
  });

  revalidatePath("/settings/account");
  revalidatePath("/app");
  return { success: "Đã cập nhật tên hiển thị." };
}

export async function changePassword(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const user = await getSession();
  if (!user) return { error: "Bạn cần đăng nhập." };

  const currentPassword = String(formData.get("currentPassword") || "");
  const newPassword = String(formData.get("newPassword") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (newPassword.length < 8) {
    return { error: "Mật khẩu mới phải có ít nhất 8 ký tự." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Xác nhận mật khẩu không khớp." };
  }

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true, passwordAuthEnabled: true },
  });

  if (!account?.passwordAuthEnabled) {
    return {
      error: "Tài khoản này đăng nhập bằng OAuth — chưa bật mật khẩu.",
    };
  }

  const ok = await bcrypt.compare(currentPassword, account.passwordHash);
  if (!ok) {
    return { error: "Mật khẩu hiện tại không đúng." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  revalidatePath("/settings/account");
  return { success: "Đã đổi mật khẩu." };
}

export async function disconnectOAuthProvider(formData: FormData) {
  const user = await getSession();
  if (!user) throw new Error("Authentication is required.");

  const provider = String(formData.get("provider") || "");
  if (provider !== "google" && provider !== "microsoft") {
    throw new Error("Unsupported OAuth provider.");
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      passwordAuthEnabled: true,
      oauthAccounts: { select: { provider: true } },
    },
  });

  if (!current) throw new Error("User not found.");

  if (
    !canDisconnectAuthMethod({
      passwordAuthEnabled: current.passwordAuthEnabled,
      oauthProviderCount: current.oauthAccounts.length,
    })
  ) {
    throw new Error("You must keep at least one sign-in method.");
  }

  await prisma.oAuthAccount.deleteMany({
    where: {
      userId: user.id,
      provider,
    },
  });

  revalidatePath("/settings/account");
}
