import { describe, expect, it } from "vitest";

import { indexerMetricLabel } from "./indexer-metric-label";

describe("indexerMetricLabel", () => {
  it("names the last event block when the read model has run ahead of it", () => {
    expect(indexerMetricLabel({ lastIndexedBlock: 100, lastSeenChainBlock: 250 })).toBe(
      "SYNCED THROUGH · LAST EVENT AT BLOCK 100",
    );
  });

  it("says so when the last event is the synced height", () => {
    expect(indexerMetricLabel({ lastIndexedBlock: 250, lastSeenChainBlock: 250 })).toBe(
      "SYNCED THROUGH · LAST EVENT AT THIS BLOCK",
    );
  });

  it("falls back to the event block when no catch-up height was recorded", () => {
    expect(indexerMetricLabel({ lastIndexedBlock: 100, lastSeenChainBlock: null })).toBe(
      "LAST EVENT BLOCK",
    );
    expect(indexerMetricLabel(undefined)).toBe("LAST EVENT BLOCK");
  });
});
