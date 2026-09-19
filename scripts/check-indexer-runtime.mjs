/**
 * Offline compatibility gate for Ponder's security overrides.
 * Run from any directory: node /path/to/arcanum/scripts/check-indexer-runtime.mjs
 *
 * Uses the installed Ponder compiler and migrations, not a replacement loader.
 * Its internal APIs are intentionally exercised: an upstream change must fail
 * this gate until the tested override pairing is reviewed. No handlers run.
 */
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { Socket } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));

// Never consume production credentials, even when invoked from a deployed shell.
for (const name of Object.keys(process.env)) {
  if (/DATABASE|SUPABASE/.test(name)) delete process.env[name];
}
Object.assign(process.env, {
  NODE_ENV: "test",
  ARC_NETWORK: "testnet",
  NEXT_PUBLIC_ARC_NETWORK: "testnet",
  ARCANUM_DISABLE_PG_MIRROR: "0",
  // The real config requires a URL, but neither this database nor RPC is used.
  DATABASE_URL: "postgresql://127.0.0.1:1/arcanum_offline_compat",
  INDEXER_RPC_URL: "http://127.0.0.1:1",
  INDEXER_RPC_REQUESTS_PER_SECOND: "1",
});

let networkAttempts = 0;
function denyNetwork() {
  networkAttempts += 1;
  throw new Error("Indexer compatibility proof forbids network access");
}
// Install before importing Ponder or any application module. This also catches
// accidental Postgres/RPC writes if an import gains a side effect in the future.
Socket.prototype.connect = denyNetwork;
globalThis.fetch = denyNetwork;

function packageInfo(entry, name) {
  let directory = path.dirname(entry);
  for (;;) {
    const filename = path.join(directory, "package.json");
    if (existsSync(filename)) {
      const pkg = JSON.parse(readFileSync(filename, "utf8"));
      if (pkg.name === name) {
        const key = path.relative(root, directory).split(path.sep).join("/");
        assert.equal(pkg.version, lock.packages[key]?.version, `${name}: runtime/lock mismatch`);
        if (typeof manifest.overrides[name] === "string") {
          assert.equal(pkg.version, manifest.overrides[name], `${name}: override was not applied`);
        }
        console.log(`${name}@${pkg.version}: installed version matches lock and overrides`);
        return { directory, pkg };
      }
    }
    const parent = path.dirname(directory);
    assert.notEqual(parent, directory, `Cannot locate package metadata for ${name}`);
    directory = parent;
  }
}

function success(result, label) {
  if (result.status !== "success") throw result.error ?? new Error(`${label} failed`);
  console.log(`${label}: passed`);
  return result.result;
}

const ponderEntry = fileURLToPath(import.meta.resolve("ponder"));
const { directory: ponderDirectory, pkg: ponderPackage } = packageInfo(ponderEntry, "ponder");
const requirePonder = createRequire(path.join(ponderDirectory, "package.json"));
for (const name of ["@hono/node-server", "drizzle-orm", "kysely", "vite"]) {
  packageInfo(requirePonder.resolve(name), name);
}
const adapter = await import(pathToFileURL(requirePonder.resolve("@hono/node-server")));
const staticFiles = await import(
  pathToFileURL(requirePonder.resolve("@hono/node-server/serve-static"))
);
assert.equal(typeof adapter.serve, "function");
assert.equal(typeof staticFiles.serveStatic, "function");

const load = (file) => import(pathToFileURL(path.join(path.dirname(ponderEntry), file)));
const { createBuild } = await load("build/index.js");
const { buildOptions } = await load("internal/options.js");
const { createShutdown } = await load("internal/shutdown.js");
const { createNoopLogger } = await load("internal/logger.js");
const { createPglite, createPgliteKyselyDialect } = await load("utils/pglite.js");
const { buildMigrationProvider } = await load("sync-store/migrations.js");
const { Kysely, Migrator, WithSchemaPlugin } = await import(
  pathToFileURL(requirePonder.resolve("kysely"))
);

const cache = mkdtempSync(path.join(tmpdir(), "arcanum-ponder-compat-"));
const logger = createNoopLogger();
const cliOptions = {
  command: "codegen",
  version: ponderPackage.version,
  config: "ponder.config.ts",
  root: path.join(root, "packages/indexer"),
  schema: "ponder_compat_test",
};
const common = {
  options: { ...buildOptions({ cliOptions }), ponderDir: cache },
  logger,
  buildShutdown: createShutdown(),
  shutdown: createShutdown(),
};
try {
  const build = await createBuild({ common, cliOptions });
  success(build.namespaceCompile(), "Ponder namespace compile");
  const config = success(await build.executeConfig(), "Real indexer config import");
  const schema = success(await build.executeSchema(), "Real indexer schema import");
  const preBuild = success(build.preCompile({ config: config.config }), "Ponder precompile");
  const compiled = success(
    build.compileSchema({ schema: schema.schema, preBuild }),
    "Drizzle schema SQL compiler",
  );
  assert(compiled.statements);
  const handlers = success(await build.executeIndexingFunctions(), "Real indexer handler imports");
  assert(handlers.indexingFunctions.length > 0, "No real indexing handlers were registered");
  console.log(`Registered ${handlers.indexingFunctions.length} event handlers (not executed)`);
} finally {
  await common.buildShutdown.kill();
  await common.shutdown.kill();
  rmSync(cache, { recursive: true, force: true });
}

const client = createPglite({ dataDir: "memory://" });
const db = new Kysely({
  dialect: createPgliteKyselyDialect(client),
  plugins: [new WithSchemaPlugin("ponder_sync")],
});
try {
  await db.schema.createSchema("ponder_sync").ifNotExists().execute();
  const migrator = new Migrator({
    db,
    provider: buildMigrationProvider(logger),
    migrationTableSchema: "ponder_sync",
  });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
  assert(result.results?.length > 0, "No actual Ponder migrations were tested");
  assert(result.results.every((migration) => migration.status === "Success"));
  console.log(`Ponder sync-store migrations on in-memory PGlite: ${result.results.length} passed`);
} finally {
  await db.destroy();
}

// Exercise the native binary selected at the Vite/Ponder boundary, not just a
// different root esbuild executable that happens to work.
const vite = packageInfo(requirePonder.resolve("vite"), "vite");
const requireVite = createRequire(path.join(vite.directory, "package.json"));
packageInfo(requireVite.resolve("esbuild"), "esbuild");
const esbuild = requireVite("esbuild");
const transformed = await esbuild.transform("const answer: number = 42", { loader: "ts" });
assert(transformed.code.includes("42"));
assert.equal(networkAttempts, 0, "Application imports attempted network access");
console.log("Ponder/Vite native transform passed; no RPC, Postgres, or Supabase connections made.");
