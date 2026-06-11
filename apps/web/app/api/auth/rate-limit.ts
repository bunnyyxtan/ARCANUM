import { NextResponse } from "next/server";

type AuthRoute = "nonce" | "verify";
type RateLimitBucket = {
  count: number;
  resetAt: number;
};

declare global {
  var __arcanumAuthRateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

const AUTH_RATE_LIMITS = {
  nonce: { limit: 30, windowMs: 60_000 },
  verify: { limit: 10, windowMs: 60_000 },
} as const;

if (!globalThis.__arcanumAuthRateLimitBuckets) {
  globalThis.__arcanumAuthRateLimitBuckets = new Map<string, RateLimitBucket>();
}

const buckets = globalThis.__arcanumAuthRateLimitBuckets;

export function enforceAuthRouteRateLimit(request: Request, route: AuthRoute) {
  const now = Date.now();
  const config = AUTH_RATE_LIMITS[route];
  const key = `${route}:${clientFingerprint(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    pruneExpiredBuckets(now);
    buckets.set(key, { count: 1, resetAt: now + config.windowMs });
    return null;
  }

  bucket.count += 1;

  if (bucket.count <= config.limit) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

  return NextResponse.json(
    { error: "Too many sign-in attempts. Try again shortly." },
    {
      headers: { "Retry-After": String(retryAfter) },
      status: 429,
    },
  );
}

function clientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown-client";
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 5_000) {
    return;
  }

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
