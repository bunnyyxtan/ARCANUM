import { z } from "zod";

import { keysetCursorSchema, txHashSchema } from "./common";

export const ESCALATION_STATUSES = [
  "PENDING",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
  "DENIED",
  "CANCELLED",
  "INVALIDATED",
] as const;

export const ESCALATION_REASONS = [
  "NONE",
  "ALLOWLIST_REQUIRED",
  "PER_TX_CAP",
  "DAILY_CAP",
  "ESCALATION_THRESHOLD",
  "BLOCKED_VENDOR",
  "CATEGORY_DISABLED",
  "MONTHLY_CAP",
  "PER_VENDOR_CAP",
] as const;

export const FREEZE_SOURCES = ["POLICY", "ORACLE", "OWNER"] as const;

export const escalationStatusSchema = z.enum(ESCALATION_STATUSES);
export const escalationReasonSchema = z.enum(ESCALATION_REASONS);

export function escalationStatusFromIndex(index: number) {
  return ESCALATION_STATUSES[index];
}

export function escalationReasonFromIndex(index: number) {
  return ESCALATION_REASONS[index];
}

export function freezeSourceFromIndex(index: number) {
  return FREEZE_SOURCES[index];
}

export const escalationListInputSchema = z
  .object({
    status: escalationStatusSchema.optional(),
    cursor: keysetCursorSchema.optional(),
    limit: z.number().int().min(1).max(200).default(50),
  })
  .optional();

export const escalationByTxHashInputSchema = z.object({
  txHash: txHashSchema,
});

export const escalationKeyInputSchema = z.object({
  escalationKey: txHashSchema,
});

export const escalationDecisionInputSchema = z.object({
  txHash: txHashSchema,
});
