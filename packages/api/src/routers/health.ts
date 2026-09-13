import { ARC_NETWORK_NAME } from "@arcanum/shared";

import { readSupabaseRuntimeHealth } from "../supabase";
import { publicProcedure, router } from "../trpc";

type HealthCheckResult<T> = { ok: true; data: T } | { ok: false; error: string };

/**
 * How long the read model may go without a confirmed catch-up before the
 * dashboard calls it stale.
 *
 * There is no indexer process running around the clock: a scheduled job tops
 * the read model up every three hours and stops as soon as it reaches the
 * chain tip. Against that cadence a fifteen-minute window reported "stale" for
 * the other two hours and forty-five, which trained everyone to ignore the
 * indicator. One missed cycle plus margin is the honest threshold - it still
 * catches a job that has stopped running, which is the failure worth seeing.
 */
const DEFAULT_STALE_AFTER_MINUTES = 210;

function staleAfterMs() {
  const configured = Number(process.env.ARCANUM_INDEXER_STALE_AFTER_MINUTES);
  const minutes =
    Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STALE_AFTER_MINUTES;
  return minutes * 60 * 1_000;
}

export function indexerHealthStatus(
  checkpointStatus: "available" | "empty" | "unknown" | "unavailable" | "not_configured",
  lastCatchupAt: string | null,
  now = Date.now(),
) {
  if (checkpointStatus !== "available") {
    return checkpointStatus;
  }
  if (!lastCatchupAt) {
    return "unknown" as const;
  }
  const catchupTimestamp = new Date(lastCatchupAt).getTime();
  if (!Number.isFinite(catchupTimestamp)) {
    return "unknown" as const;
  }
  return now - catchupTimestamp > staleAfterMs() ? ("stale" as const) : ("available" as const);
}

async function healthCheck<T>(operation: () => Promise<T>): Promise<HealthCheckResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const healthRouter = router({
  ping: publicProcedure.query(async ({ ctx }) => {
    const supabase = await readSupabaseRuntimeHealth(ctx);
    const rpc = await healthCheck(() => ctx.publicClient.getBlockNumber());
    const lastCatchupAt = supabase.indexerCheckpoint.lastCatchupAt;
    const indexerStatus = indexerHealthStatus(supabase.indexerCheckpoint.status, lastCatchupAt);
    const unsupportedMultiTenantIdentity =
      process.env.ARCANUM_DEPLOYMENT_MODE === "multi-tenant" && Boolean(ctx.supabase);

    return {
      ok: supabase.readModel.status === "available" && rpc.ok && !unsupportedMultiTenantIdentity,
      supabase,
      redisVersion:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? "upstash configured"
          : "unconfigured",
      indexer: {
        status: indexerStatus,
        lastIndexedBlock: supabase.indexerCheckpoint.lastIndexedBlock,
        lastSeenChainBlock: supabase.indexerCheckpoint.lastSeenChainBlock,
        // Keep the old field for API consumers that display event progress,
        // but never use it for freshness. `lastCatchupAt` is the only
        // timestamp that can make this status available.
        lastIndexedAt: supabase.indexerCheckpoint.lastIndexedAt,
        lastEventAt: supabase.indexerCheckpoint.lastEventAt,
        lastCatchupAt,
        error:
          supabase.indexerCheckpoint.error ??
          (supabase.indexerCheckpoint.status === "empty"
            ? "No checkpoint yet."
            : supabase.indexerCheckpoint.status === "unknown"
              ? "No confirmed full catch-up is available."
              : null),
      },
      rpc: {
        status: rpc.ok ? "available" : "unavailable",
        latestBlock: rpc.ok ? rpc.data.toString() : null,
        error: rpc.ok ? null : `${ARC_NETWORK_NAME} RPC is unavailable.`,
      },
      deploymentMode: process.env.ARCANUM_DEPLOYMENT_MODE ?? "supabase",
      identityProvisioning: unsupportedMultiTenantIdentity
        ? "unsupported: multi-tenant mode requires tenant-scoped Supabase identity"
        : "available",
    };
  }),
});
