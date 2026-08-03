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

  flag: protectedProcedure.input(vendorFlagInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const vendorAddress = input.vendorAddress.toLowerCase();

    try {
      const [row] = await ctx.db
        .insert(vendorFlags)
        .values({ tenantId, vendorAddress, flaggedBy: actorFor(ctx) })
        .onConflictDoUpdate({
          target: [vendorFlags.tenantId, vendorFlags.vendorAddress],
          set: { flaggedBy: actorFor(ctx) },
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
