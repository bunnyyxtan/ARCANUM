import { createHash } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type RateLimitPolicy = {
  scope: string;
  identity: string;
  limit: number;
  windowMs: number;
};

export class RateLimitError extends Error {
  constructor(
    public readonly status: 429 | 503,
    public readonly retryAfter: number,
  ) {
    super(
      status === 429 ? "Too many requests. Try again shortly." : "Rate limit service unavailable.",
    );
    this.name = "RateLimitError";
  }
}

/** Handles the direct error and the sanitized tRPC wrapper without exposing store errors. */
export function rateLimitFailure(
  error: unknown,
): { status: 429 | 503; retryAfter: number; message: string } | null {
  const failure =
    error instanceof RateLimitError
      ? error
      : error instanceof Error && error.cause instanceof RateLimitError
        ? error.cause
        : null;
  return failure
    ? { status: failure.status, retryAfter: failure.retryAfter, message: failure.message }
    : null;
}

/** These headers must be overwritten by the trusted ingress, never appended from client input. */
export function clientRateLimitIdentity(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unidentified"
  );
}

type Bucket = { count: number; resetAt: number };
declare global {
  var __arcanumApiRateLimitBuckets: Map<string, Bucket> | undefined;
}
globalThis.__arcanumApiRateLimitBuckets ??= new Map<string, Bucket>();
const buckets = globalThis.__arcanumApiRateLimitBuckets;
const upstashLimiters = new Map<string, Ratelimit>();
const STORE_TIMEOUT_MS = 3_000;
let warned = false;

/** No raw wallet, tenant, IP, or procedure identifier is sent to the store. */
export function rateLimitKey(policy: RateLimitPolicy): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        "arcanum-rate-limit-v1",
        policy.scope,
        policy.identity,
        policy.limit,
        policy.windowMs,
      ]),
    )
    .digest("hex");
}

export async function consumeRateLimit(policy: RateLimitPolicy): Promise<void> {
  if (
    !policy.scope ||
    policy.scope.length > 256 ||
    !policy.identity ||
    policy.identity.length > 4096 ||
    !Number.isInteger(policy.limit) ||
    policy.limit < 1 ||
    policy.limit > 1_000_000 ||
    !Number.isInteger(policy.windowMs) ||
    policy.windowMs < 1_000 ||
    policy.windowMs > 3_600_000
  ) {
    throw new RateLimitError(503, 5);
  }
  const key = rateLimitKey(policy);
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    // Selection is configuration-driven: a broken configured backend never falls
    // through to another backend (which would give callers a fresh quota).
    if (redisUrl || redisToken) {
      if (!redisUrl || !redisToken) throw new RateLimitError(503, 5);
      const cacheKey = JSON.stringify([redisUrl, redisToken, policy.limit, policy.windowMs]);
      let limiter = upstashLimiters.get(cacheKey);
      if (!limiter) {
        limiter = new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(policy.limit, `${policy.windowMs} ms`),
          prefix: "arcanum:rate-limit:v1",
          // Upstash otherwise permits traffic on its timeout fallback.
          timeout: 0,
          ephemeralCache: false,
          analytics: false,
        });
        upstashLimiters.set(cacheKey, limiter);
      }
      const result = await bounded(limiter.limit(key));
      if (
        result.reason === "timeout" ||
        typeof result.success !== "boolean" ||
        !Number.isFinite(result.reset)
      ) {
        throw new RateLimitError(503, 5);
      }
      if (!result.success) {
        throw new RateLimitError(429, Math.max(1, Math.ceil((result.reset - Date.now()) / 1_000)));
      }
      return;
    }
    if (supabaseUrl && serviceKey) {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/consume_rate_limit`,
        {
          method: "POST",
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            p_key: key,
            p_limit: policy.limit,
            p_window_ms: policy.windowMs,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        void response.body?.cancel().catch(() => {});
        throw new RateLimitError(503, 5);
      }
      const rows: unknown = await response.json();
      const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
      if (
        !row ||
        typeof row.allowed !== "boolean" ||
        !Number.isInteger(row.retry_after) ||
        row.retry_after < 1 ||
        row.retry_after > 3_600
      ) {
        throw new RateLimitError(503, 5);
      }
      if (!row.allowed) throw new RateLimitError(429, row.retry_after);
      return;
    }
    if (
      serviceKey ||
      process.env.ARCANUM_REQUIRE_RATE_LIMIT_BACKEND === "true" ||
      !["development", "test"].includes(process.env.NODE_ENV ?? "") ||
      process.env.ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT !== "true"
    ) {
      throw new RateLimitError(503, 5);
    }
    if (!warned) {
      warned = true;
      console.warn(
        "[arcanum-api] Explicit development-only in-memory rate limits enabled; not distributed.",
      );
    }
    consumeInMemory(key, policy);
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    // Never return backend messages, URLs, credentials, or response bodies.
    throw new RateLimitError(503, 5);
  }
}

async function bounded<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new RateLimitError(503, 5)), STORE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function consumeInMemory(key: string, policy: RateLimitPolicy) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now) {
    bucket.count = Math.min(bucket.count + 1, policy.limit + 1);
    if (bucket.count > policy.limit) {
      throw new RateLimitError(429, Math.max(1, Math.ceil((bucket.resetAt - now) / 1_000)));
    }
    return;
  }
  // Bounded work and memory; never evict a live quota to admit a fresh identity.
  let scanned = 0;
  for (const [oldKey, oldBucket] of buckets) {
    if (++scanned > 100) break;
    if (oldBucket.resetAt <= now) buckets.delete(oldKey);
  }
  if (buckets.size >= 10_000 && !buckets.has(key)) throw new RateLimitError(503, 5);
  buckets.set(key, { count: 1, resetAt: now + policy.windowMs });
}
