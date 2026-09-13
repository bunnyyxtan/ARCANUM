import { describe, expect, it } from "vitest";

import { indexerMetricLabel } from "./indexer-metric-label";

describe("indexerMetricLabel", () => {
  it("names the last event block when the read model has run ahead of it", () => {
    expect(
      indexerMetricLabel({
        lastIndexedBlock: 100,
        lastSeenChainBlock: 250,
        status: "available",
      }),
    ).toBe("SYNCED THROUGH · LAST EVENT AT BLOCK 100");
  });

  it("says so when the last event is the synced height", () => {
    expect(
      indexerMetricLabel({
        lastIndexedBlock: 250,
        lastSeenChainBlock: 250,
        status: "available",
      }),
    ).toBe("SYNCED THROUGH · LAST EVENT AT THIS BLOCK");
  });

  it("does not present event progress as scan lag when catch-up is unknown", () => {
    expect(
      indexerMetricLabel({
        lastIndexedBlock: 100,
        lastSeenChainBlock: null,
        status: "unknown",
      }),
    ).toBe("CATCH-UP UNKNOWN · LAST EVENT BLOCK ONLY");
    expect(indexerMetricLabel(undefined)).toBe("CATCH-UP UNKNOWN · NO CONFIRMED SCAN");
  });

  it("labels a stale confirmed catch-up without inventing a scan cursor", () => {
    expect(
      indexerMetricLabel({
        lastIndexedBlock: 100,
        lastSeenChainBlock: null,
        status: "stale",
      }),
    ).toBe("STALE · CATCH-UP CURSOR UNKNOWN");
  });
});
