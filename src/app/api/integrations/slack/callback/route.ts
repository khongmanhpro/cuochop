import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  encryptSlackToken,
  exchangeSlackOAuthCode,
  parseSlackOAuthState,
} from "@/lib/slack";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSession();
  if (!user) redirect("/auth/login");

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    redirect("/settings/team?slack=missing_code");
  }

  const parsedState = parseSlackOAuthState(state);
  if (parsedState.userId !== user.id) {
    redirect("/settings/team?slack=invalid_state");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: user.id,
        organizationId: parsedState.organizationId,
      },
    },
  });

  if (membership?.role !== "owner" && membership?.role !== "admin") {
    redirect("/settings/team?slack=forbidden");
  }

  const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL ?? url.origin}/api/integrations/slack/callback`;
  const oauth = await exchangeSlackOAuthCode({ code, redirectUri });

  await prisma.slackIntegration.upsert({
    where: { organizationId: parsedState.organizationId },
    create: {
      organizationId: parsedState.organizationId,
      teamId: oauth.teamId,
      accessToken: encryptSlackToken(oauth.accessToken),
    },
    update: {
      teamId: oauth.teamId,
      accessToken: encryptSlackToken(oauth.accessToken),
      channelId: null,
    },
  });

  redirect("/settings/team?slack=connected");
}
