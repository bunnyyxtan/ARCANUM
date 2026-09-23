import { copyFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Point published type declarations at the bundled companion declaration
// files instead of the private @arcanum/* workspace packages, then verify
// nothing unresolved is left. Fails loudly so a broken build cannot ship.
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist-publish");
const targets = [
  ["index.d.ts", ".js"],
  ["chains.d.ts", ".js"],
  ["circle.d.ts", ".js"],
  ["cctp.d.ts", ".js"],
  ["index.d.cts", ".cjs"],
  ["chains.d.cts", ".cjs"],
  ["circle.d.cts", ".cjs"],
  ["cctp.d.cts", ".cjs"],
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

const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const workspaceManifest = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const rootManifest = JSON.parse(readFileSync(join(packageDir, "..", "..", "package.json"), "utf8"));
for (const file of ["README.md", "LICENSE", "CHANGELOG.md"]) {
  copyFileSync(join(packageDir, file), join(dir, file));
}
const publishManifest = {
  name: "arcanum-sdk",
  version: workspaceManifest.version,
  description: workspaceManifest.description,
  license: workspaceManifest.license,
  homepage: rootManifest.homepage,
  repository: { ...rootManifest.repository, directory: "packages/sdk" },
  bugs: rootManifest.bugs,
  keywords: workspaceManifest.keywords,
  type: workspaceManifest.type,
  exports: {
    ".": {
      import: { types: "./index.d.ts", default: "./index.js" },
      require: { types: "./index.d.cts", default: "./index.cjs" },
    },
    "./chains": {
      import: { types: "./chains.d.ts", default: "./chains.js" },
      require: { types: "./chains.d.cts", default: "./chains.cjs" },
    },
    "./circle": {
      import: { types: "./circle.d.ts", default: "./circle.js" },
      require: { types: "./circle.d.cts", default: "./circle.cjs" },
    },
    "./cctp": {
      import: { types: "./cctp.d.ts", default: "./cctp.js" },
      require: { types: "./cctp.d.cts", default: "./cctp.cjs" },
    },
    "./package.json": "./package.json",
  },
  peerDependencies: workspaceManifest.peerDependencies,
};
writeFileSync(join(dir, "package.json"), `${JSON.stringify(publishManifest, null, 2)}\n`);
console.log("publish package prepared as arcanum-sdk with self-contained declarations");
