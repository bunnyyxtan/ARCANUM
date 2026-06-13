import { vendors } from "@arcanum/db/schema";
import {
  vendorAddInputSchema,
  vendorByIdInputSchema,
  vendorRemoveInputSchema,
  vendorUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import { fallbackVendors, walletAddressForId } from "../mock-fallback";
import { readSupabaseVendors } from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { canUseDemoFallback, findWalletByLooseId, readDbOrFallback, tenantIdFor } from "./helpers";

function withVendorDisplay<T extends typeof vendors.$inferSelect>(row: T) {
  const fallback = fallbackVendors.find(
    (vendor) => vendor.address.toLowerCase() === row.address.toLowerCase(),
  );

  return {
    ...row,
    name: fallback?.name ?? row.address,
    kycStatus: (fallback?.kycStatus ?? (row.perVendorCap !== "0" ? "arcanevm" : "public")) as
      | "public"
      | "arcanevm",
    walletAddress: walletAddressForId(row.walletId),
  };
}

function onChainVendorWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "VendorRegistry writes must be submitted on-chain by the governed wallet owner.",
  });
}

export const vendorsRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackVendors;
    }

    const tenantId = tenantIdFor(ctx);
    const supabaseRows = await readSupabaseVendors(ctx);

    if (supabaseRows.length > 0) {
      return supabaseRows;
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "vendors.list",
      () =>
        ctx.db.query.vendors.findMany({
          where: eq(vendors.tenantId, tenantId),
          orderBy: desc(vendors.addedAt),
        }),
      [],
    );

    if (rows.length > 0) {
      return rows.map(withVendorDisplay);
    }

    return fallbackVendors;
  }),

  byId: publicProcedure.input(vendorByIdInputSchema).query(async ({ ctx, input }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackVendors.find((vendor) => vendor.id === input.id) ?? null;
    }

    const tenantId = tenantIdFor(ctx);
    if (!canUseDemoFallback(ctx)) {
      return null;
    }

    const row = await readDbOrFallback(
      "vendors.byId",
      () =>
        ctx.db.query.vendors.findFirst({
          where: and(eq(vendors.tenantId, tenantId), eq(vendors.id, input.id)),
        }),
      undefined,
    );

    return row
      ? withVendorDisplay(row)
      : ((canUseDemoFallback(ctx)
          ? fallbackVendors.find((vendor) => vendor.id === input.id)
          : null) ?? null);
  }),

  getByWallet: publicProcedure
    .input(vendorAddInputSchema.pick({ walletId: true }))
    .query(async ({ ctx, input }) => {
      if (canUseDemoFallback(ctx)) {
        const wallet = input.walletId ? await findWalletByLooseId(ctx, input.walletId) : null;
        return fallbackVendors.filter((vendor) => vendor.walletId === wallet?.id);
      }

      const tenantId = tenantIdFor(ctx);
      const wallet = input.walletId ? await findWalletByLooseId(ctx, input.walletId) : null;
      const supabaseRows = await readSupabaseVendors(ctx, wallet);

      if (supabaseRows.length > 0) {
        return supabaseRows;
      }

      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "vendors.getByWallet",
        () =>
          ctx.db.query.vendors.findMany({
            where: and(eq(vendors.tenantId, tenantId), eq(vendors.walletId, wallet?.id ?? "")),
            orderBy: desc(vendors.addedAt),
          }),
        [],
      );

      if (rows.length > 0) {
        return rows.map(withVendorDisplay);
      }

      return fallbackVendors.filter((vendor) => vendor.walletId === wallet?.id);
    }),

  add: protectedProcedure.input(vendorAddInputSchema).mutation(async ({ ctx, input }) => {
    void ctx;
    void input;
    return onChainVendorWriteOnly();
  }),

  update: protectedProcedure.input(vendorUpdateInputSchema).mutation(async ({ ctx, input }) => {
    void ctx;
    void input;
    return onChainVendorWriteOnly();
  }),

  remove: protectedProcedure.input(vendorRemoveInputSchema).mutation(async ({ ctx, input }) => {
    void ctx;
    void input;
    return onChainVendorWriteOnly();
  }),
});
