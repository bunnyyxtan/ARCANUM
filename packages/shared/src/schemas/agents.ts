import { z } from "zod";

import {
  addressSchema,
  decimalUsdcSchema,
  decimalUsdcToBaseUnits,
  looseWalletIdSchema,
  txHashSchema,
} from "./common";

export const agentStatusSchema = z.enum(["active", "paused", "frozen"]);
export const agentTypeSchema = z.enum([
  "research",
  "marketing",
  "dev",
  "treasury",
  "support",
  "other",
]);

export const agentByWalletInputSchema = z.object({
  walletId: looseWalletIdSchema,
});

export const agentFreezeInputSchema = z.object({
  walletId: looseWalletIdSchema,
});

export const agentSignerSyncInputSchema = z.object({
  action: z.enum(["authorize", "revoke"]),
  signerAddress: addressSchema,
  walletAddress: addressSchema,
});

export const agentCreatedWalletInputSchema = z
  .object({
    walletAddress: addressSchema,
    ownerAddress: addressSchema,
    label: z.string().min(2).max(80),
    deployTxHash: txHashSchema,
    chainId: z.number().int().positive(),
    perTxCap: decimalUsdcSchema,
    dailyCap: decimalUsdcSchema,
    monthlyCap: decimalUsdcSchema,
    escalationThreshold: decimalUsdcSchema,
    requireAllowlist: z.boolean(),
    freezeOnBlockedVendor: z.boolean(),
    signers: z.array(addressSchema).min(1),
    council: z.array(addressSchema).min(1),
    quorum: z.number().int().min(1).max(255),
  })
  .superRefine((policy, ctx) => {
    const perTxCap = decimalUsdcToBaseUnits(policy.perTxCap);
    const dailyCap = decimalUsdcToBaseUnits(policy.dailyCap);
    const monthlyCap = decimalUsdcToBaseUnits(policy.monthlyCap);
    const escalationThreshold = decimalUsdcToBaseUnits(policy.escalationThreshold);

    if (perTxCap === 0n || dailyCap === 0n || perTxCap > dailyCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["perTxCap"],
        message: "Per-transaction cap must be positive and no greater than the daily cap",
      });
    }
    if (escalationThreshold === 0n || escalationThreshold > perTxCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["escalationThreshold"],
        message:
          "Escalation threshold must be positive and no greater than the per-transaction cap",
      });
    }
    if (monthlyCap !== 0n && monthlyCap < dailyCap) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["monthlyCap"],
        message: "Monthly cap must be zero or at least the daily cap",
      });
    }
  });
