import { ARC_NETWORK_NAME, ARC_RPC_URL, IS_ARC_MAINNET } from "@arcanum/shared";
import { NextResponse } from "next/server";

/**
 * Server-side JSON-RPC proxy for Arc chain READS.
 *
 * The public Arc RPC endpoints refuse CORS preflights and rate-limit browsers
 * aggressively, so any page that read the chain from client code could blank
 * out for real users. The wagmi transport now points every browser read here;
 * this route forwards to the RPC from the server, where neither problem
 * exists. Writes are untouched - they go through the user's wallet.
 *
 * Only read methods pass through: this endpoint is public, and it must never
 * become a relay for transactions or arbitrary RPC traffic.
 */
const READ_METHODS = new Set([
  "eth_blockNumber",
  "eth_call",
  "eth_chainId",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_getBalance",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getCode",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getTransactionReceipt",
  "eth_maxPriorityFeePerGas",
]);

/**
 * Ordered upstreams: env override first, then a free mirror (testnet only -
 * mainnet mirrors are unknown until launch), then the official endpoint for
 * the active network.
 */
const UPSTREAMS = [
  ...new Set(
    [
      process.env.ARC_RPC_URL,
      ...(IS_ARC_MAINNET ? [] : ["https://arc-testnet.drpc.org"]),
      ARC_RPC_URL,
    ].filter((url): url is string => Boolean(url)),
  ),
];

const MAX_BODY_BYTES = 20_000;
const MAX_BATCH_SIZE = 10;
const MAX_RESPONSE_BYTES = 1_000_000;
const UPSTREAM_TIMEOUT_MS = 15_000;

// Best-effort per-IP rate limit. Serverless instances each keep their own
// window, so this is a dampener, not a hard guarantee - but it stops a single
// client from turning this proxy into an amplification relay. Legit pages do
// well under 80 reads per 10s even while polling for a receipt.
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_MAX_REQUESTS = 80;
const requestLog = new Map<string, number[]>();

function isRateLimited(clientKey: string) {
  const now = Date.now();
  const cutoff = now - RATE_LIMIT_WINDOW_MS;
  const recent = (requestLog.get(clientKey) ?? []).filter((at) => at > cutoff);
  recent.push(now);
  if (requestLog.size > 10_000) {
    requestLog.clear();
  }
  requestLog.set(clientKey, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function rpcErrorResponse(status: number, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code, message } }, { status });
}

export async function POST(request: Request) {
  const clientKey = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(clientKey)) {
    return rpcErrorResponse(429, -32005, "Too many requests. Slow down.");
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return rpcErrorResponse(413, -32600, "Request body too large.");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return rpcErrorResponse(400, -32700, "Invalid JSON.");
  }

  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0 || items.length > MAX_BATCH_SIZE) {
    return rpcErrorResponse(400, -32600, "Invalid request batch.");
  }
  for (const item of items) {
    const method =
      typeof item === "object" && item !== null && "method" in item
        ? (item as { method: unknown }).method
        : null;
    if (typeof method !== "string" || !READ_METHODS.has(method)) {
      return rpcErrorResponse(
        403,
        -32601,
        `Only ${ARC_NETWORK_NAME} read methods are allowed through this proxy.`,
      );
    }
  }

  let lastFailure = "no upstream configured";
  for (const upstream of UPSTREAMS) {
    try {
      const response = await fetch(upstream, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: raw,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        cache: "no-store",
      });
      // Rate limits and upstream outages fall through to the next mirror
      // instead of surfacing as a dead page.
      if (response.status === 429 || response.status >= 500) {
        lastFailure = `upstream responded ${response.status}`;
        continue;
      }
      const body = await response.text();
      if (body.length > MAX_RESPONSE_BYTES) {
        return rpcErrorResponse(502, -32603, "Upstream response too large for this proxy.");
      }
      return new NextResponse(body, {
        status: response.status,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    } catch (caught) {
      lastFailure = caught instanceof Error ? caught.message : String(caught);
    }
  }

  return rpcErrorResponse(502, -32603, `${ARC_NETWORK_NAME} RPC is unavailable: ${lastFailure}`);
}
