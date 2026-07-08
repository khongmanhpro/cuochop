/**
 * In-memory per-user rate limiter for single-instance Docker deployments.
 *
 * Sliding window: counts requests within the last `windowMs` per key.
 * Not suitable for multi-instance deployments — use Redis for that.
 */

type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

// GC: periodically prune expired buckets to avoid unbounded memory growth
const GC_INTERVAL_MS = 5 * 60 * 1000;
let lastGcAt = 0;

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
};

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  pruneExpiredBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket) {
    buckets.set(key, { timestamps: [now] });
    return { allowed: true, remaining: maxRequests - 1, retryAfterMs: 0 };
  }

  // Drop timestamps outside the window
  const windowStart = now - windowMs;
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);

  if (bucket.timestamps.length >= maxRequests) {
    const oldestInWindow = bucket.timestamps[0];
    const retryAfterMs = Math.max(
      1,
      oldestInWindow + windowMs - now,
    );
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  bucket.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - bucket.timestamps.length,
    retryAfterMs: 0,
  };
}

export function resetRateLimit(key: string) {
  buckets.delete(key);
}

export function clearAllRateLimits() {
  buckets.clear();
}

function pruneExpiredBuckets(now: number) {
  if (now - lastGcAt < GC_INTERVAL_MS) return;
  lastGcAt = now;

  for (const [key, bucket] of buckets) {
    // If the newest timestamp is older than 10 minutes, drop the bucket
    const newest = bucket.timestamps[bucket.timestamps.length - 1];
    if (!newest || now - newest > 10 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}

// Pre-configured limiter for Gemini API calls
const GEMINI_MAX_REQUESTS = 5;
const GEMINI_WINDOW_MS = 60 * 1000;

export function checkGeminiRateLimit(
  userId: string,
  now: number = Date.now(),
): RateLimitResult {
  return checkRateLimit(
    `gemini:${userId}`,
    GEMINI_MAX_REQUESTS,
    GEMINI_WINDOW_MS,
    now,
  );
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSec = Math.ceil(retryAfterMs / 1000);
  return Response.json(
    {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: `Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSec} giây.`,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
        "Cache-Control": "no-store",
      },
    },
  );
}
