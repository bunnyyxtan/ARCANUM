import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const primitivesSource = readFileSync(
  new URL("../components/warm/landing/primitives.tsx", import.meta.url),
  "utf8",
);

describe("landing ledger honesty", () => {
  it("labels sample rows and never presents them as a live feed", () => {
    expect(primitivesSource).toContain("Illustrative sample ledger");
    expect(primitivesSource).toContain("static illustration");
    expect(pageSource).toContain("ILLUSTRATIVE SAMPLE");
    expect(pageSource).toContain("No live ledger feed is shown here.");
    expect(pageSource).toContain('"UNAVAILABLE"');
    expect(pageSource).not.toContain("THE LIVE RECORD");
    expect(pageSource).not.toContain("Not a demo");
  });
});
