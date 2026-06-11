import { z } from "zod";

import { looseWalletIdSchema } from "./common";

export const policyUpdateInputSchema = z.object({
  walletId: looseWalletIdSchema,
  maxSpendPerTx: z.number().positive("Enter a positive per-transaction cap"),
  maxSpendPerDay: z.number().positive("Enter a positive daily cap"),
  maxSpendPerMonth: z.number().positive("Enter a positive monthly cap"),
  allowedVendors: z.array(z.string().min(1)).min(1, "Select at least one vendor"),
  timeWindowStart: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  timeWindowEnd: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  requiresQuorumAbove: z.number().nonnegative("Enter zero or a positive amount"),
});

export type PolicyUpdateInput = z.infer<typeof policyUpdateInputSchema>;
