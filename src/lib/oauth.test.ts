import { afterEach, describe, expect, test, vi } from "vitest";
import {
  buildOAuthAuthorizationUrl,
  buildOAuthRedirectUri,
  canDisconnectAuthMethod,
  createOAuthState,
  createOAuthStateNonce,
  createPendingOAuthLinkToken,
  getMissingOAuthEnv,
  getOAuthProviderConfig,
  parseOAuthState,
  parsePendingOAuthLinkToken,
  verifyOAuthState,
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
        stateNonce: "google-state-nonce",
      }),
    );

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("google-client");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(parseOAuthState(url.searchParams.get("state") ?? "")).toMatchObject({
      provider: "google",
      nonce: "google-state-nonce",
    });
  });

  test("builds Microsoft authorization URL with User.Read scope", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");
    vi.stubEnv("MICROSOFT_CLIENT_ID", "microsoft-client");

    const url = new URL(
      buildOAuthAuthorizationUrl({
        provider: "microsoft",
        redirectUri: "https://app.example/api/auth/oauth/microsoft/callback",
        stateNonce: "microsoft-state-nonce",
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

  test("reports missing provider environment variables", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");
    vi.stubEnv("GOOGLE_CLIENT_ID", "google-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "");

    expect(getMissingOAuthEnv("google")).toEqual(["GOOGLE_CLIENT_SECRET"]);
    expect(getMissingOAuthEnv("microsoft")).toEqual([
      "MICROSOFT_CLIENT_ID",
      "MICROSOFT_CLIENT_SECRET",
    ]);
  });

  test("builds redirect URI without duplicating trailing slashes", () => {
    expect(buildOAuthRedirectUri("https://note.softhubtech.com/", "google")).toBe(
      "https://note.softhubtech.com/api/auth/oauth/google/callback",
    );
    expect(buildOAuthRedirectUri("https://note.softhubtech.com", "microsoft")).toBe(
      "https://note.softhubtech.com/api/auth/oauth/microsoft/callback",
    );
  });
});

describe("OAuth state", () => {
  test("creates a browser nonce for state binding", () => {
    const nonce = createOAuthStateNonce();

    expect(nonce).toHaveLength(22);
  });

  test("round-trips a signed provider state with nonce", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const state = createOAuthState({ provider: "google", nonce: "browser-nonce" });

    expect(parseOAuthState(state)).toEqual({ provider: "google", nonce: "browser-nonce" });
    expect(verifyOAuthState(state, "browser-nonce")).toEqual({
      provider: "google",
      nonce: "browser-nonce",
    });
  });

  test("rejects a tampered signed state", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const state = createOAuthState({ provider: "google", nonce: "browser-nonce" });
    const [payload, signature] = state.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ provider: "microsoft", nonce: "browser-nonce" }),
      "utf8",
    ).toString("base64url");

    expect(() => parseOAuthState(`${tamperedPayload}.${signature}`)).toThrow(
      "Invalid signed OAuth payload.",
    );
    expect(payload).toBeTruthy();
  });

  test("rejects state without the matching browser nonce", () => {
    vi.stubEnv("SESSION_SECRET", "12345678901234567890123456789012");

    const state = createOAuthState({ provider: "google", nonce: "browser-nonce" });

    expect(() => verifyOAuthState(state, undefined)).toThrow("Missing OAuth state cookie.");
    expect(() => verifyOAuthState(state, "other-nonce")).toThrow(
      "OAuth state nonce mismatch.",
    );
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
