import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  buildOAuthAuthorizationUrl,
  buildOAuthRedirectUri,
  createOAuthStateNonce,
  getMissingOAuthEnv,
  getOAuthProviderConfig,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE_SECONDS,
  type OAuthProvider,
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
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;
  const redirectUri = buildOAuthRedirectUri(baseUrl, config.provider);
  const stateNonce = createOAuthStateNonce();

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, stateNonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
    path: "/",
  });

  redirect(
    buildOAuthAuthorizationUrl({
      provider: config.provider as OAuthProvider,
      redirectUri,
      stateNonce,
    }),
  );
}
