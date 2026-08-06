import {
  readSupabaseAgents,
  readSupabaseAnomalies,
  readSupabaseEscalations,
  readSupabaseTransfers,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { tenantIdFor } from "./helpers";

const postureCache = new Map<string, { value: number; expiresAt: number }>();

// All analytics are derived from the Supabase read model, which fails closed:
// an outage surfaces as an error the dashboard renders as "read model
// unavailable" instead of a believable row of zeros.
export const analyticsRouter = router({
  postureIndex: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const actor = ctx.session?.walletAddress.toLowerCase() ?? "anonymous";
    const cacheKey = `${tenantId}:${actor}:posture`;
    const cached = postureCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const [supabaseAgents, supabaseTransfers, supabaseAnomalies] = await Promise.all([
      readSupabaseAgents(ctx),
      readSupabaseTransfers(ctx),
      readSupabaseAnomalies(ctx),
    ]);

    const frozen = supabaseAgents.filter((agent) => agent.status === "frozen").length;
    const denied = supabaseTransfers.filter((transfer) => transfer.verdict === "DENY").length;
    const danger = supabaseAnomalies.filter((anomaly) => anomaly.severity === "danger").length;
    const hasSignal =
      frozen > 0 || supabaseTransfers.length > 0 || supabaseAnomalies.length > 0;
    const value = hasSignal
      ? Math.max(0, Math.min(100, 100 - frozen * 10 - denied * 3 - danger * 8))
      : 0;

    postureCache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }),

  valueGoverned24h: publicProcedure.query(async ({ ctx }) => {
    const supabaseTransfers = await readSupabaseTransfers(ctx);
    return String(
      supabaseTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0),
    );
  }),

  activeAgents: publicProcedure.query(async ({ ctx }) => {
    const supabaseAgents = await readSupabaseAgents(ctx);
    return supabaseAgents.filter((agent) => agent.status === "active").length;
  }),

  threatsBlocked24h: publicProcedure.query(async ({ ctx }) => {
    const supabaseTransfers = await readSupabaseTransfers(ctx);
    return supabaseTransfers.filter(
      (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE",
    ).length;
  }),

  pendingEscalations: publicProcedure.query(async ({ ctx }) => {
    const supabaseEscalations = await readSupabaseEscalations(ctx);
    return supabaseEscalations.filter((item) => item.status === "PENDING").length;
  }),
});
