import { transfers } from "@arcanum/db/schema";
import {
  ledgerByCounterpartyInputSchema,
  ledgerByTimeRangeInputSchema,
  ledgerByWalletInputSchema,
  ledgerListInputSchema,
} from "@arcanum/shared";
import { and, desc, eq, gte, lte, or } from "drizzle-orm";

import { fallbackTransfers } from "../mock-fallback";
import { readSupabaseTransfers } from "../supabase";
import { publicProcedure, router } from "../trpc";
import { canUseDemoFallback, findWalletByLooseId, readDbOrFallback, tenantIdFor } from "./helpers";

const defaultPage = { page: 0, pageSize: 50 };

export const ledgerRouter = router({
  list: publicProcedure.input(ledgerListInputSchema).query(async ({ ctx, input }) => {
    const page = input?.page ?? defaultPage.page;
    const pageSize = input?.pageSize ?? defaultPage.pageSize;

    if (canUseDemoFallback(ctx)) {
      return fallbackTransfers.slice(page * pageSize, page * pageSize + pageSize);
    }

    const tenantId = tenantIdFor(ctx);
    const supabaseRows = await readSupabaseTransfers(ctx);

    if (supabaseRows.length > 0) {
      return supabaseRows.slice(page * pageSize, page * pageSize + pageSize);
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "ledger.list",
      () =>
        ctx.db.query.transfers.findMany({
          where: eq(transfers.tenantId, tenantId),
          orderBy: desc(transfers.blockNumber),
          limit: pageSize,
          offset: page * pageSize,
        }),
      [],
    );

    return rows.length > 0 ? rows : fallbackTransfers;
  }),

  byWallet: publicProcedure.input(ledgerByWalletInputSchema).query(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.wallet);
    const page = input.page ?? defaultPage.page;
    const pageSize = input.pageSize ?? defaultPage.pageSize;

    if (canUseDemoFallback(ctx)) {
      return fallbackTransfers
        .filter((transfer) => transfer.walletId === wallet?.id || transfer.toAddress === input.wallet)
        .slice(page * pageSize, page * pageSize + pageSize);
    }

    const tenantId = tenantIdFor(ctx);
    const supabaseRows = wallet
      ? (await readSupabaseTransfers(ctx)).filter((transfer) => transfer.walletId === wallet.id)
      : [];

    if (supabaseRows.length > 0) {
      return supabaseRows.slice(page * pageSize, page * pageSize + pageSize);
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "ledger.byWallet",
      () =>
        ctx.db.query.transfers.findMany({
          where: and(
            eq(transfers.tenantId, tenantId),
            or(
              eq(transfers.walletId, wallet?.id ?? input.wallet),
              eq(transfers.toAddress, input.wallet),
            ),
          ),
          orderBy: desc(transfers.blockNumber),
          limit: pageSize,
          offset: page * pageSize,
        }),
      [],
    );

    if (rows.length > 0) {
      return rows;
    }

    return canUseDemoFallback(ctx)
      ? fallbackTransfers.filter(
          (transfer) => transfer.walletId === wallet?.id || transfer.toAddress === input.wallet,
        )
      : [];
  }),

  byCounterparty: publicProcedure
    .input(ledgerByCounterpartyInputSchema)
    .query(async ({ ctx, input }) => {
      const page = input.page ?? defaultPage.page;
      const pageSize = input.pageSize ?? defaultPage.pageSize;

      if (canUseDemoFallback(ctx)) {
        return fallbackTransfers
          .filter((transfer) => transfer.toAddress === input.counterparty)
          .slice(page * pageSize, page * pageSize + pageSize);
      }

      return [];
    }),

  byTimeRange: publicProcedure.input(ledgerByTimeRangeInputSchema).query(async ({ ctx, input }) => {
    const page = input.page ?? defaultPage.page;
    const pageSize = input.pageSize ?? defaultPage.pageSize;

    if (canUseDemoFallback(ctx)) {
      return fallbackTransfers
        .filter(
          (transfer) => transfer.timestamp >= input.since && transfer.timestamp <= input.until,
        )
        .slice(page * pageSize, page * pageSize + pageSize);
    }

    return [];
  }),
});
