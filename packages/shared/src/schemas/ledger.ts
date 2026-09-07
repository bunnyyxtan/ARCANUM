import { z } from "zod";

import { addressSchema, keysetCursorSchema, looseWalletIdSchema, pageInputSchema } from "./common";

export const ledgerListInputSchema = pageInputSchema
  .partial()
  .extend({ cursor: keysetCursorSchema.optional() })
  .optional();

export const ledgerByWalletInputSchema = pageInputSchema.partial().extend({
  wallet: looseWalletIdSchema,
  cursor: keysetCursorSchema.optional(),
});

export const ledgerByCounterpartyInputSchema = pageInputSchema.partial().extend({
  counterparty: addressSchema,
  cursor: keysetCursorSchema.optional(),
});

export const ledgerByTimeRangeInputSchema = pageInputSchema.partial().extend({
  since: z.coerce.date(),
  until: z.coerce.date(),
  cursor: keysetCursorSchema.optional(),
});
