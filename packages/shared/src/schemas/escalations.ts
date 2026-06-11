import { z } from "zod";

import { txHashSchema } from "./common";

export const escalationStatusSchema = z.enum(["PENDING", "EXECUTED", "REJECTED", "EXPIRED"]);

export const escalationListInputSchema = z
  .object({
    status: escalationStatusSchema.optional(),
  })
  .optional();

export const escalationByTxHashInputSchema = z.object({
  txHash: txHashSchema,
});

export const escalationDecisionInputSchema = z.object({
  txHash: txHashSchema,
});
