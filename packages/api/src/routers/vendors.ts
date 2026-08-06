import {
  vendorAddInputSchema,
  vendorByIdInputSchema,
  vendorRemoveInputSchema,
  vendorUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import { z } from "zod";

import { readVendorChainState } from "../chain";
import {
  readSupabaseVendors,
  readSupabaseWalletByLooseId,
  vendorCategoryFromIndex,
  writeSupabaseVendor,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { findWalletByLooseId } from "./helpers";

function onChainVendorWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "VendorRegistry writes must be submitted on-chain by the governed wallet owner.",
  });
}

// Vendor reads go to the Supabase read model, which fails closed: an outage
// surfaces as "data unavailable" rather than an empty allowlist that looks
// like every vendor was removed.
export const vendorsRouter = router({
  list: publicProcedure.query(({ ctx }) => readSupabaseVendors(ctx)),

  byId: publicProcedure
    .input(vendorByIdInputSchema)
    .query(async ({ ctx, input }) => {
      const rows = await readSupabaseVendors(ctx);
      return rows.find((vendor) => vendor.id === input.id) ?? null;
    }),

  getByWallet: publicProcedure
    .input(vendorAddInputSchema.pick({ walletId: true }))
    .query(async ({ ctx, input }) => {
      const wallet = input.walletId
        ? await findWalletByLooseId(ctx, input.walletId)
        : null;
      return readSupabaseVendors(ctx, wallet);
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
