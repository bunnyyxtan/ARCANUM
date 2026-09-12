import { describe, expect, it } from "vitest";

import { indexerHealthStatus } from "../routers/health";
import { checkpointCatchupTime, checkpointHealthStatus, checkpointSeenBlock } from "./health";

describe("checkpointSeenBlock", () => {
  it("prefers the recorded catch-up height on a quiet chain", () => {
    expect(checkpointSeenBlock({ last_block: 100, last_seen_block: 250 })).toBe(250);
  });

  it("keeps the confirmed cursor separate from later event progress", () => {
    expect(checkpointSeenBlock({ last_block: 300, last_seen_block: 250 })).toBe(250);
  });

  it("returns no scan cursor before a confirmed catch-up", () => {
    expect(checkpointSeenBlock({ last_block: 100, last_seen_block: null })).toBeNull();
    expect(checkpointSeenBlock({ last_block: "100" })).toBeNull();
  });

  it("returns null when the row records neither height", () => {
    expect(checkpointSeenBlock({})).toBeNull();
  });
});

describe("confirmed catch-up health", () => {
  it("does not use event progress as a catch-up timestamp", () => {
    expect(checkpointHealthStatus({ updated_at: "2025-01-01T00:00:00.000Z" })).toBe("unknown");
    expect(checkpointCatchupTime({ updated_at: "2025-01-01T00:00:00.000Z" })).toBeNull();
  });

  it("keeps a quiet-chain catch-up available without requiring an event", () => {
    expect(
      checkpointHealthStatus({
        last_block: 100,
        last_seen_block: 250,
        last_seen_at: "2025-01-01T00:00:00.000Z",
        status: "synced",
        error_note: null,
      }),
    ).toBe("available");
    expect(checkpointCatchupTime({ last_seen_at: "2025-01-01T00:00:00.000Z" })).toBe(
      "2025-01-01T00:00:00.000Z",
    );
  });

  it("keeps a ready marker valid when the status cursor is absent", () => {
    expect(
      checkpointHealthStatus({
        last_seen_block: null,
        last_seen_at: "2025-01-01T00:00:00.000Z",
        status: "synced",
        error_note: null,
      }),
    ).toBe("available");
    expect(checkpointSeenBlock({ last_seen_at: "2025-01-01T00:00:00.000Z" })).toBeNull();
  });

  it.each(["error", "failed", "syncing"])(
    "rejects a %s checkpoint despite a fresh marker",
    (status) => {
      expect(
        checkpointHealthStatus({
          status,
          error_note: null,
          last_seen_at: "2025-01-01T00:00:00.000Z",
        }),
      ).toBe("unknown");
    },
  );

  it("rejects a checkpoint with a nonempty error note despite synced status", () => {
    expect(
      checkpointHealthStatus({
        status: "synced",
        error_note: "mirror write failed",
        last_seen_at: "2025-01-01T00:00:00.000Z",
      }),
    ).toBe("unknown");
  });

  it("marks a budget-limited run stale from the old confirmed catch-up", () => {
    expect(
      indexerHealthStatus(
        "available",
        "2025-01-01T00:00:00.000Z",
        new Date("2025-01-01T04:00:00.000Z").getTime(),
      ),
    ).toBe("stale");
  });

  it("reports unknown instead of healthy when no ready marker exists", () => {
    expect(indexerHealthStatus("unknown", null)).toBe("unknown");
    expect(indexerHealthStatus("available", null)).toBe("unknown");
  });
});
