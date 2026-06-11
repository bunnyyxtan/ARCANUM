import { isAddress } from "viem";
import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const addressSchema = z
  .string()
  .refine((value): value is `0x${string}` => isAddress(value), "Invalid address")
  .transform((value) => value.toLowerCase() as `0x${string}`);

export const looseWalletIdSchema = z.string().min(1);

export const txHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash")
  .transform((value) => value.toLowerCase() as `0x${string}`);

export const pageInputSchema = z.object({
  page: z.number().int().min(0).default(0),
  pageSize: z.number().int().min(1).max(100).default(50),
});

export const categorySchema = z.enum(["api", "compute", "data", "subcontracting", "other"]);
