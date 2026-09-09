import { handleCreateReceipt } from "@arcanum/api/server";

import { receiptRequestContext } from "./_lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/receipts -- issue a signed payment decision receipt. */
export function POST(request: Request) {
  return handleCreateReceipt(request, receiptRequestContext(request));
}
