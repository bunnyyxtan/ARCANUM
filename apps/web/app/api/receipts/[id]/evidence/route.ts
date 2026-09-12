import { handleAttachEvidence } from "@arcanum/api/server";

import { receiptRequestContext } from "../../_lib/context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/receipts/{id}/evidence -- link the transaction that acted on a receipt. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return handleAttachEvidence(request, receiptRequestContext(request), id);
}
