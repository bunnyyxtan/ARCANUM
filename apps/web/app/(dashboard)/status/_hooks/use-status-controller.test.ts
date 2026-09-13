import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./use-status-controller.ts", import.meta.url), "utf8");

describe("status freshness semantics", () => {
  it("uses the query result timestamp and keeps failed refreshes explicit", () => {
    expect(source).toContain("health.dataUpdatedAt");
    expect(source).toContain('result.status !== "success"');
    expect(source).toContain("Health check failed; showing the last successful result.");
    expect(source).not.toContain("new Date().toLocaleTimeString");
  });
});
