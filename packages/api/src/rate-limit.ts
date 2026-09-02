import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { ApiContext } from "./context";

type ProcedureKind = "query" | "mutation" | "subscription";
type LimitedKind = Exclude<ProcedureKind, "subscription">;

type Bucket = { count: number; resetAt: number };

const WINDOW_MS = 60_000;
const LIMITS: Record<LimitedKind, number> = { query: 600, mutation: 60 };

declare global {
  var __arcanumApiRateLimitBuckets: Map<string, Bucket> | undefined;
}

globalThis.__arcanumApiRateLimitBuckets ??= new Map<string, Bucket>();
const fallbackBuckets = globalThis.__arcanumApiRateLimitBuckets;

let queryLimiter: Ratelimit | undefined;
let mutationLimiter: Ratelimit | undefined;
let warnedAboutFallback = false;

export async function enforceRateLimit(
  ctx: ApiContext,
  type: ProcedureKind,
  path: string,
): Promise<void> {
  if (type === "subscription") {
    return;
  }

  // An unidentifiable caller still gets a bucket. Skipping the limit when no
  // identity could be derived meant the most exposed surface in the product -
  // public, unauthenticated mutations such as paymentIntents.create - was the
  // one running without any ceiling at all.
  const identity = ctx.session
    ? `${ctx.session.tenantId}:${ctx.session.walletAddress.toLowerCase()}`
    : (ctx.requestFingerprint ?? "unidentified");

  const key = `${identity}:${type}:${path}`;
  const limiter = limiterFor(type);

  if (!limiter) {
    enforceInProcessLimit(type, key);
    return;
  }

  const result = await limiter.limit(key);

  if (!result.success) {
    throw tooManyRequests(new Date(result.reset));
  }
}

function limiterFor(type: LimitedKind) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return undefined;
  }

  if (type === "mutation") {
    mutationLimiter ??= new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(LIMITS.mutation, "1 m"),
      prefix: "arcanum:mutation",
    });
    return mutationLimiter;
  }

  queryLimiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(LIMITS.query, "1 m"),
    prefix: "arcanum:query",
  });
  return queryLimiter;
}

/**
 * Per-process ceiling used when the shared Upstash backend is absent.
 *
 * A missing environment variable used to remove rate limiting entirely, with
 * no error and no log line - the protection disappeared exactly when nobody
 * was looking. A process-local limit is weaker than a shared one (it does not
 * hold across instances and it resets on redeploy), but it is a ceiling rather
 * than an open door, and it says so loudly. Deployments that cannot accept the
 * weaker guarantee set ARCANUM_REQUIRE_RATE_LIMIT_BACKEND=true and fail closed
 * instead.
 */
function enforceInProcessLimit(type: LimitedKind, key: string) {
  if (process.env.ARCANUM_REQUIRE_RATE_LIMIT_BACKEND === "true") {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Rate limit backend is not configured.",
    });
  }

  warnAboutFallbackOnce();

  const now = Date.now();
  const bucket = fallbackBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    pruneExpiredBuckets(now);
    fallbackBuckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  bucket.count += 1;

  if (bucket.count <= LIMITS[type]) {
    return;
  }

  throw tooManyRequests(new Date(bucket.resetAt));
}

function tooManyRequests(reset: Date) {
  return new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: `Rate limit exceeded. Retry after ${reset.toISOString()}.`,
  });
}

function warnAboutFallbackOnce() {
  if (warnedAboutFallback) {
    return;
  }

  warnedAboutFallback = true;
  console.error(
    "[arcanum-api] UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN are not configured - falling back to a per-process rate limit that does not hold across instances.",
  );
}

function pruneExpiredBuckets(now: number) {
  if (fallbackBuckets.size < 5_000) {
    return;
  }

  for (const [key, bucket] of fallbackBuckets) {
    if (bucket.resetAt <= now) {
      fallbackBuckets.delete(key);
    }
  }
}
