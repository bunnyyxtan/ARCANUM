import { anomalies } from "@arcanum/db/schema";
import { anomalyDecisionInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { readSupabaseAnomalies } from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { failClosed, tenantIdFor } from "./helpers";

export const anomaliesRouter = router({
  // Reads the Supabase read model, which fails closed on outage.
  list: publicProcedure.query(({ ctx }) => readSupabaseAnomalies(ctx)),

  acknowledge: protectedProcedure
    .input(anomalyDecisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const [updated] = await failClosed("anomalies.acknowledge", () =>
        ctx.db
          .update(anomalies)
          .set({ severity: "info" })
          .where(and(eq(anomalies.tenantId, tenantId), eq(anomalies.id, input.anomalyId)))
          .returning(),
      );

      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Anomaly not found" });
      }

      return { anomaly: updated, acknowledged: true };
    }),

  dismiss: protectedProcedure.input(anomalyDecisionInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const [deleted] = await failClosed("anomalies.dismiss", () =>
      ctx.db
        .delete(anomalies)
        .where(and(eq(anomalies.tenantId, tenantId), eq(anomalies.id, input.anomalyId)))
        .returning(),
    );

    if (!deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Anomaly not found" });
    }

    return { anomaly: deleted, dismissed: true };
  }),
});
