import { defineConfig } from "tsup";

// npm publish build: bundles workspace deps so the public package is self-contained.
export default defineConfig({
  entry: ["src/index.ts", "src/chains.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  outDir: "dist-publish",
  noExternal: ["@arcanum/contracts", "@arcanum/shared"],
});
