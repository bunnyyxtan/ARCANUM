import { TRPCError } from "@trpc/server";

import type { ApiContext } from "./context";
import { consumeRateLimit, rateLimitFailure } from "./rate-limit-store";

type ProcedureKind = "query" | "mutation" | "subscription";

export async function enforceRateLimit(
  ctx: ApiContext,
  type: ProcedureKind,
  path: string,
): Promise<void> {
  if (type === "subscription") return;
  const identity = ctx.session
    ? JSON.stringify(["session", ctx.session.tenantId, ctx.session.walletAddress.toLowerCase()])
    : JSON.stringify(["anonymous", ctx.requestFingerprint || "unidentified"]);
  try {
    await consumeRateLimit({
      scope: `api:${type}:${path}`,
      identity,
      limit: type === "query" ? 600 : 60,
      windowMs: 60_000,
    });
  } catch (cause) {
    const failure = rateLimitFailure(cause);
    throw new TRPCError({
      code: failure?.status === 429 ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE",
      message: failure?.message ?? "Rate limit service unavailable.",
      cause,
    });
  }
}
