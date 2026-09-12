import {
  readSupabaseAgents,
  readSupabaseAnomalies,
  readSupabaseEscalations,
  readSupabaseTransfers,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { tenantIdFor } from "./helpers";

const postureCache = new Map<string, { value: number; expiresAt: number }>();
const DAY_MS = 24 * 60 * 60 * 1000;

export type AnalyticsWindow = {
  windowStart: string;
  windowEnd: string;
  /** The aggregate is complete for this caller's tenant-scoped wallet set. */
  complete: true;
};

function currentWindow() {
  const end = new Date();
  return {
    since: new Date(end.getTime() - DAY_MS),
    until: end,
  };
}

function sumBaseUnits(rows: Awaited<ReturnType<typeof readSupabaseTransfers>>) {
  return rows.reduce((sum, transfer) => sum + BigInt(transfer.amount || "0"), 0n).toString();
}

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
    const hasSignal = frozen > 0 || supabaseTransfers.length > 0 || supabaseAnomalies.length > 0;
    const value = hasSignal
      ? Math.max(0, Math.min(100, 100 - frozen * 10 - denied * 3 - danger * 8))
      : 0;

    postureCache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }),

  valueGoverned24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until } = currentWindow();
    const transfers = await readSupabaseTransfers(ctx, { since, until });
    // ALLOW is the only outcome that represents an executed movement. An
    // ESCALATE row is held for review and must not inflate governed value.
    const executed = transfers.filter((transfer) => transfer.verdict === "ALLOW");
    return {
      valueBaseUnits: sumBaseUnits(executed),
      movementCount: executed.length,
      outcome: "ALLOW" as const,
      ...windowMetadata(since, until),
    };
  }),

  walletActivity24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until } = currentWindow();
    // Activity is intentionally read without a pre-scope cap. The Supabase
    // query is already restricted to this caller's tenant wallet ids, and a
    // cap before that scope would make one busy wallet hide another wallet's
    // daily spend or last activity.
    const transfers = await readSupabaseTransfers(ctx);
    const activity = new Map<string, { spendBaseUnits: bigint; lastActivityAt: Date | null }>();

    for (const transfer of transfers) {
      const current = activity.get(transfer.walletId) ?? {
        spendBaseUnits: 0n,
        lastActivityAt: null,
      };
      if (
        !current.lastActivityAt ||
        transfer.timestamp.getTime() > current.lastActivityAt.getTime()
      ) {
        current.lastActivityAt = transfer.timestamp;
      }
      if (
        transfer.verdict === "ALLOW" &&
        transfer.timestamp >= since &&
        transfer.timestamp <= until
      ) {
        current.spendBaseUnits += BigInt(transfer.amount || "0");
      }
      activity.set(transfer.walletId, current);
    }

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
    const supabaseAgents = await readSupabaseAgents(ctx);
    return supabaseAgents.filter((agent) => agent.status === "active").length;
  }),

  threatsBlocked24h: publicProcedure.query(async ({ ctx }) => {
    const { since, until } = currentWindow();
    const transfers = await readSupabaseTransfers(ctx, { since, until });
    const blocked = transfers.filter(
      (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE",
    );
    return {
      count: blocked.length,
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
