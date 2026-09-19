import { appRouter, createContext } from "@arcanum/api/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const health = await Promise.race([
      appRouter.createCaller(createContext({ requestFingerprint: "health-probe" })).health.ping(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Health deadline exceeded")), 10_000);
      }),
    ]);
    // Deliberately omit provider errors, URLs, table rows and configuration flags.
    const publicHealth = {
      ok: health.ok,
      checkedAt: health.checkedAt,
      network: health.network,
      readiness: health.readiness,
      rpc: { status: health.rpc.status, latestBlock: health.rpc.latestBlock },
      supabase: { readModel: { status: health.supabase.readModel.status } },
      indexer: {
        status: health.indexer.status,
        lastCatchupAt: health.indexer.lastCatchupAt,
        lastSeenChainBlock: health.indexer.lastSeenChainBlock,
        lastIndexedBlock: health.indexer.lastIndexedBlock,
        staleAfterSeconds: health.indexer.staleAfterSeconds,
        maxBlockLag: health.indexer.maxBlockLag,
      },
    };
    return Response.json(publicHealth, {
      status: health.ok ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return Response.json(
      { ok: false, checkedAt: new Date().toISOString(), error: "Health dependencies unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } finally {
    clearTimeout(timer);
  }
}
