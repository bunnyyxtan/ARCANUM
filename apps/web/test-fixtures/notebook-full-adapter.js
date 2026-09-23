/*
 * Trusted notebook bridge for the canonical CommonJS remediation adapter.
 *
 * The CommonJS adapter remains the source of truth for routing, identity
 * transitions, stateful mutations, downloads, print spying, evidence, and
 * fail-closed behavior. This file does not duplicate that implementation. It
 * evaluates the checked-in helper source with deterministic local shims and
 * returns the helper's module.exports.
 *
 * This file is evaluated in the notebook/test realm only. It is never passed
 * to page.evaluate and it never evaluates application code.
 *
 * JSON fixture override (the notebook has no require/process/viem):
 *
 *   const baseBundle = await ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs });
 *   const fixture = JSON.parse(await fs.readFile(addonPath, "utf8"));
 *   const loaded = await ArcanumClosureNotebookFullAdapter.loadFullFixtureBundle({
 *     fs, io, bundle: { ...baseBundle, fixture },
 *   });
 *
 * The full factory always passes bundle.fixture to the evaluated CommonJS
 * adapter, so this override is intentionally applied before loading it.
 */
(function installArcanumFullNotebookAdapter(global) {
  const ADAPTER_PATH = "arcanum/apps/web/test-fixtures/remediation-browser-adapter.cjs";
  const PROVIDER_PATH = "arcanum/apps/web/test-fixtures/synthetic-wallet-provider.cjs";
  const RECEIPT_MODULE_PATH = "./browser-receipt-fixtures.cjs";
  const WORKSPACE = "/arcanum-notebook-workspace";
  const TEXT_ENCODER = typeof TextEncoder === "function" ? TextEncoder : null;

  function decode(value) {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    if (value && typeof value.length === "number") {
      return new TextDecoder().decode(new Uint8Array(value));
    }
    throw new Error("Notebook filesystem returned a non-text value.");
  }

  async function readNotebookFile(fs, path) {
    if (typeof fs?.readText === "function") return decode(await fs.readText(path));
    if (typeof fs?.readFile === "function") return decode(await fs.readFile(path));
    throw new Error("An async fs.readFile or fs.readText function is required.");
  }

  function normalise(parts, absolute) {
    const result = [];
    for (const part of parts.join("/").split("/")) {
      if (!part || part === ".") continue;
      if (part === "..") {
        if (result.length) result.pop();
      } else result.push(part);
    }
    return `${absolute ? "/" : ""}${result.join("/")}`;
  }

  function makePathShim() {
    return {
      join(...parts) {
        return normalise(parts, parts[0]?.startsWith("/"));
      },
      resolve(...parts) {
        const values = parts.filter((part) => typeof part === "string");
        return normalise(values[0]?.startsWith("/") ? values : [WORKSPACE, ...values], true);
      },
    };
  }

  function makeBufferShim() {
    const attachToString = (bytes) => {
      Object.defineProperty(bytes, "toString", {
        configurable: true,
        value(encoding) {
          if (encoding !== "utf8" && encoding !== "utf-8") {
            throw new Error(`Notebook Buffer shim only supports utf8, got ${String(encoding)}.`);
          }
          return new TextDecoder().decode(bytes);
        },
      });
      return bytes;
    };
    return {
      from(value) {
        if (typeof value === "string") {
          if (!TEXT_ENCODER) throw new Error("TextEncoder is unavailable in this notebook.");
          return attachToString(new TEXT_ENCODER().encode(value));
        }
        return attachToString(new Uint8Array(value));
      },
      concat(chunks) {
        const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
        const output = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.length;
        }
        return attachToString(output);
      },
    };
  }

  function makeFileShims(bundle, io = {}, workspaceDirectory = WORKSPACE) {
    const fixtureText = JSON.stringify(bundle.fixture);
    const providerText = bundle.providerSource;
    const validText = JSON.stringify(bundle.receipts.valid);
    const tamperedText = JSON.stringify(bundle.receipts.tampered);
    const receiptDirectory = `${workspaceDirectory}/.local/audits/arcanum-2026-09-12`;
    const knownPaths = [
      `${workspaceDirectory}/.local`,
      `${workspaceDirectory}/arcanum/apps/web/test-fixtures`,
      `${workspaceDirectory}/.local/audits/arcanum-2026-09-12`,
    ];
    const textAt = (filePath) => {
      const value = String(filePath).replaceAll("\\", "/");
      if (value.endsWith("remediation-fixtures.json")) return fixtureText;
      if (value.endsWith("synthetic-wallet-provider.cjs")) return providerText;
      if (value.endsWith("pdr-valid.json")) return validText;
      if (value.endsWith("pdr-tampered-amount.json")) return tamperedText;
      throw new Error(`Notebook fixture fs blocked unknown read: ${value}`);
    };
    const existsAt = (filePath) => {
      const value = String(filePath).replaceAll("\\", "/").replace(/\/+$/, "");
      return (
        knownPaths.includes(value) ||
        value.endsWith("remediation-fixtures.json") ||
        value.endsWith("synthetic-wallet-provider.cjs") ||
        value.endsWith("pdr-valid.json") ||
        value.endsWith("pdr-tampered-amount.json")
      );
    };
    const readFileSync = (filePath, encoding) => {
      const text = textAt(filePath);
      return encoding === "buffer" ? makeBufferShim().from(text) : text;
    };
    const readFile = async (filePath, encoding) => readFileSync(filePath, encoding);
    const mkdir = async (directory, options) => {
      if (typeof io.mkdir === "function") return io.mkdir(directory, options);
      throw new Error(
        "Evidence mkdir is unsupported: inject io.mkdir into installFullFixtureHarness.",
      );
    };
    const writeFile = async (filePath, data, encoding) => {
      if (typeof io.writeFile !== "function") {
        throw new Error(
          "Evidence writes are unsupported: inject io.writeFile into installFullFixtureHarness.",
        );
      }
      return io.writeFile(filePath, data, encoding);
    };
    return {
      fs: { existsSync: existsAt, readFileSync },
      fsp: { readFile, mkdir, writeFile },
      receiptDirectory,
    };
  }

  function makeRequire(shims) {
    const modules = new Map([
      ["node:fs", shims.fs],
      ["fs", shims.fs],
      ["fs/promises", shims.fsp],
      ["node:fs/promises", shims.fsp],
      ["path", shims.path],
      ["node:path", shims.path],
      [RECEIPT_MODULE_PATH, shims.receipts],
      ["receipt-fixtures", shims.receipts],
    ]);
    return (specifier) => {
      if (!modules.has(specifier)) {
        throw new Error(`Notebook CommonJS require blocked: ${String(specifier)}`);
      }
      return modules.get(specifier);
    };
  }

  function evaluateOriginalAdapter(source, bundle, io, workspaceDirectory) {
    const path = makePathShim();
    const files = makeFileShims(bundle, io, workspaceDirectory);
    const receipts = {
      loadBrowserReceiptFixtures() {
        return {
          valid: clone(bundle.receipts.valid),
          tampered: clone(bundle.receipts.tampered),
          trust: clone(bundle.receipts.trust),
        };
      },
    };
    const module = { exports: {} };
    const localProcess = Object.freeze({ cwd: () => workspaceDirectory });
    const localRequire = makeRequire({ ...files, path, receipts });
    const localBuffer = makeBufferShim();
    const evaluate = Function(
      "require",
      "module",
      "exports",
      "__dirname",
      "process",
      "Buffer",
      `"use strict";\n${source}\nreturn module.exports;`,
    );
    const exportsValue = evaluate(
      localRequire,
      module,
      module.exports,
      `${workspaceDirectory}/arcanum/apps/web/test-fixtures`,
      localProcess,
      localBuffer,
    );
    if (!exportsValue || typeof exportsValue.installFixtureHarness !== "function") {
      throw new Error("Original remediation adapter did not export installFixtureHarness.");
    }
    return exportsValue;
  }

  function clone(value) {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }

  async function loadFullFixtureBundle({
    fs,
    io,
    bundle,
    adapterSource,
    workspaceDirectory = WORKSPACE,
    paths = {},
  } = {}) {
    const bootstrap = global.ArcanumClosureNotebookAdapter;
    if (!bundle) {
      if (!bootstrap || typeof bootstrap.loadFixtureBundle !== "function") {
        throw new Error(
          "Load remediation-browser-notebook-adapter.js first, or pass its bundle explicitly.",
        );
      }
      bundle = await bootstrap.loadFixtureBundle({ fs, paths });
    }
    const source = adapterSource ?? (await readNotebookFile(fs, paths.adapter ?? ADAPTER_PATH));
    const adapter = evaluateOriginalAdapter(source, bundle, io, workspaceDirectory);
    const installFullFixtureHarness = async (page, options = {}) =>
      adapter.installFixtureHarness(page, {
        ...options,
        fixture: bundle.fixture,
        workspaceDirectory,
        walletPath: `${workspaceDirectory}/${PROVIDER_PATH}`,
      });
    const addonInstalled =
      bundle.fixture?.approverExpiryAddon?.schema ===
      "arcanum.remediation-approver-expiry-addon.v1";
    const unsupported = addonInstalled
      ? Object.freeze(
          (bundle.unsupported || []).filter(
            (item) =>
              !/distinct non-owner approver|expired workspace\/public sweepExpired/i.test(
                String(item),
              ),
          ),
        )
      : Object.freeze([
          "distinct non-owner approver identity and organization membership overlay",
          "expired workspace/public sweepExpired calldata, receipt, and post-read state",
        ]);
    return {
      bundle,
      adapter,
      installFullFixtureHarness,
      unsupported,
    };
  }

  async function installFullFixtureHarness(page, options = {}) {
    const loaded = await loadFullFixtureBundle(options);
    return loaded.installFullFixtureHarness(page, options.harnessOptions ?? {});
  }

  global.ArcanumClosureNotebookFullAdapter = Object.freeze({
    ADAPTER_PATH,
    installFullFixtureHarness,
    loadFullFixtureBundle,
    evaluateOriginalAdapter,
  });
})(typeof globalThis === "undefined" ? this : globalThis);
