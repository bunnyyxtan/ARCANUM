type IndexerHeights = {
  lastIndexedBlock: number | null;
  lastSeenChainBlock: number | null;
};

/**
 * Caption under the indexer height on the status page.
 *
 * The headline is the chain height the read model is level with. The last
 * event block is usually older on a quiet chain, and spelling that out is what
 * stops a reader from mistaking a quiet chain for a lagging indexer.
 */
export function indexerMetricLabel(indexer: IndexerHeights | undefined) {
  if (!indexer || indexer.lastSeenChainBlock == null) {
    return "LAST EVENT BLOCK";
  }
  if (indexer.lastIndexedBlock != null && indexer.lastSeenChainBlock > indexer.lastIndexedBlock) {
    return `SYNCED THROUGH · LAST EVENT AT BLOCK ${indexer.lastIndexedBlock}`;
  }
  return "SYNCED THROUGH · LAST EVENT AT THIS BLOCK";
}
