import {
  ledgerByCounterpartyInputSchema,
  ledgerByTimeRangeInputSchema,
  ledgerByWalletInputSchema,
  ledgerListInputSchema,
} from "@arcanum/shared";

import {
  readSupabasePublicLedger,
  readSupabaseTransferCount,
  readSupabaseTransfers,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { findWalletByLooseId } from "./helpers";

const defaultPage = { page: 0, pageSize: 50 };

export type LedgerPage = {
  /** Rows on this page, newest first. */
  rows: Awaited<ReturnType<typeof readSupabaseTransfers>>;
  /** Number of rows in the requested scope after any route filter. */
  totalCount: number | null;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrevious: boolean;
  /**
   * The page is an intentional visible subset. Callers must not describe it
   * as a complete export unless they fetch every page.
   */
  subset: "page";
  scope: "tenant-wallets" | "public-wallet";
};

function pageRows<T>(
  rows: T[],
  page: number,
  pageSize: number,
  scope: LedgerPage["scope"],
  totalCount: number | null = rows.length,
): Omit<LedgerPage, "rows"> & { rows: T[] } {
  const start = page * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    totalCount,
    page,
    pageSize,
    hasNext: totalCount === null ? start + pageSize < rows.length : start + pageSize < totalCount,
    hasPrevious: page > 0,
    subset: "page",
    scope,
  };
}

function visibleReadLimit(page: number, pageSize: number) {
  // Fetch enough rows to answer hasNext for a page-number client. The
  // underlying reader traverses scoped keyset pages, so this is a caller-
  // requested cumulative bound rather than a global read-model cap.
  return (page + 1) * pageSize + 1;
}

function totalCountForRead(rows: unknown[], readLimit: number) {
  // A custom read adapter may return more than the requested limit (for
  // example, an in-memory test store). In that case its length is an exact
  // count. Production adapters return exactly the limit when the result is
  // truncated, so expose null rather than inventing a total.
  return rows.length === readLimit ? null : rows.length;
}

// Every procedure here reads the Supabase read model, which fails closed: a
// storage outage surfaces as an explicit "data unavailable" error instead of a
// believable empty ledger.
export const ledgerRouter = router({
  list: publicProcedure.input(ledgerListInputSchema).query(async ({ ctx, input }) => {
    const page = input?.page ?? defaultPage.page;
    const pageSize = input?.pageSize ?? defaultPage.pageSize;
    const limit = visibleReadLimit(page, pageSize);
    const [rows, totalCount] = await Promise.all([
      readSupabaseTransfers(ctx, { cursor: input?.cursor, limit }),
      readSupabaseTransferCount(ctx, { cursor: input?.cursor }),
    ]);

    return pageRows(
      rows,
      page,
      pageSize,
      "tenant-wallets",
      totalCount ?? totalCountForRead(rows, limit),
    );
  }),

  byWallet: publicProcedure.input(ledgerByWalletInputSchema).query(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.wallet);
    const page = input.page ?? defaultPage.page;
    const pageSize = input.pageSize ?? defaultPage.pageSize;
    const limit = visibleReadLimit(page, pageSize);

    const [scopedRows, totalCount] = wallet
      ? await Promise.all([
          readSupabaseTransfers(ctx, { cursor: input.cursor, limit, walletId: wallet.id }),
          readSupabaseTransferCount(ctx, { cursor: input.cursor, walletId: wallet.id }),
        ])
      : [[], 0];

    if (wallet) {
      return pageRows(
        scopedRows,
        page,
        pageSize,
        "tenant-wallets",
        totalCount ?? totalCountForRead(scopedRows, limit),
      );
    }

    // The public explorer and badge pages have no session, so fall back to the
    // unscoped public ledger for the requested wallet address.
    if (input.wallet.startsWith("0x")) {
      const publicRows = await readSupabasePublicLedger(ctx, input.wallet, limit);
      return pageRows(
        publicRows,
        page,
        pageSize,
        "public-wallet",
        totalCountForRead(publicRows, limit),
      );
    }

    return pageRows([], page, pageSize, "tenant-wallets");
  }),

  byCounterparty: publicProcedure
    .input(ledgerByCounterpartyInputSchema)
    .query(async ({ ctx, input }) => {
      const page = input.page ?? defaultPage.page;
      const pageSize = input.pageSize ?? defaultPage.pageSize;
      const limit = visibleReadLimit(page, pageSize);
      const counterparty = input.counterparty.toLowerCase();
      const [allRows, totalCount] = await Promise.all([
        readSupabaseTransfers(ctx, {
          cursor: input.cursor,
          limit,
          counterparty,
        }),
        readSupabaseTransferCount(ctx, { cursor: input.cursor, counterparty }),
      ]);
      const rows = allRows.filter((transfer) => transfer.toAddress.toLowerCase() === counterparty);

      return pageRows(
        rows,
        page,
        pageSize,
        "tenant-wallets",
        totalCount ?? totalCountForRead(rows, limit),
      );
    }),

  byTimeRange: publicProcedure.input(ledgerByTimeRangeInputSchema).query(async ({ ctx, input }) => {
    const page = input.page ?? defaultPage.page;
    const pageSize = input.pageSize ?? defaultPage.pageSize;
    const limit = visibleReadLimit(page, pageSize);
    const [allRows, totalCount] = await Promise.all([
      readSupabaseTransfers(ctx, {
        cursor: input.cursor,
        limit,
        since: input.since,
        until: input.until,
      }),
      readSupabaseTransferCount(ctx, {
        cursor: input.cursor,
        since: input.since,
        until: input.until,
      }),
    ]);
    const rows = allRows.filter(
      (transfer) => transfer.timestamp >= input.since && transfer.timestamp <= input.until,
    );

    return pageRows(
      rows,
      page,
      pageSize,
      "tenant-wallets",
      totalCount ?? totalCountForRead(rows, limit),
    );
  }),
});
