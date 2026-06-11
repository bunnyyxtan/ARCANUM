import { anomalies } from "@arcanum/db/schema";
import { anomalyDecisionInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

import { fallbackAnomalies } from "../mock-fallback";
import { readSupabaseAnomalies } from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { canUseDemoFallback, readDbOrFallback, tenantIdFor, writeDbOrFallback } from "./helpers";

export const anomaliesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const supabaseRows = await readSupabaseAnomalies(ctx);

    if (supabaseRows.length > 0) {
      return supabaseRows;
    }

    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "anomalies.list",
      () =>
        ctx.db.query.anomalies.findMany({
          where: eq(anomalies.tenantId, tenantId),
          orderBy: desc(anomalies.sigma),
        }),
      [],
    );

    return rows.length > 0 ? rows : fallbackAnomalies;
  }),

  acknowledge: protectedProcedure
    .input(anomalyDecisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const fallbackAnomaly = canUseDemoFallback(ctx)
        ? fallbackAnomalies.find((anomaly) => anomaly.id === input.anomalyId)
        : undefined;
      const [updated] = await writeDbOrFallback(
        "anomalies.acknowledge",
        () =>
          ctx.db
            .update(anomalies)
            .set({ severity: "info" })
            .where(and(eq(anomalies.tenantId, tenantId), eq(anomalies.id, input.anomalyId)))
            .returning(),
        fallbackAnomaly ? [{ ...fallbackAnomaly, severity: "info" as const }] : [],
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Anomaly not found" });
      }

      return { anomaly: updated, acknowledged: true };
    }),

  dismiss: protectedProcedure.input(anomalyDecisionInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const fallbackAnomaly = canUseDemoFallback(ctx)
      ? fallbackAnomalies.find((anomaly) => anomaly.id === input.anomalyId)
      : undefined;
    const [deleted] = await writeDbOrFallback(
      "anomalies.dismiss",
      () =>
        ctx.db
          .delete(anomalies)
          .where(and(eq(anomalies.tenantId, tenantId), eq(anomalies.id, input.anomalyId)))
          .returning(),
      fallbackAnomaly ? [fallbackAnomaly] : [],
    );

    if (!deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Anomaly not found" });
    }

    return { anomaly: deleted, dismissed: true };
  }),
});
