import { getCctpQuote } from "@/lib/cctp";
import { guardRequest, jsonResponse, upstreamError } from "../_lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const rejected = guardRequest(request);
  if (rejected) return rejected;

  const amount = new URL(request.url).searchParams.get("amount");
  if (!amount || amount.length > 40 || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(amount)) {
    return jsonResponse({ error: "Enter a USDC amount with at most 6 decimal places." }, 400);
  }
  if (!/[1-9]/.test(amount)) {
    return jsonResponse({ error: "The amount must be greater than zero." }, 400);
  }
  try {
    return jsonResponse({ quote: await getCctpQuote(amount) });
  } catch (error) {
    return upstreamError(error);
  }
}
