import {
  PAYMENT_RECEIPT_ISSUERS,
  paymentReceiptEnvelopeSchema,
  signedPaymentIntentInputSchema,
  verifyPaymentReceipt,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { type ZodTypeAny, z } from "zod";

import type { ApiContext } from "../context";
import { enforceRateLimit } from "../rate-limit";
import { isReceiptError } from "./errors";
import { type EvidenceDeps, attachPaymentReceiptEvidence, defaultEvidenceDeps } from "./evidence";
import { type ReceiptServiceDeps, defaultReceiptServiceDeps, issuePaymentReceipt } from "./service";

/**
 * Framework-agnostic REST handlers for agents that speak plain HTTP instead of
 * tRPC. Every response is JSON; failures use `{ error: { code, message } }`
 * with the same domain codes the tRPC router reports in `data.domainCode`.
 */

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" } as const;

export async function handleCreateReceipt(
  request: Request,
  ctx: ApiContext,
  deps: ReceiptServiceDeps = defaultReceiptServiceDeps,
): Promise<Response> {
  return guarded(ctx, "mutation", "receipts.create", async () => {
    const intent = await parseJsonBody(request, signedPaymentIntentInputSchema);
    if (intent instanceof Response) {
      return intent;
    }
    const issued = await issuePaymentReceipt(ctx, intent, deps);
    return json(issued, issued.replayed ? 200 : 201);
  });
}

const evidenceBodySchema = z.object({ txHash: z.string() });

export async function handleAttachEvidence(
  request: Request,
  ctx: ApiContext,
  receiptId: string,
  deps: EvidenceDeps = defaultEvidenceDeps,
): Promise<Response> {
  return guarded(ctx, "mutation", "receipts.attachEvidence", async () => {
    if (!z.string().uuid().safeParse(receiptId).success) {
      return json(
        { error: { code: "INVALID_REQUEST", message: "Receipt id must be a UUID." } },
        400,
      );
    }
    const body = await parseJsonBody(request, evidenceBodySchema);
    if (body instanceof Response) {
      return body;
    }
    return json(await attachPaymentReceiptEvidence(ctx, { receiptId, ...body }, deps), 200);
  });
}

export async function handleVerifyReceipt(request: Request, ctx: ApiContext): Promise<Response> {
  return guarded(ctx, "query", "receipts.verify", async () => {
    const envelope = await parseJsonBody(request, paymentReceiptEnvelopeSchema);
    if (envelope instanceof Response) {
      return envelope;
    }
    return json(await verifyPaymentReceipt(envelope), 200);
  });
}

export function handleListIssuers(): Response {
  return json({ issuers: PAYMENT_RECEIPT_ISSUERS }, 200, {
    "cache-control": "public, max-age=300",
  });
}

async function guarded(
  ctx: ApiContext,
  type: "query" | "mutation",
  path: string,
  run: () => Promise<Response>,
): Promise<Response> {
  try {
    await enforceRateLimit(ctx, type, path);
    return await run();
  } catch (error) {
    if (isReceiptError(error)) {
      return json(error.toJSON(), error.httpStatus);
    }
    if (error instanceof TRPCError && error.code === "TOO_MANY_REQUESTS") {
      return json({ error: { code: "RATE_LIMITED", message: error.message } }, 429);
    }
    console.error(`[arcanum-receipts] ${path} failed`, error);
    return json(
      {
        error: { code: "INTERNAL_ERROR", message: "The receipt service hit an unexpected error." },
      },
      500,
    );
  }
}

async function parseJsonBody<TSchema extends ZodTypeAny>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return json(
      { error: { code: "INVALID_REQUEST", message: "Request body must be valid JSON." } },
      400,
    );
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Request body failed validation.",
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
      400,
    );
  }
  return parsed.data;
}

function json(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, "cache-control": "no-store", ...headers },
  });
}
