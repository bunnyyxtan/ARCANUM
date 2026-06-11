import { z } from "zod";

import { addressSchema, looseWalletIdSchema, pageInputSchema } from "./common";

export const ledgerListInputSchema = pageInputSchema.partial().optional();

export const ledgerByWalletInputSchema = pageInputSchema.partial().extend({
  wallet: looseWalletIdSchema,
});

export const ledgerByCounterpartyInputSchema = pageInputSchema.partial().extend({
  counterparty: addressSchema,
});

export const ledgerByTimeRangeInputSchema = pageInputSchema.partial().extend({
  since: z.coerce.date(),
  until: z.coerce.date(),
});
