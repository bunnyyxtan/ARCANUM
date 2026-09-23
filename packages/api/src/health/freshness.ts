export const DEFAULT_STALE_AFTER_MINUTES = 15;
export const MAX_STALE_AFTER_MINUTES = 15;
export const DEFAULT_MAX_BLOCK_LAG = 900;
export const MAX_MAX_BLOCK_LAG = 900;

/** Operators may tighten the SLO, not silently relax the production ceiling. */
export function staleAfterMs() {
  const raw = process.env.ARCANUM_INDEXER_STALE_AFTER_MINUTES;
  if (raw === undefined) return DEFAULT_STALE_AFTER_MINUTES * 60_000;
  const minutes = Number(raw);
  return Number.isFinite(minutes) && minutes > 0 && minutes <= MAX_STALE_AFTER_MINUTES
    ? minutes * 60_000
    : null;
}

/**
 * Arc currently advances at roughly one block per second. A confirmed scan may
 * age between five-minute top-ups, but it must not lag by more than the same
 * 15-minute production freshness ceiling. Operators may tighten, not relax,
 * this independent cursor bound.
 */
export function maxBlockLag() {
  const raw = process.env.ARCANUM_INDEXER_MAX_BLOCK_LAG;
  if (raw === undefined) return DEFAULT_MAX_BLOCK_LAG;
  const blocks = Number(raw);
  return Number.isSafeInteger(blocks) && blocks > 0 && blocks <= MAX_MAX_BLOCK_LAG ? blocks : null;
}

export function confirmedCursorStatus(cursor: number | null, tip: bigint) {
  const maximumLag = maxBlockLag();
  if (
    maximumLag === null ||
    cursor === null ||
    !Number.isSafeInteger(cursor) ||
    cursor < 0 ||
    BigInt(cursor) > tip ||
    tip - BigInt(cursor) > BigInt(maximumLag)
  ) {
    return "unknown" as const;
  }
  return "available" as const;
}

export function indexerHealthStatus(
  checkpointStatus: "available" | "empty" | "unknown" | "unavailable" | "not_configured",
  lastCatchupAt: string | null,
  now = Date.now(),
) {
  if (checkpointStatus !== "available") return checkpointStatus;
  const threshold = staleAfterMs();
  const caughtUp = lastCatchupAt ? Date.parse(lastCatchupAt) : Number.NaN;
  // A future timestamp is not proof of freshness. Allow only normal clock skew.
  if (threshold === null || !Number.isFinite(caughtUp) || caughtUp > now + 30_000) {
    return "unknown" as const;
  }
  return now - caughtUp > threshold ? ("stale" as const) : ("available" as const);
}

export async function boundedHealthCheck<T>(operation: () => Promise<T>, timeoutMs = 6_000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const data = await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Health probe timed out")), timeoutMs);
      }),
    ]);
    return { ok: true as const, data };
  } catch {
    // Public health must never include provider URLs, credentials or response bodies.
    return { ok: false as const };
  } finally {
    clearTimeout(timer);
  }
}
