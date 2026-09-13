import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type LockPackage = {
  version?: string;
  optionalDependencies?: Record<string, string>;
};

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(`${repositoryRoot}/${relativePath}`, "utf8")) as T;
}

function versionAtLeast(version: string, minimum: [number, number, number]) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  for (let index = 0; index < minimum.length; index += 1) {
    const part = parts[index];
    const required = minimum[index];
    if (part === undefined || required === undefined || !Number.isFinite(part)) {
      return false;
    }
    if (part !== required) {
      return part > required;
    }
  }

  return true;
}

describe("Next.js image optimizer security baseline", () => {
  it("keeps every Next app on the patched 15.x line", () => {
    const web = readJson<{ dependencies: { next: string } }>("apps/web/package.json");
    const docs = readJson<{ dependencies: { next: string } }>("apps/docs/package.json");
    const lock = readJson<{ packages: Record<string, LockPackage> }>("package-lock.json");
    const lockedNext = lock.packages["node_modules/next"];
    const lockedSharp = lock.packages["node_modules/sharp"];

    expect(web.dependencies.next).toMatch(/^\^15\.5\.(2[4-9]|[3-9]\d)$/);
    expect(docs.dependencies.next).toMatch(/^\^15\.5\.(2[4-9]|[3-9]\d)$/);
    expect(lockedNext?.version).toBeDefined();
    expect(versionAtLeast(lockedNext?.version ?? "0.0.0", [15, 5, 24])).toBe(true);
    expect(lockedNext?.optionalDependencies?.sharp).toMatch(/\^0\.35\./);
    expect(lockedSharp?.version).toBeDefined();
    expect(versionAtLeast(lockedSharp?.version ?? "0.0.0", [0, 35, 4])).toBe(true);
  });
});
