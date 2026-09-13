import { handleListIssuers } from "@arcanum/api/server";

export const runtime = "nodejs";

/** GET /api/receipts/issuers -- the published receipt issuer registry. */
export function GET() {
  return handleListIssuers();
}
