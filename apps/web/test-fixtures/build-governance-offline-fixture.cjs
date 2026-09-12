/*
 * Generate the bounded offline governance fixture from the canonical fixture.
 * Run from arcanum/:
 *
 *   node apps/web/test-fixtures/build-governance-offline-fixture.cjs
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { composeFixture, assertFixtureRoutes } = require("./governance-offline-addon.cjs");

const workspace = path.resolve(__dirname, "../../../..");
const inputPath = path.join(
  workspace,
  ".local/audits/arcanum-2026-09-12/remediation-fixtures.json",
);
const outputPath = path.join(
  workspace,
  ".local/audits/arcanum-2026-09-12/fixtures/governance-offline.json",
);

const baseFixture = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const fixture = composeFixture(baseFixture);
const summary = assertFixtureRoutes(fixture);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(
  outputPath,
  `${JSON.stringify(
    fixture,
    (_, value) => (typeof value === "bigint" ? value.toString() : value),
    2,
  )}\n`,
  "utf8",
);
console.log(JSON.stringify({ outputPath, ...summary }));
