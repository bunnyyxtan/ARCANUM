import { z } from "zod";

import { addressSchema, looseWalletIdSchema, txHashSchema } from "./common";

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

export const agentRegisterInputSchema = z.object({
  walletAddress: addressSchema,
  signerAddress: addressSchema,
  label: z.string().min(2).max(80),
  type: agentTypeSchema.default("other"),
});

export const agentCreatedWalletInputSchema = z.object({
  walletAddress: addressSchema,
  ownerAddress: addressSchema,
  label: z.string().min(2).max(80),
  deployTxHash: txHashSchema,
  chainId: z.number().int().positive(),
  perTxCap: z.number().positive(),
  dailyCap: z.number().positive(),
  monthlyCap: z.number().positive(),
  escalationThreshold: z.number().nonnegative(),
  requireAllowlist: z.boolean(),
  signers: z.array(addressSchema).min(1),
  council: z.array(addressSchema).min(1),
  quorum: z.number().int().min(1).max(255),
});
