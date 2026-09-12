type IndexerHeights = {
  lastIndexedBlock: number | null;
  lastSeenChainBlock: number | null;
  status?: "available" | "stale" | "unknown" | "empty" | "unavailable" | "not_configured";
};

/**
 * Caption under the indexer height on the status page.
 *
 * Event progress and a confirmed full catch-up are different facts. A missing
 * catch-up marker must remain visibly unknown rather than being presented as a
 * scan lag inferred from the age of the last event.
 */
export function indexerMetricLabel(indexer: IndexerHeights | undefined) {
  if (
    !indexer ||
    (indexer.status !== undefined && indexer.status !== "available" && indexer.status !== "stale")
  ) {
    return indexer?.lastIndexedBlock != null
      ? "CATCH-UP UNKNOWN · LAST EVENT BLOCK ONLY"
      : "CATCH-UP UNKNOWN · NO CONFIRMED SCAN";
  }
  if (indexer.status === "stale") {
    return indexer.lastSeenChainBlock == null
      ? "STALE · CATCH-UP CURSOR UNKNOWN"
      : "STALE · LAST CONFIRMED CATCH-UP";
  }
  if (indexer.lastSeenChainBlock == null) {
    return indexer.lastIndexedBlock != null
      ? "SYNCED THROUGH · CURSOR UNKNOWN · LAST EVENT BLOCK"
      : "SYNCED THROUGH · CURSOR UNKNOWN";
  }
  if (indexer.lastIndexedBlock != null && indexer.lastSeenChainBlock > indexer.lastIndexedBlock) {
    return `SYNCED THROUGH · LAST EVENT AT BLOCK ${indexer.lastIndexedBlock}`;
  }
  return "SYNCED THROUGH · LAST EVENT AT THIS BLOCK";
}
