import { vendors } from "@arcanum/db/schema";
import {
  vendorAddInputSchema,
  vendorByIdInputSchema,
  vendorRemoveInputSchema,
  vendorUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import { z } from "zod";

import { readVendorChainState } from "../chain";
import { fallbackVendors, walletAddressForId } from "../mock-fallback";
import {
  readSupabaseVendors,
  readSupabaseWalletByLooseId,
  vendorCategoryFromIndex,
  writeSupabaseVendor,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import {
  canUseDemoFallback,
  findWalletByLooseId,
  readDbOrFallback,
  tenantIdFor,
} from "./helpers";

function withVendorDisplay<T extends typeof vendors.$inferSelect>(row: T) {
  const fallback = fallbackVendors.find(
    (vendor) => vendor.address.toLowerCase() === row.address.toLowerCase()
  );

  return {
    ...row,
    name: fallback?.name ?? row.address,
    kycStatus: (fallback?.kycStatus ??
      (row.perVendorCap !== "0" ? "arcanevm" : "public")) as
      | "public"
      | "arcanevm",
    walletAddress: walletAddressForId(row.walletId),
  };
}

function onChainVendorWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "VendorRegistry writes must be submitted on-chain by the governed wallet owner.",
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
      []
    );

    if (rows.length > 0) {
      return rows.map(withVendorDisplay);
    }

    return fallbackVendors;
  }),

  byId: publicProcedure
    .input(vendorByIdInputSchema)
    .query(async ({ ctx, input }) => {
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
            where: and(
              eq(vendors.tenantId, tenantId),
              eq(vendors.id, input.id)
            ),
          }),
        undefined
      );

      return row
        ? withVendorDisplay(row)
        : (canUseDemoFallback(ctx)
            ? fallbackVendors.find((vendor) => vendor.id === input.id)
            : null) ?? null;
    }),

  getByWallet: publicProcedure
    .input(vendorAddInputSchema.pick({ walletId: true }))
    .query(async ({ ctx, input }) => {
      if (canUseDemoFallback(ctx)) {
        const wallet = input.walletId
          ? await findWalletByLooseId(ctx, input.walletId)
          : null;
        return fallbackVendors.filter(
          (vendor) => vendor.walletId === wallet?.id
        );
      }

      const tenantId = tenantIdFor(ctx);
      const wallet = input.walletId
        ? await findWalletByLooseId(ctx, input.walletId)
        : null;
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
            where: and(
              eq(vendors.tenantId, tenantId),
              eq(vendors.walletId, wallet?.id ?? "")
            ),
            orderBy: desc(vendors.addedAt),
          }),
        []
      );

      if (rows.length > 0) {
        return rows.map(withVendorDisplay);
      }

      return fallbackVendors.filter((vendor) => vendor.walletId === wallet?.id);
    }),

  /**
   * Mirror a VendorRegistry write that already settled on-chain. The status is
   * read back from the chain so the registry can never claim an allowlist entry
   * the wallet does not actually enforce.
   */
  recordOnChainState: protectedProcedure
    .input(
      z.object({
        walletAddress: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid wallet address"),
        vendorAddress: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/, "Invalid vendor address"),
        name: z.string().min(1).max(80),
        category: z.string().min(1).max(40),
        kycStatus: z.enum(["public", "arcanevm"]).default("public"),
        perVendorCap: z.number().nonnegative().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const walletAddress = input.walletAddress.toLowerCase();
      const wallet = await readSupabaseWalletByLooseId(ctx, walletAddress);

      if (!wallet || wallet.address.toLowerCase() !== walletAddress) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet was not found.",
        });
      }
      if (
        wallet.ownerAddress.toLowerCase() !==
        ctx.session.walletAddress.toLowerCase()
      ) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Only the governed wallet owner can record vendor registry changes.",
        });
      }

      const chainState = await readVendorChainState(
        walletAddress as `0x${string}`,
        input.vendorAddress.toLowerCase() as `0x${string}`
      );

      if (!chainState) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "VendorRegistry is not reachable; vendor state could not be verified on-chain.",
        });
      }

      const status = chainState.blocked
        ? "blocked"
        : chainState.allowed
        ? "allowed"
        : "removed";

      // Only the display name is off-chain metadata; the category, cap and
      // status all come back from the registry so the read model cannot claim
      // terms the wallet does not enforce.
      const result = await writeSupabaseVendor(
        ctx,
        {
          name: input.name,
          address: input.vendorAddress.toLowerCase() as `0x${string}`,
          category: vendorCategoryFromIndex(chainState.category),
          kycStatus: chainState.perVendorCap > 0n ? "arcanevm" : "public",
          perVendorCap: Number(chainState.perVendorCap) / 1e6,
          status,
        },
        wallet
      );

      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.message,
        });
      }

      return result.data;
    }),

  add: protectedProcedure
    .input(vendorAddInputSchema)
    .mutation(async ({ ctx, input }) => {
      void ctx;
      void input;
      return onChainVendorWriteOnly();
    }),

  update: protectedProcedure
    .input(vendorUpdateInputSchema)
    .mutation(async ({ ctx, input }) => {
      void ctx;
      void input;
      return onChainVendorWriteOnly();
    }),

  remove: protectedProcedure
    .input(vendorRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      void ctx;
      void input;
      return onChainVendorWriteOnly();
    }),
});
