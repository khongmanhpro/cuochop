"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  parsePendingOAuthLinkToken,
  PENDING_OAUTH_LINK_COOKIE,
} from "@/lib/oauth";
import { createSession, deleteSession } from "@/lib/session";

const SignupSchema = z.object({
  name: z.string().min(2, { message: "Tên phải có ít nhất 2 ký tự." }).trim(),
  email: z.string().email({ message: "Email không hợp lệ." }).trim().toLowerCase(),
  password: z
    .string()
    .min(8, { message: "Mật khẩu phải có ít nhất 8 ký tự." })
    .trim(),
});

const LoginSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().trim(),
});

export type AuthFormState = {
  errors?: Record<string, string[]>;
  message?: string;
} | undefined;

export async function signup(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = SignupSchema.safeParse(raw);

  if (!result.success) {
    return { errors: result.error.flatten().fieldErrors };
  }

  const { name, email, password } = result.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { errors: { email: ["Email này đã được sử dụng."] } };
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name, email, passwordHash },
  });

  await createSession(user.id);
  redirect("/app");
}

export async function login(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const result = LoginSchema.safeParse(raw);
  if (!result.success) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const { email, password } = result.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  if (!user.passwordAuthEnabled) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { message: "Email hoặc mật khẩu không đúng." };
  }

  const linkedProvider = await linkPendingOAuthAccountIfPresent(user.id, email);
  await createSession(user.id, linkedProvider || "password");
  redirect("/app");
}

export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/");
}

async function linkPendingOAuthAccountIfPresent(userId: string, email: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PENDING_OAUTH_LINK_COOKIE)?.value;
  if (!token) return null;

  try {
    const pending = parsePendingOAuthLinkToken(token);
    if (pending.email !== email) return null;

    await prisma.oAuthAccount.upsert({
      where: {
        userId_provider: {
          userId,
          provider: pending.provider,
        },
      },
      create: {
        userId,
        provider: pending.provider,
        providerAccountId: pending.providerAccountId,
      },
      update: {
        providerAccountId: pending.providerAccountId,
      },
    });

    cookieStore.delete(PENDING_OAUTH_LINK_COOKIE);
    return pending.provider;
  } catch {
    cookieStore.delete(PENDING_OAUTH_LINK_COOKIE);
    return null;
  }
}
