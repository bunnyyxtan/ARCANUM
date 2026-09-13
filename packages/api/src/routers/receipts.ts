import { keysetCursorSchema, signedPaymentIntentInputSchema } from "@arcanum/shared";
import { z } from "zod";

import { withReceiptErrors } from "../receipts/errors";
import { attachPaymentReceiptEvidence } from "../receipts/evidence";
import {
  issuePaymentReceipt,
  listPaymentReceipts,
  listReceiptIssuers,
  readPaymentReceipt,
} from "../receipts/service";
import { MAX_RECEIPTS_PER_PAGE } from "../receipts/store";
import { protectedProcedure, publicProcedure, rateLimitedPublicProcedure, router } from "../trpc";

export const receiptsRouter = router({
  // Public like the preflight: the agent's signature over the intent is the
  // credential, and only an authorized signer of a registered wallet gets a
  // receipt back.
  create: rateLimitedPublicProcedure
    .input(signedPaymentIntentInputSchema)
    .mutation(({ ctx, input }) => withReceiptErrors(() => issuePaymentReceipt(ctx, input))),

  // Public for the same reason: the transaction hash is a chain fact, and the
  // service only records evidence that provably belongs to the receipt.
  attachEvidence: rateLimitedPublicProcedure
    .input(z.object({ receiptId: z.string().uuid(), txHash: z.string() }))
    .mutation(({ ctx, input }) =>
      withReceiptErrors(() => attachPaymentReceiptEvidence(ctx, input)),
    ),

  get: protectedProcedure
    .input(z.object({ receiptId: z.string().uuid() }))
    .query(({ ctx, input }) => withReceiptErrors(() => readPaymentReceipt(ctx, input.receiptId))),

  list: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(MAX_RECEIPTS_PER_PAGE).default(25),
          cursor: keysetCursorSchema.optional(),
        })
        .default({}),
    )
    .query(({ ctx, input }) =>
      withReceiptErrors(() =>
        listPaymentReceipts(ctx, { limit: input.limit, before: input.cursor }),
      ),
    ),

  issuers: publicProcedure.query(() => listReceiptIssuers()),
});
