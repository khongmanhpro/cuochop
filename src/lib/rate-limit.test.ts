import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  checkGeminiRateLimit,
  checkRateLimit,
  clearAllRateLimits,
  rateLimitResponse,
  resetRateLimit,
} from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => clearAllRateLimits());
  afterEach(() => clearAllRateLimits());

  test("allows first request", () => {
    const result = checkRateLimit("user-1", 5, 60_000, 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  test("allows up to max requests", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit("user-1", 5, 60_000, 1000 + i * 1000);
      expect(result.allowed).toBe(true);
    }
  });

  test("blocks 6th request within window", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, 1000 + i * 1000);
    }
    const result = checkRateLimit("user-1", 5, 60_000, 6000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test("allows again after window expires", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, 1000 + i * 1000);
    }
    // 61 seconds later — only requests at t=3,4,5s are still in window
    const result = checkRateLimit("user-1", 5, 60_000, 62_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  test("tracks users independently", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, 1000 + i * 1000);
    }
    const result = checkRateLimit("user-2", 5, 60_000, 6000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  test("retryAfterMs is based on oldest request in window", () => {
    const baseTime = 10_000;
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, baseTime + i * 1000);
    }
    // 6th request at baseTime + 5s
    const result = checkRateLimit("user-1", 5, 60_000, baseTime + 5000);
    // Oldest request at baseTime, window is 60s, so retry after baseTime + 60s - (baseTime + 5s) = 55s
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBe(55_000);
  });

  test("sliding window — old requests drop off", () => {
    // 5 requests at t=0..4s
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, i * 1000);
    }
    // At t=61s, requests at t=0,1 expired (windowStart=1s), 3 remain (t=2,3,4), 1 slot free
    const result = checkRateLimit("user-1", 5, 60_000, 61_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });
});

describe("checkGeminiRateLimit", () => {
  beforeEach(() => clearAllRateLimits());
  afterEach(() => clearAllRateLimits());

  test("allows 5 requests per minute per user", () => {
    for (let i = 0; i < 5; i++) {
      const result = checkGeminiRateLimit("user-1", 1000 + i * 1000);
      expect(result.allowed).toBe(true);
    }
    const result = checkGeminiRateLimit("user-1", 6000);
    expect(result.allowed).toBe(false);
  });

  test("different users have separate limits", () => {
    for (let i = 0; i < 5; i++) {
      checkGeminiRateLimit("user-1", 1000 + i * 1000);
    }
    const result = checkGeminiRateLimit("user-2", 6000);
    expect(result.allowed).toBe(true);
  });
});

describe("resetRateLimit", () => {
  beforeEach(() => clearAllRateLimits());

  test("clears bucket for a specific key", () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit("user-1", 5, 60_000, 1000 + i * 1000);
    }
    expect(checkRateLimit("user-1", 5, 60_000, 6000).allowed).toBe(false);

    resetRateLimit("user-1");
    expect(checkRateLimit("user-1", 5, 60_000, 6000).allowed).toBe(true);
  });
});

describe("rateLimitResponse", () => {
  test("returns 429 with Retry-After header", () => {
    const response = rateLimitResponse(55_000);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("55");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  test("rounds up retryAfter to at least 1 second", () => {
    const response = rateLimitResponse(500);
    expect(response.headers.get("Retry-After")).toBe("1");
  });

  test("body contains error code and Vietnamese message", async () => {
    const response = rateLimitResponse(30_000);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.message).toContain("30 giây");
  });
});
