import { describe, expect, it } from "vitest";

import { formatStatusTimestamp } from "./status-time";

describe("formatStatusTimestamp", () => {
  it("includes the timezone instead of labelling local time as UTC", () => {
    const utc = formatStatusTimestamp(0, "en-US", "UTC");
    const india = formatStatusTimestamp(0, "en-US", "Asia/Calcutta");

    expect(utc).toContain("UTC");
    expect(india).not.toBe(utc);
    expect(india).toMatch(/GMT\+5:30|GMT\+05:30/);
  });
});
