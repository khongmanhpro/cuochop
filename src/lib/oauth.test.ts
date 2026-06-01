import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildOAuthAuthorizationUrl,
  canDisconnectAuthMethod,
  createOAuthState,
  createPendingOAuthLinkToken,
  getOAuthProviderConfig,
  parseOAuthState,
  parsePendingOAuthLinkToken,
} from "./oauth";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth provider config", () => {
  test("builds Google authorization URL with email and profile scopes", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");

    const url = new URL(
      buildOAuthAuthorizationUrl({
        provider: "google",
        redirectUri: "https://app.example/api/auth/oauth/google/callback",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBeTruthy();
  });

  test("builds Microsoft authorization URL with User.Read scope", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");
    vi.stubEnv("MICROSOFT_CLIENT_ID", "microsoft-client");

    const url = new URL(
      buildOAuthAuthorizationUrl({
        provider: "microsoft",
        redirectUri: "https://app.example/api/auth/oauth/microsoft/callback",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("microsoft-client");
    expect(url.searchParams.get("scope")).toBe("openid email profile User.Read");
  });

  test("rejects unsupported providers", () => {
    expect(() => getOAuthProviderConfig("github")).toThrow("Unsupported OAuth provider.");
  });
});

describe("OAuth state", () => {
  test("round-trips a signed provider state", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const state = createOAuthState({ provider: "google" });

    expect(parseOAuthState(state)).toEqual({ provider: "google" });
  });
});

describe("pending OAuth link token", () => {
  test("round-trips pending link data without plaintext tampering", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const token = createPendingOAuthLinkToken({
      provider: "google",
      providerAccountId: "google-123",
      email: "user@example.com",
      name: "User Example",
    });

    expect(parsePendingOAuthLinkToken(token)).toMatchObject({
      provider: "google",
      providerAccountId: "google-123",
      email: "user@example.com",
      name: "User Example",
    });
  });
});

describe("auth method disconnect safeguards", () => {
  test("blocks disconnecting the last auth method", () => {
    expect(
      canDisconnectAuthMethod({
        passwordAuthEnabled: false,
        oauthProviderCount: 1,
      }),
    ).toBe(false);
  });

  test("allows disconnecting one OAuth provider when password remains", () => {
    expect(
      canDisconnectAuthMethod({
        passwordAuthEnabled: true,
        oauthProviderCount: 1,
      }),
    ).toBe(true);
  });
});
