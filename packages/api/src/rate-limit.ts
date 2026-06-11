import { TRPCError } from "@trpc/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import type { ApiContext } from "./context";

type ProcedureKind = "query" | "mutation" | "subscription";

let queryLimiter: Ratelimit | undefined;
let mutationLimiter: Ratelimit | undefined;

export async function enforceRateLimit(
  ctx: ApiContext,
  type: ProcedureKind,
  path: string,
): Promise<void> {
  if (type === "subscription") {
    return;
  }

  const limiter = limiterFor(type);
  if (!limiter) {
    return;
  }

  const identity = ctx.session
    ? `${ctx.session.tenantId}:${ctx.session.walletAddress.toLowerCase()}`
    : ctx.requestFingerprint;

  if (!identity) {
    return;
  }

  const key = `${identity}:${type}:${path}`;
  const result = await limiter.limit(key);

  if (!result.success) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Retry after ${new Date(result.reset).toISOString()}.`,
    });
  }
}

function limiterFor(type: ProcedureKind) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return undefined;
  }

  if (type === "mutation") {
    mutationLimiter ??= new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "arcanum:mutation",
    });
    return mutationLimiter;
  }

  queryLimiter ??= new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(600, "1 m"),
    prefix: "arcanum:query",
  });
  return queryLimiter;
}
