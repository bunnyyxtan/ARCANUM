import { defineConfig } from "tsup";

// Type-only companions for the publish build: bundle the private workspace
// packages' declarations so the published .d.ts files are self-contained.
export default defineConfig({
  entry: {
    "_arcanum-shared": "publish-entries/shared.ts",
    "_arcanum-contracts": "../contracts/index.ts",
  },
  format: ["esm", "cjs"],
  dts: {
    only: true,
    compilerOptions: {
      baseUrl: ".",
      rootDir: "../..",
      resolveJsonModule: true,
    },
  },
  outDir: "dist-publish",
  clean: false,
});
