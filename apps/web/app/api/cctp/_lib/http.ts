import { IS_ARC_MAINNET } from "@arcanum/shared";
import { NextResponse } from "next/server";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;
const MAX_BUCKETS = 2_000;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Public, read-only endpoints: source transactions and their recipient are
 * public chain data. Per-instance throttling is a dampener, not a global quota.
 * Neither endpoint accepts an RPC URL or signs/broadcasts a transaction.
 */
export function guardRequest(request: Request): Response | undefined {
  if (IS_ARC_MAINNET) {
    return jsonResponse({ error: "CCTP funding is available on Arc Testnet only." }, 400);
  }
  const now = Date.now();
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt > now) {
    if (bucket.count >= MAX_REQUESTS) {
      const response = jsonResponse({ error: "Too many funding requests. Wait a minute." }, 429);
      response.headers.set("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1_000)));
      return response;
    }
    bucket.count++;
    return;
  }
  for (const [identity, value] of buckets) {
    if (value.resetAt <= now) buckets.delete(identity);
  }
  if (buckets.size >= MAX_BUCKETS) {
    return jsonResponse({ error: "Funding checks are busy. Please try again shortly." }, 503);
  }
  buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
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
