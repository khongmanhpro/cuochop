import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, getSession } from "@/lib/session";
import {
  createPendingOAuthLinkToken,
  createUnusablePasswordHash,
  buildOAuthRedirectUri,
  exchangeOAuthCode,
  fetchOAuthProfile,
  getMissingOAuthEnv,
  getOAuthProviderConfig,
  OAUTH_STATE_COOKIE,
  PENDING_OAUTH_LINK_COOKIE,
  verifyOAuthState,
  type OAuthProfile,
} from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params;
  const config = getOAuthProviderConfig(rawProvider);
  if (getMissingOAuthEnv(config.provider).length > 0) {
    redirect(`/auth/login?oauth=config_missing&provider=${config.provider}`);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) redirect("/auth/login?oauth=missing_code");

  const cookieStore = await cookies();
  const stateNonce = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(OAUTH_STATE_COOKIE);

  let parsedState: { provider: "google" | "microsoft"; nonce: string } | null = null;
  let invalidState = false;
  try {
    parsedState = verifyOAuthState(state, stateNonce);
  } catch {
    invalidState = true;
  }

  if (invalidState || parsedState?.provider !== config.provider) {
    redirect("/auth/login?oauth=invalid_state");
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;
  const redirectUri = buildOAuthRedirectUri(baseUrl, config.provider);
  let accessToken: string | null = null;
  let oauthError: string | null = null;
  try {
    accessToken = await exchangeOAuthCode({
      provider: config.provider,
      code,
      redirectUri,
    });
  } catch {
    oauthError = "token_exchange_failed";
  }

  if (oauthError || !accessToken) {
    redirect(`/auth/login?oauth=${oauthError ?? "token_exchange_failed"}`);
  }

  let profile: OAuthProfile | null = null;
  try {
    profile = await fetchOAuthProfile({
      provider: config.provider,
      accessToken,
    });
  } catch {
    oauthError = "profile_failed";
  }

  if (oauthError || !profile) {
    redirect(`/auth/login?oauth=${oauthError ?? "profile_failed"}`);
  }

  if (!profile.emailVerified) {
    redirect("/auth/login?oauth=email_unverified");
  }

  const linkedAccount = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    select: { userId: true },
  });

  if (linkedAccount) {
    await createSession(linkedAccount.userId, profile.provider);
    redirect("/app");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: profile.email },
    select: { id: true, passwordAuthEnabled: true },
  });
  const currentUser = await getSession();

  if (existingUser && currentUser?.id === existingUser.id) {
    await prisma.oAuthAccount.upsert({
      where: {
        userId_provider: {
          userId: existingUser.id,
          provider: profile.provider,
        },
      },
      create: {
        userId: existingUser.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
      update: {
        providerAccountId: profile.providerAccountId,
      },
    });
    redirect("/settings/account?oauth=connected");
  }

  if (existingUser?.passwordAuthEnabled) {
    cookieStore.set(
      PENDING_OAUTH_LINK_COOKIE,
      createPendingOAuthLinkToken({
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
        name: profile.name,
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60,
        path: "/",
      },
    );
    redirect(`/auth/login?link=${profile.provider}&email=${encodeURIComponent(profile.email)}`);
  }

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = existingUser
      ? await tx.user.findUniqueOrThrow({ where: { id: existingUser.id } })
      : await tx.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            passwordHash: createUnusablePasswordHash(),
            passwordAuthEnabled: false,
          },
        });

    await tx.oAuthAccount.upsert({
      where: {
        userId_provider: {
          userId: createdUser.id,
          provider: profile.provider,
        },
      },
      create: {
        userId: createdUser.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
      update: {
        providerAccountId: profile.providerAccountId,
      },
    });

    return createdUser;
  });

  await createSession(user.id, profile.provider);
  redirect("/app");
}
