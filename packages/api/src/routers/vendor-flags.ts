import { vendorFlags } from "@arcanum/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";
import { actorFor, tenantIdFor } from "./helpers";

const vendorFlagInputSchema = z.object({
  vendorAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, "A valid vendor address is required."),
});

const vendorFlagCreateSchema = vendorFlagInputSchema.extend({
  note: z
    .string()
    .trim()
    .max(200, "Keep the review note under 200 characters.")
    .optional(),
});

// Vendor flags are persistent review state. Unlike list surfaces that tolerate
// a demo fallback, these fail closed: a database problem must surface as an
// error, never as "no flags" or a fake success.
function reviewRegisterUnavailable(label: string, error: unknown): TRPCError {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[arcanum-api] ${label} failed: ${message}`);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "The vendor review register is unavailable. Try again shortly.",
  });
}

export const vendorFlagsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    try {
      return await ctx.db.query.vendorFlags.findMany({
        where: eq(vendorFlags.tenantId, tenantId),
        orderBy: desc(vendorFlags.createdAt),
      });
    } catch (error) {
      throw reviewRegisterUnavailable("vendorFlags.list", error);
    }
  }),

  flag: protectedProcedure.input(vendorFlagCreateSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const vendorAddress = input.vendorAddress.toLowerCase();
    const note = input.note ? input.note : null;

    try {
      const [row] = await ctx.db
        .insert(vendorFlags)
        .values({ tenantId, vendorAddress, flaggedBy: actorFor(ctx), note })
        .onConflictDoUpdate({
          target: [vendorFlags.tenantId, vendorFlags.vendorAddress],
          set: { flaggedBy: actorFor(ctx), note },
        })
        .returning();

      if (!row) {
        throw reviewRegisterUnavailable(
          "vendorFlags.flag",
          new Error("Upsert returned no row."),
        );
      }

      return { flagged: true as const, flag: row };
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
        note: z
          .string()
          .trim()
          .max(200, "Keep the review note under 200 characters.")
          .nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const vendorAddress = input.vendorAddress.toLowerCase();
      const note = input.note ? input.note : null;

      try {
        // Only the note changes — flaggedBy and createdAt are preserved so the
        // audit trail of who flagged the vendor (and when) stays intact.
        const [row] = await ctx.db
          .update(vendorFlags)
          .set({ note })
          .where(
            and(eq(vendorFlags.tenantId, tenantId), eq(vendorFlags.vendorAddress, vendorAddress)),
          )
          .returning();

        if (!row) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "This vendor is no longer flagged, so there is no note to update.",
          });
        }

        return { flagged: true as const, flag: row };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw reviewRegisterUnavailable("vendorFlags.updateNote", error);
      }
    }),

  unflag: protectedProcedure.input(vendorFlagInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const vendorAddress = input.vendorAddress.toLowerCase();

    try {
      // Zero deleted rows means the vendor was already unflagged — that is a
      // legitimate idempotent success, not a failure.
      await ctx.db
        .delete(vendorFlags)
        .where(
          and(eq(vendorFlags.tenantId, tenantId), eq(vendorFlags.vendorAddress, vendorAddress)),
        );

      return { flagged: false as const };
    } catch (error) {
      throw reviewRegisterUnavailable("vendorFlags.unflag", error);
    }
  }),
});
