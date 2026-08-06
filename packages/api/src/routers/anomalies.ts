import { anomalyDecisionInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import {
  type SupabaseAnomalyDecision,
  readSupabaseAnomalies,
  recordSupabaseAnomalyDecision,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";

/**
 * Apply an operator decision to an anomaly.
 *
 * Both decisions are written to Supabase because that is the only read model
 * reachable in production; writing them through the Drizzle client made the
 * Restrain and Dismiss buttons fail with an outage error on the live site.
 */
async function decide(
  ctx: Parameters<typeof recordSupabaseAnomalyDecision>[0],
  anomalyId: string,
  decision: SupabaseAnomalyDecision,
) {
  const result = await recordSupabaseAnomalyDecision(ctx, anomalyId, decision);

  if (!result.ok) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.message });
  }

  if (!result.data) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Anomaly not found" });
  }

  return result.data;
}

export const anomaliesRouter = router({
  // Reads the Supabase read model, which fails closed on outage.
  list: publicProcedure.query(({ ctx }) => readSupabaseAnomalies(ctx)),

  acknowledge: protectedProcedure
    .input(anomalyDecisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      const anomaly = await decide(ctx, input.anomalyId, "acknowledged");
      return { anomaly, acknowledged: true };
    }),

  dismiss: protectedProcedure.input(anomalyDecisionInputSchema).mutation(async ({ ctx, input }) => {
    const anomaly = await decide(ctx, input.anomalyId, "dismissed");
    return { anomaly, dismissed: true };
  }),
});
