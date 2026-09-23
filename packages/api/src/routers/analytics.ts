import { readSupabaseAgentCounts, readSupabaseEscalations } from "../supabase";
import { readAnomalyCounts, readLedgerSummary } from "../supabase/analytics";
import { publicProcedure, router } from "../trpc";
import { TtlCache } from "../ttl-cache";
import { tenantIdFor } from "./helpers";

const postureCache = new TtlCache<number>(512, 30_000);

export type AnalyticsWindow = {
  windowStart: string;
  windowEnd: string;
  /** The aggregate is complete for this caller's tenant-scoped wallet set. */
  complete: true;
};

// All analytics are derived from the Supabase read model, which fails closed:
// an outage surfaces as an error the dashboard renders as "read model
// unavailable" instead of a believable row of zeros.
export const analyticsRouter = router({
  postureIndex: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const actor = ctx.session?.walletAddress.toLowerCase() ?? "anonymous";
    const cacheKey = `${tenantId}:${actor}:posture`;
    const cached = postureCache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const [supabaseAgents, supabaseTransfers, supabaseAnomalies] = await Promise.all([
      readSupabaseAgentCounts(ctx),
      readLedgerSummary(ctx, true),
      readAnomalyCounts(ctx),
    ]);

    const frozen = supabaseAgents.frozen;
    const denied = supabaseTransfers.denied;
    const danger = supabaseAnomalies.danger;
    const hasSignal = frozen > 0 || supabaseTransfers.total > 0 || supabaseAnomalies.total > 0;
    const value = hasSignal
      ? Math.max(0, Math.min(100, 100 - frozen * 10 - denied * 3 - danger * 8))
      : 0;

    postureCache.set(cacheKey, value);
    return value;
  }),

  valueGoverned24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until, valueBaseUnits, movementCount } = await readLedgerSummary(ctx);
    // ALLOW is the only outcome that represents an executed movement. An
    // ESCALATE row is held for review and must not inflate governed value.
    return {
      valueBaseUnits: valueBaseUnits.toString(),
      movementCount,
      outcome: "ALLOW" as const,
      ...windowMetadata(since, until),
    };
  }),

  walletActivity24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until, activity } = await readLedgerSummary(ctx, true);

    return {
      rows: [...activity.entries()].map(([walletId, value]) => ({
        walletId,
        spendBaseUnits: value.spendBaseUnits.toString(),
        lastActivityAt: value.lastActivityAt?.toISOString() ?? null,
      })),
      ...windowMetadata(since, until),
    };
  }),

  activeAgents: publicProcedure.query(async ({ ctx }) => {
    return (await readSupabaseAgentCounts(ctx)).active;
  }),

  threatsBlocked24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until, blocked24h } = await readLedgerSummary(ctx);
    return {
      count: blocked24h,
      outcomes: ["DENY", "FREEZE"] as const,
      ...windowMetadata(since, until),
    };
  }),

  pendingEscalations: publicProcedure.query(async ({ ctx }) => {
    const supabaseEscalations = await readSupabaseEscalations(ctx);
    return supabaseEscalations.filter((item) => item.status === "PENDING").length;
  }),
});

function windowMetadata(since: Date, until: Date): AnalyticsWindow {
  return {
    windowStart: since.toISOString(),
    windowEnd: until.toISOString(),
    complete: true,
  };
}
