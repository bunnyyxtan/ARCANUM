import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Point published type declarations at the bundled companion declaration
// files instead of the private @arcanum/* workspace packages, then verify
// nothing unresolved is left. Fails loudly so a broken build cannot ship.
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-publish");
const targets = [
  ["index.d.ts", ".js"],
  ["chains.d.ts", ".js"],
  ["index.d.cts", ".cjs"],
  ["chains.d.cts", ".cjs"],
];

for (const [name, ext] of targets) {
  const path = join(dir, name);
  let source = readFileSync(path, "utf8");
  source = source.replaceAll("'@arcanum/shared'", `'./_arcanum-shared${ext}'`);
  source = source.replaceAll("'@arcanum/contracts'", `'./_arcanum-contracts${ext}'`);
  writeFileSync(path, source);
}

let failed = false;
for (const file of readdirSync(dir)) {
  if (!/\.d\.(ts|cts)$/.test(file)) continue;
  if (readFileSync(join(dir, file), "utf8").includes("@arcanum/")) {
    console.error(`UNRESOLVED @arcanum reference in ${file}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log("dts rewrite ok: type declarations are self-contained");
