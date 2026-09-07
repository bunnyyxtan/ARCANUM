import { describe, expect, it } from "vitest";

import { checkpointSeenBlock } from "./health";

describe("checkpointSeenBlock", () => {
  it("prefers the recorded catch-up height on a quiet chain", () => {
    expect(checkpointSeenBlock({ last_block: 100, last_seen_block: 250 })).toBe(250);
  });

  it("never reports below an event the indexer has already processed", () => {
    expect(checkpointSeenBlock({ last_block: 300, last_seen_block: 250 })).toBe(300);
  });

  it("falls back to the event height before any catch-up was recorded", () => {
    expect(checkpointSeenBlock({ last_block: 100, last_seen_block: null })).toBe(100);
    expect(checkpointSeenBlock({ last_block: "100" })).toBe(100);
  });

  it("returns null when the row records neither height", () => {
    expect(checkpointSeenBlock({})).toBeNull();
  });
});
