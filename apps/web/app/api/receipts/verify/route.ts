import { handleVerifyReceipt } from "@arcanum/api/server";

import { receiptRequestContext } from "../_lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/receipts/verify -- stateless verification of a receipt envelope. */
export function POST(request: Request) {
  return handleVerifyReceipt(request, receiptRequestContext(request));
}
