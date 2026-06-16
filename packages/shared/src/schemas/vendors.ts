import { z } from "zod";

import { addressSchema, categorySchema, looseWalletIdSchema, uuidSchema } from "./common";

export const vendorStatusSchema = z.enum(["allowed", "blocked", "removed"]);

export const vendorAddInputSchema = z.object({
  walletId: looseWalletIdSchema.optional(),
  name: z.string().min(2).max(80),
  address: addressSchema,
  category: categorySchema,
  kycStatus: z.enum(["public", "arcanevm"]).default("public"),
  perVendorCap: z.number().nonnegative().default(0),
});

export const vendorUpdateInputSchema = vendorAddInputSchema.partial().extend({
  id: uuidSchema,
  status: vendorStatusSchema.optional(),
});

export const vendorRemoveInputSchema = z.object({
  id: uuidSchema,
});

export const vendorByIdInputSchema = z.object({
  id: uuidSchema,
});
