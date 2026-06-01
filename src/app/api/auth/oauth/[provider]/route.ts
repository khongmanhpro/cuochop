import { redirect } from "next/navigation";
import {
  buildOAuthAuthorizationUrl,
  getOAuthProviderConfig,
  type OAuthProvider,
} from "@/lib/oauth";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params;
  const config = getOAuthProviderConfig(rawProvider);
  const url = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;
  const redirectUri = `${baseUrl}/api/auth/oauth/${config.provider}/callback`;

  redirect(
    buildOAuthAuthorizationUrl({
      provider: config.provider as OAuthProvider,
      redirectUri,
    }),
  );
}
