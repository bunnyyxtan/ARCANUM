import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  flagVendor,
  listVendorFlagHistory,
  listVendorFlags,
  unflagVendor,
  updateVendorFlagNote,
} from "../supabase-vendor-flags";
import { protectedProcedure, router } from "../trpc";
import { actorFor, tenantIdFor } from "./helpers";

const vendorFlagInputSchema = z.object({
  vendorAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "A valid vendor address is required."),
});

const vendorFlagCreateSchema = vendorFlagInputSchema.extend({
  note: z.string().trim().max(200, "Keep the review note under 200 characters.").optional(),
});

// Vendor flags are persistent review state. Unlike list surfaces that tolerate
// a demo fallback, these fail closed: a storage problem must surface as an
// error, never as "no flags" or a fake success.
function reviewRegisterUnavailable(label: string, error: unknown): TRPCError {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[arcanum-api] ${label} failed: ${message}`);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "The vendor review register is unavailable. Try again shortly.",
  });
}

// A caller whose organisation owns no governed wallet has no register to write
// to. That is a missing subject, not a broken service, so it must not be
// reported as an outage.
const NO_REGISTER = new TRPCError({
  code: "NOT_FOUND",
  message: "No governed wallet is linked to this account yet.",
});

export const vendorFlagsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listVendorFlags(ctx);
    } catch (error) {
      throw reviewRegisterUnavailable("vendorFlags.list", error);
    }
  }),

  // Full append-only review trail for one vendor: every flag, note edit and
  // unflag ever recorded, newest first - survives re-flagging cycles.
  history: protectedProcedure.input(vendorFlagInputSchema).query(async ({ ctx, input }) => {
    try {
      return await listVendorFlagHistory(ctx, input.vendorAddress.toLowerCase());
    } catch (error) {
      throw reviewRegisterUnavailable("vendorFlags.history", error);
    }
  }),

  flag: protectedProcedure.input(vendorFlagCreateSchema).mutation(async ({ ctx, input }) => {
    try {
      const flag = await flagVendor(ctx, {
        tenantId: tenantIdFor(ctx),
        vendorAddress: input.vendorAddress.toLowerCase(),
        actor: actorFor(ctx),
        note: input.note ?? null,
      });

      if (!flag) {
        throw NO_REGISTER;
      }

      return { flagged: true as const, flag };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw reviewRegisterUnavailable("vendorFlags.flag", error);
    }
  }),

  updateNote: protectedProcedure
    .input(
      vendorFlagInputSchema.extend({
        note: z.string().trim().max(200, "Keep the review note under 200 characters.").nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const flag = await updateVendorFlagNote(ctx, {
          tenantId: tenantIdFor(ctx),
          vendorAddress: input.vendorAddress.toLowerCase(),
          actor: actorFor(ctx),
          note: input.note,
        });

        if (!flag) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This vendor is no longer flagged, so there is no note to update.",
          });
        }

        return { flagged: true as const, flag };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw reviewRegisterUnavailable("vendorFlags.updateNote", error);
      }
    }),

  unflag: protectedProcedure.input(vendorFlagInputSchema).mutation(async ({ ctx, input }) => {
    try {
      // Clearing a flag that is already clear is a legitimate idempotent
      // success, so the result is the same either way.
      await unflagVendor(ctx, {
        tenantId: tenantIdFor(ctx),
        vendorAddress: input.vendorAddress.toLowerCase(),
        actor: actorFor(ctx),
      });

      return { flagged: false as const };
    } catch (error) {
      throw reviewRegisterUnavailable("vendorFlags.unflag", error);
    }
  }),
});
