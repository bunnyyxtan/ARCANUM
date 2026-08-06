import {
  ledgerByCounterpartyInputSchema,
  ledgerByTimeRangeInputSchema,
  ledgerByWalletInputSchema,
  ledgerListInputSchema,
} from "@arcanum/shared";

import { readSupabasePublicLedger, readSupabaseTransfers } from "../supabase";
import { publicProcedure, router } from "../trpc";
import { findWalletByLooseId } from "./helpers";

const defaultPage = { page: 0, pageSize: 50 };

// Every procedure here reads the Supabase read model, which fails closed: a
// storage outage surfaces as an explicit "data unavailable" error instead of a
// believable empty ledger.
export const ledgerRouter = router({
  list: publicProcedure
    .input(ledgerListInputSchema)
    .query(async ({ ctx, input }) => {
      const page = input?.page ?? defaultPage.page;
      const pageSize = input?.pageSize ?? defaultPage.pageSize;
      const rows = await readSupabaseTransfers(ctx);

      return rows.slice(page * pageSize, page * pageSize + pageSize);
    }),

  byWallet: publicProcedure
    .input(ledgerByWalletInputSchema)
    .query(async ({ ctx, input }) => {
      const wallet = await findWalletByLooseId(ctx, input.wallet);
      const page = input.page ?? defaultPage.page;
      const pageSize = input.pageSize ?? defaultPage.pageSize;

      const scopedRows = wallet
        ? (await readSupabaseTransfers(ctx)).filter(
            (transfer) => transfer.walletId === wallet.id
          )
        : [];

      if (scopedRows.length > 0) {
        return scopedRows.slice(page * pageSize, page * pageSize + pageSize);
      }

      // The public explorer and badge pages have no session, so fall back to the
      // unscoped public ledger for the requested wallet address.
      if (input.wallet.startsWith("0x")) {
        const publicRows = await readSupabasePublicLedger(ctx, input.wallet);
        return publicRows.slice(page * pageSize, page * pageSize + pageSize);
      }

      return [];
    }),

  byCounterparty: publicProcedure
    .input(ledgerByCounterpartyInputSchema)
    .query(async ({ ctx, input }) => {
      const page = input.page ?? defaultPage.page;
      const pageSize = input.pageSize ?? defaultPage.pageSize;
      const counterparty = input.counterparty.toLowerCase();
      const rows = (await readSupabaseTransfers(ctx)).filter(
        (transfer) => transfer.toAddress.toLowerCase() === counterparty
      );

      return rows.slice(page * pageSize, page * pageSize + pageSize);
    }),

  byTimeRange: publicProcedure
    .input(ledgerByTimeRangeInputSchema)
    .query(async ({ ctx, input }) => {
      const page = input.page ?? defaultPage.page;
      const pageSize = input.pageSize ?? defaultPage.pageSize;
      const rows = (await readSupabaseTransfers(ctx)).filter(
        (transfer) =>
          transfer.timestamp >= input.since && transfer.timestamp <= input.until
      );

      return rows.slice(page * pageSize, page * pageSize + pageSize);
    }),
});
