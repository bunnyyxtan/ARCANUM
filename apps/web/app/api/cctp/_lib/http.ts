import { clientRateLimitIdentity, consumeRateLimit, rateLimitFailure } from "@arcanum/api/server";
import { IS_ARC_MAINNET } from "@arcanum/shared";
import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Public, read-only endpoints: source transactions and their recipient are
 * public chain data. All server instances consume the same polling quota.
 * Neither endpoint accepts an RPC URL or signs/broadcasts a transaction.
 */
export async function guardRequest(request: Request): Promise<Response | undefined> {
  if (IS_ARC_MAINNET) {
    return jsonResponse(
      { error: "CCTP funding through this console is not available on Arc Mainnet yet." },
      400,
    );
  }
  try {
    await consumeRateLimit({
      scope: "cctp:read",
      identity: clientRateLimitIdentity(request),
      limit: MAX_REQUESTS,
      windowMs: WINDOW_MS,
    });
  } catch (error) {
    const failure = rateLimitFailure(error);
    const response = jsonResponse(
      { error: failure?.message ?? "Funding checks are unavailable. Try again shortly." },
      failure?.status ?? 503,
    );
    response.headers.set("Retry-After", String(failure?.retryAfter ?? 5));
    return response;
  }
}

export function upstreamError(error: unknown) {
  // Keep detailed provider responses out of the public API. A failed check
  // does not mean a burn failed and must never invite automatic resubmission.
  const message =
    error instanceof Error
      ? error.message.split("\n")[0]?.slice(0, 240)
      : "The funding provider could not be reached.";
  return jsonResponse(
    {
      error: `${message || "CCTP could not be verified."} No transaction was submitted by this check.`,
    },
    502,
  );
}
