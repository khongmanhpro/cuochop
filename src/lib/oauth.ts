import { createHmac, randomBytes } from "node:crypto";

export const OAUTH_PROVIDERS = ["google", "microsoft"] as const;
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export type OAuthProfile = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string | null;
  emailVerified: boolean;
};

export type PendingOAuthLink = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string | null;
  expiresAt: number;
};

export const OAUTH_STATE_COOKIE = "cuochop_oauth_state";
export const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
export const PENDING_OAUTH_LINK_COOKIE = "cuochop_pending_oauth_link";

type OAuthProviderConfig = {
  provider: OAuthProvider;
  clientIdEnv: string;
  clientSecretEnv: string;
  authorizationUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scopes: string[];
};

const configs: Record<OAuthProvider, OAuthProviderConfig> = {
  google: {
    provider: "google",
    clientIdEnv: "GOOGLE_CLIENT_ID",
    clientSecretEnv: "GOOGLE_CLIENT_SECRET",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  microsoft: {
    provider: "microsoft",
    clientIdEnv: "MICROSOFT_CLIENT_ID",
    clientSecretEnv: "MICROSOFT_CLIENT_SECRET",
    authorizationUrl:
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    profileUrl: "https://graph.microsoft.com/v1.0/me",
    scopes: ["openid", "email", "profile", "User.Read"],
  },
};

export function getOAuthProviderConfig(provider: string): OAuthProviderConfig {
  if (provider === "google" || provider === "microsoft") {
    return configs[provider];
  }
  throw new Error("Unsupported OAuth provider.");
}

export function getMissingOAuthEnv(provider: OAuthProvider) {
  const config = getOAuthProviderConfig(provider);
  return ["SESSION_SECRET", config.clientIdEnv, config.clientSecretEnv].filter(
    (name) => !process.env[name],
  );
}

export function buildOAuthRedirectUri(baseUrl: string, provider: OAuthProvider) {
  return `${baseUrl.replace(/\/+$/, "")}/api/auth/oauth/${provider}/callback`;
}

export function buildOAuthAuthorizationUrl({
  provider,
  redirectUri,
  stateNonce,
}: {
  provider: OAuthProvider;
  redirectUri: string;
  stateNonce: string;
}) {
  const config = getOAuthProviderConfig(provider);
  const params = new URLSearchParams({
    client_id: requireEnv(config.clientIdEnv),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    state: createOAuthState({ provider, nonce: stateNonce }),
  });

  if (provider === "google") {
    params.set("access_type", "offline");
    params.set("prompt", "select_account");
  }

  return `${config.authorizationUrl}?${params.toString()}`;
}

export function createOAuthStateNonce() {
  return randomBytes(16).toString("base64url");
}

export function createOAuthState({
  provider,
  nonce,
}: {
  provider: OAuthProvider;
  nonce: string;
}) {
  if (!nonce) throw new Error("OAuth state nonce is required.");

  const payload = Buffer.from(
    JSON.stringify({ provider, nonce }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseOAuthState(state: string): { provider: OAuthProvider; nonce: string } {
  const payload = verifySignedPayload(state);
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    provider?: unknown;
    nonce?: unknown;
  };

  if (
    (parsed.provider !== "google" && parsed.provider !== "microsoft") ||
    typeof parsed.nonce !== "string" ||
    !parsed.nonce
  ) {
    throw new Error("Invalid OAuth state.");
  }

  return { provider: parsed.provider, nonce: parsed.nonce };
}

export function verifyOAuthState(state: string, expectedNonce: string | undefined) {
  if (!expectedNonce) throw new Error("Missing OAuth state cookie.");

  const parsed = parseOAuthState(state);
  if (parsed.nonce !== expectedNonce) {
    throw new Error("OAuth state nonce mismatch.");
  }

  return parsed;
}

export function createPendingOAuthLinkToken({
  provider,
  providerAccountId,
  email,
  name,
}: Omit<PendingOAuthLink, "expiresAt">) {
  const payload = Buffer.from(
    JSON.stringify({
      provider,
      providerAccountId,
      email,
      name,
      expiresAt: Date.now() + 10 * 60 * 1000,
    }),
    "utf8",
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parsePendingOAuthLinkToken(token: string): PendingOAuthLink {
  const payload = verifySignedPayload(token);
  const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingOAuthLink;

  if (
    (parsed.provider !== "google" && parsed.provider !== "microsoft") ||
    typeof parsed.providerAccountId !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.expiresAt !== "number"
  ) {
    throw new Error("Invalid pending OAuth link token.");
  }

  if (parsed.expiresAt < Date.now()) {
    throw new Error("Pending OAuth link expired.");
  }

  return parsed;
}

export function canDisconnectAuthMethod({
  passwordAuthEnabled,
  oauthProviderCount,
}: {
  passwordAuthEnabled: boolean;
  oauthProviderCount: number;
}) {
  return passwordAuthEnabled || oauthProviderCount > 1;
}

export async function exchangeOAuthCode({
  provider,
  code,
  redirectUri,
}: {
  provider: OAuthProvider;
  code: string;
  redirectUri: string;
}) {
  const config = getOAuthProviderConfig(provider);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requireEnv(config.clientIdEnv),
      client_secret: requireEnv(config.clientSecretEnv),
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });
  const body = (await response.json()) as {
    access_token?: string;
    error?: string;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(`OAuth token exchange failed: ${body.error || response.statusText}`);
  }

  return body.access_token;
}

export async function fetchOAuthProfile({
  provider,
  accessToken,
}: {
  provider: OAuthProvider;
  accessToken: string;
}): Promise<OAuthProfile> {
  const config = getOAuthProviderConfig(provider);
  const response = await fetch(config.profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`OAuth profile fetch failed: ${response.statusText}`);
  }

  if (provider === "google") {
    const id = stringValue(body.id);
    const email = stringValue(body.email)?.toLowerCase();
    if (!id || !email) throw new Error("Google OAuth profile is missing email.");
    return {
      provider,
      providerAccountId: id,
      email,
      name: stringValue(body.name),
      emailVerified: body.verified_email === true,
    };
  }

  const id = stringValue(body.id);
  const email = (stringValue(body.mail) || stringValue(body.userPrincipalName))?.toLowerCase();
  if (!id || !email) throw new Error("Microsoft OAuth profile is missing email.");
  return {
    provider,
    providerAccountId: id,
    email,
    name: stringValue(body.displayName),
    emailVerified: true,
  };
}

export function createUnusablePasswordHash() {
  return `oauth:${randomBytes(32).toString("hex")}`;
}

function verifySignedPayload(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature || sign(payload) !== signature) {
    throw new Error("Invalid signed OAuth payload.");
  }
  return payload;
}

function sign(payload: string) {
  return createHmac("sha256", requireEnv("SESSION_SECRET"))
    .update(payload)
    .digest("base64url");
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
