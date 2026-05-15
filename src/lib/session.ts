import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";

const SESSION_COOKIE = "cuochop_session";
const SESSION_DURATION_DAYS = 30;

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set and at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  planExpiresAt: Date | null;
  usageThisMonth: number;
  usageResetAt: Date;
};

export async function createSession(userId: string): Promise<void> {
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const session = await prisma.session.create({
    data: {
      id: crypto.randomUUID(),
      userId,
      expiresAt,
    },
  });

  const token = await new SignJWT({ sessionId: session.id })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecret());
    const sessionId = payload.sessionId as string;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    const user = session.user;

    // Lazy usage reset: if usageResetAt is in a previous calendar month, reset counter
    const now = new Date();
    const resetAt = new Date(user.usageResetAt);
    const needsReset =
      resetAt.getFullYear() < now.getFullYear() ||
      (resetAt.getFullYear() === now.getFullYear() &&
        resetAt.getMonth() < now.getMonth());

    if (needsReset) {
      await prisma.user.update({
        where: { id: user.id },
        data: { usageThisMonth: 0, usageResetAt: now },
      });
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        planExpiresAt: user.planExpiresAt,
        usageThisMonth: 0,
        usageResetAt: now,
      };
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt,
      usageThisMonth: user.usageThisMonth,
      usageResetAt: user.usageResetAt,
    };
  } catch {
    return null;
  }
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      const sessionId = payload.sessionId as string;
      await prisma.session.deleteMany({ where: { id: sessionId } });
    } catch {
      // token invalid, nothing to delete in DB
    }
  }

  cookieStore.delete(SESSION_COOKIE);
}
