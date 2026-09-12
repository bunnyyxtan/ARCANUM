import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("glossary result selection", () => {
  it("does not render a stale detail when the current result set is empty", () => {
    expect(source).toContain(
      "visibleTerms.find((item) => item.term === selected) ?? visibleTerms[0] ?? null",
    );
    expect(source).toContain("NO SELECTED ENTRY");
    expect(source).toContain("No glossary term matches the current search.");
  });
});
