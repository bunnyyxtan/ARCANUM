import { ARC_CHAIN_ID, ARC_NETWORK, ARC_NETWORK_NAME } from "@arcanum/shared";

import {
  boundedHealthCheck,
  confirmedCursorStatus,
  indexerHealthStatus,
  maxBlockLag,
  staleAfterMs,
} from "../health/freshness";
import { readSecurityReadiness } from "../health/readiness";
import { readSupabaseRuntimeHealth } from "../supabase";
import { publicProcedure, router } from "../trpc";

export { indexerHealthStatus } from "../health/freshness";

export const healthRouter = router({
  ping: publicProcedure.query(async ({ ctx }) => {
    const [supabase, rpc, readiness] = await Promise.all([
      readSupabaseRuntimeHealth(ctx),
      boundedHealthCheck(async () => {
        const [block, chainId] = await Promise.all([
          ctx.publicClient.getBlockNumber({ cacheTime: 0 }),
          ctx.publicClient.getChainId(),
        ]);
        if (chainId !== ARC_CHAIN_ID) throw new Error("Wrong RPC network");
        return block;
      }),
      readSecurityReadiness(ctx),
    ]);
    const lastCatchupAt = supabase.indexerCheckpoint.lastCatchupAt;
    const cursor = supabase.indexerCheckpoint.lastSeenChainBlock;
    const freshness = indexerHealthStatus(supabase.indexerCheckpoint.status, lastCatchupAt);
    const indexerStatus =
      freshness === "available" && rpc.ok
        ? confirmedCursorStatus(cursor, rpc.data)
        : freshness === "available"
          ? "unknown"
          : freshness;
    const unsupportedMultiTenantIdentity =
      process.env.ARCANUM_DEPLOYMENT_MODE === "multi-tenant" && Boolean(ctx.supabase);

    return {
      ok:
        supabase.readModel.status === "available" &&
        rpc.ok &&
        indexerStatus === "available" &&
        readiness.identity.status === "available" &&
        readiness.sessions.status === "available" &&
        readiness.rateLimit.status === "available" &&
        !unsupportedMultiTenantIdentity,
      checkedAt: new Date().toISOString(),
      network: { name: ARC_NETWORK, chainId: ARC_CHAIN_ID },
      readiness,
      supabase,
      redisVersion:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? "upstash configured"
          : "unconfigured",
      indexer: {
        status: indexerStatus,
        staleAfterSeconds: (staleAfterMs() ?? 0) / 1_000,
        maxBlockLag: maxBlockLag() ?? 0,
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
        : readiness.identity.status,
    };
  }),
});
