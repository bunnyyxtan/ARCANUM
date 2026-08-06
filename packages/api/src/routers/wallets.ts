import { addressSchema, looseWalletIdSchema } from "@arcanum/shared";
import { z } from "zod";

import {
  readSupabaseAgents,
  readSupabasePolicies,
  readSupabasePublicWalletProfile,
  readSupabaseWallets,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { findWalletByLooseId } from "./helpers";

// Every read goes to the Supabase read model, which fails closed: an outage
// surfaces as "data unavailable" instead of a wallet list that looks empty.
export const walletsRouter = router({
  list: publicProcedure.query(({ ctx }) => readSupabaseWallets(ctx)),

  getById: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(({ ctx, input }) => {
      return findWalletByLooseId(ctx, input.walletId);
    }),

  getByAddress: publicProcedure
    .input(z.object({ address: addressSchema }))
    .query(({ ctx, input }) => {
      return findWalletByLooseId(ctx, input.address);
    }),

  publicProfile: publicProcedure
    .input(z.object({ address: addressSchema }))
    .query(({ ctx, input }) => {
      return readSupabasePublicWalletProfile(ctx, input.address);
    }),

  listAgents: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(async ({ ctx, input }) => {
      const wallet = await findWalletByLooseId(ctx, input.walletId);
      if (!wallet) {
        return [];
      }

      const rows = await readSupabaseAgents(ctx);
      return rows.filter((agent) => agent.walletId === wallet.id);
    }),

  listPolicies: publicProcedure
    .input(z.object({ walletId: looseWalletIdSchema }))
    .query(async ({ ctx, input }) => {
      const wallet = await findWalletByLooseId(ctx, input.walletId);
      return readSupabasePolicies(ctx, wallet);
    }),
});
