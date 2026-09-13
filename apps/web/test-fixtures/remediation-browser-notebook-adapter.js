/*
 * Notebook-loadable Arcanum closure adapter.
 *
 * This is deliberately a plain script with no Node module loader, runtime
 * globals, path API, dependency, app injection, or browser launch. The
 * notebook supplies an async filesystem object to load the canonical fixture
 * payload into memory. The returned harness can then be used with the
 * notebook's existing JS Playwright `page`.
 *
 * Trusted notebook loading:
 *
 *   const bundle = await ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs });
 *   const harness = await bundle.installFixtureHarness(page);
 *
 * The payload contains the generated fixture JSON, the synthetic provider
 * source, and both signed receipt JSON cases. Evidence writes are optional and
 * use only an injected `writeFile`/`mkdir` implementation.
 */
(function installArcanumClosureNotebookAdapter(global) {
  const FIXTURE_SCHEMA = "arcanum.remediation-browser-fixtures.v1";
  const OWNER_CHAIN_ID = 5042002;
  const SESSION_TTL_MS = 604800000;
  const DEFAULT_PATHS = Object.freeze({
    fixture: ".local/audits/arcanum-2026-09-12/remediation-fixtures.json",
    provider: "arcanum/apps/web/test-fixtures/synthetic-wallet-provider.cjs",
    validReceipt: ".local/audits/arcanum-2026-09-12/fixtures/pdr-valid.json",
    tamperedReceipt: ".local/audits/arcanum-2026-09-12/fixtures/pdr-tampered-amount.json",
  });
  const UNSUPPORTED_FLOWS = Object.freeze([
    "distinct approver account and council-session overlay",
    "expired workspace/public sweepExpired calldata, receipt, and post-read overlay",
    "vendor add/block/remove/cap mutation state overlays",
    "anomaly freeze/acknowledge transaction state",
    "settings add/remove member mutation state",
    "receipt CSV/report popup capture helpers",
  ]);

  function decode(value) {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array) return new TextDecoder().decode(value);
    if (value && typeof value.length === "number") {
      return new TextDecoder().decode(new Uint8Array(value));
    }
    throw new Error("Notebook filesystem returned a non-text value.");
  }

  async function readText(fs, path) {
    if (typeof fs?.readText === "function") return decode(await fs.readText(path));
    if (typeof fs?.readFile === "function") return decode(await fs.readFile(path));
    throw new Error("An async fs.readFile or fs.readText function is required.");
  }

  async function writeText(fs, path, text) {
    if (typeof fs?.writeText === "function") {
      await fs.writeText(path, text);
      return true;
    }
    if (typeof fs?.writeFile === "function") {
      await fs.writeFile(path, text);
      return true;
    }
    return false;
  }

  async function writeBinary(fs, path, bytes) {
    if (typeof fs?.writeFile === "function") {
      await fs.writeFile(path, bytes);
      return true;
    }
    if (typeof fs?.writeBytes === "function") {
      await fs.writeBytes(path, bytes);
      return true;
    }
    return false;
  }

  function stripCommonJsExport(source) {
    const browserSource = String(source).replace(
      /\s*module\.exports\s*=\s*\{\s*installSyntheticWallet\s*\};?\s*$/,
      "",
    );
    if (
      browserSource.includes("module.exports") ||
      !browserSource.includes("function installSyntheticWallet")
    ) {
      throw new Error("Synthetic provider source is not a safe browser script.");
    }
    return browserSource;
  }

  function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  }

  function failClosed(status, code, message) {
    return {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-arcanum-fixture-mode": "isolated-simulation",
        "x-arcanum-fixture-fail-closed": "1",
      },
      body: JSON.stringify({
        error: {
          json: {
            message: `SYNTHETIC_FIXTURE_BLOCKED: ${message}`,
            data: { code, httpStatus: status },
          },
        },
      }),
    };
  }

  function jsonResponse(body, status = 200) {
    return {
      status,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "x-arcanum-fixture-mode": "isolated-simulation",
      },
      body: JSON.stringify(body),
    };
  }

  function rpcError(id, message, code = -32000) {
    return {
      jsonrpc: "2.0",
      id: id ?? null,
      error: { code, message: `SYNTHETIC_RPC_BLOCKED: ${message}` },
    };
  }

  function lower(value) {
    return typeof value === "string" ? value.toLowerCase() : value;
  }

  function parseInput(raw, index = 0) {
    if (!raw) return null;
    let decoded;
    try {
      decoded = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      return null;
    }
    const selected = Array.isArray(decoded)
      ? decoded[index]
      : (decoded?.[String(index)] ?? decoded);
    return selected?.json ?? selected ?? null;
  }

  function procedureResponse(fixture, procedure) {
    return clone(fixture.trpc.responses?.[procedure]?.response);
  }

  function rpcReads(fixture) {
    const approver = fixture.rpc.read?.approver ?? {};
    return [
      ...(fixture.rpc.read?.common ?? []),
      approver.initial,
      approver.settled?.approve,
      approver.settled?.reject,
      approver.settled?.cancel,
      approver.isRequiredSignerOwner,
      approver.isRequiredSignerViewer,
      approver.signedFalse,
      approver.signedFalseViewer,
    ].filter(Boolean);
  }

  function exactTransaction(fixture, params) {
    const tx = params?.[0];
    if (!tx || typeof tx !== "object") return null;
    if (Object.keys(tx).some((key) => !["from", "to", "data", "value"].includes(key))) return null;
    return (
      fixture.rpc.transactions.find(
        (candidate) =>
          lower(candidate.from) === lower(tx.from) &&
          lower(candidate.to) === lower(tx.to) &&
          lower(candidate.data) === lower(tx.data) &&
          lower(candidate.value || "0x0") === lower(tx.value || "0x0"),
      ) ?? null
    );
  }

  function routeRpc(fixture, state, request) {
    let payload;
    try {
      payload = JSON.parse(request.postData() || "null");
    } catch {
      return jsonResponse(rpcError(null, "RPC body is not JSON."));
    }
    const calls = Array.isArray(payload) ? payload : [payload];
    const results = calls.map((call) => {
      if (!call || typeof call.method !== "string") {
        return rpcError(call?.id, "RPC request is malformed.", -32600);
      }
      if (
        call.method === "eth_sendTransaction" ||
        call.method === "eth_sendRawTransaction" ||
        call.method === "eth_sign" ||
        call.method === "personal_sign" ||
        call.method.startsWith("eth_signTypedData") ||
        call.method === "wallet_sendCalls"
      ) {
        return rpcError(call.id, `${call.method} is never permitted through this route.`, 4001);
      }
      if (call.method === "eth_chainId") {
        if ((call.params || []).length) return rpcError(call.id, "Unexpected chainId parameters.");
        return {
          jsonrpc: "2.0",
          id: call.id ?? null,
          result: `0x${(fixture.rpc.chainId ?? OWNER_CHAIN_ID).toString(16)}`,
        };
      }
      if (call.method === "eth_call") {
        const params = call.params || [];
        const target = params[0] || {};
        if (
          params.length > 2 ||
          (params[1] !== undefined && params[1] !== "latest") ||
          Object.keys(target).some((key) => !["to", "data"].includes(key))
        ) {
          return rpcError(call.id, "eth_call parameters are not an exact fixture read.");
        }
        const read = rpcReads(fixture).find(
          (item) =>
            lower(item.address) === lower(target.to) && lower(item.data) === lower(target.data),
        );
        return read
          ? { jsonrpc: "2.0", id: call.id ?? null, result: read.result }
          : rpcError(call.id, "eth_call address/calldata is not in the fixture.");
      }
      if (call.method === "eth_getCode") {
        const [address] = call.params || [];
        const read = (fixture.rpc.read?.common || []).find(
          (item) =>
            item.label === "governedWallet.getCode" && lower(item.address) === lower(address),
        );
        return read
          ? { jsonrpc: "2.0", id: call.id ?? null, result: read.result }
          : rpcError(call.id, "eth_getCode address is not in the fixture.");
      }
      if (call.method === "eth_getTransactionReceipt") {
        const [hash] = call.params || [];
        const receipt = Object.entries(fixture.rpc.transactionReceipts || {}).find(
          ([candidate]) => lower(candidate) === lower(hash),
        );
        return receipt
          ? { jsonrpc: "2.0", id: call.id ?? null, result: receipt[1] }
          : rpcError(call.id, "Receipt hash is not in the fixture.");
      }
      if (call.method === "eth_blockNumber" && !(call.params || []).length) {
        return {
          jsonrpc: "2.0",
          id: call.id ?? null,
          result: fixture.rpc.generic.eth_blockNumber,
        };
      }
      if (call.method === "eth_gasPrice" && !(call.params || []).length) {
        return { jsonrpc: "2.0", id: call.id ?? null, result: fixture.rpc.generic.eth_gasPrice };
      }
      if (call.method === "eth_getTransactionCount") {
        const [address, blockTag] = call.params || [];
        if (
          lower(address) !== lower(fixture.identities.owner) ||
          (blockTag !== undefined && !["latest", "pending"].includes(blockTag))
        ) {
          return rpcError(call.id, "Nonce lookup is allowed only for the fixture owner.");
        }
        return {
          jsonrpc: "2.0",
          id: call.id ?? null,
          result: fixture.rpc.generic.eth_getTransactionCount,
        };
      }
      if (call.method === "eth_estimateGas") {
        return exactTransaction(fixture, call.params)
          ? { jsonrpc: "2.0", id: call.id ?? null, result: fixture.rpc.generic.eth_estimateGas }
          : rpcError(call.id, "Gas estimation requires an exact fixture transaction.");
      }
      return rpcError(call.id, `${call.method} is not in the fixture.`);
    });
    return jsonResponse(Array.isArray(payload) ? results : results[0]);
  }

  async function loadFixtureBundle({
    fs,
    paths = {},
    fixture,
    providerSource,
    validReceipt,
    tamperedReceipt,
  } = {}) {
    const selected = { ...DEFAULT_PATHS, ...paths };
    const loadedFixture = fixture ?? JSON.parse(await readText(fs, selected.fixture));
    const loadedProvider = providerSource ?? (await readText(fs, selected.provider));
    const loadedValid = validReceipt ?? JSON.parse(await readText(fs, selected.validReceipt));
    const loadedTampered =
      tamperedReceipt ?? JSON.parse(await readText(fs, selected.tamperedReceipt));
    if (loadedFixture.schema !== FIXTURE_SCHEMA) {
      throw new Error(`Unexpected fixture schema: ${String(loadedFixture.schema)}`);
    }
    if (loadedValid.receipt?.issuer?.keyId !== "test-2026") {
      throw new Error("Expected the signed SDK test receipt issuer test-2026.");
    }
    if (
      loadedTampered.receipt?.amountBaseUnits !== "12500001" ||
      loadedTampered.receiptDigest !== loadedValid.receiptDigest ||
      loadedTampered.signature !== loadedValid.signature
    ) {
      throw new Error("Tampered receipt is not the stale-digest amount variant.");
    }
    const bundle = {
      fixture: loadedFixture,
      providerSource: stripCommonJsExport(loadedProvider),
      receipts: {
        valid: loadedValid,
        tampered: loadedTampered,
        trust: { issuerKeyId: "test-2026", trustedInProduction: false },
      },
      unsupported: UNSUPPORTED_FLOWS,
    };
    bundle.installFixtureHarness = (page, options = {}) =>
      installFixtureHarness(bundle, page, { ...options, fs });
    return bundle;
  }

  async function installFixtureHarness(bundle, page, options = {}) {
    const fixture = bundle.fixture;
    const fs = options.fs;
    const state = {
      mode: "owner",
      account: fixture.identities.owner,
      expiresAt: Date.now() + SESSION_TTL_MS,
      requests: [],
    };
    const providerOptions = {
      address: fixture.identities.owner,
      chainId: fixture.rpc.chainId ?? OWNER_CHAIN_ID,
      transactions: fixture.rpc.transactions,
    };
    const initScript = `
${bundle.providerSource}
(() => {
  const options = ${JSON.stringify(providerOptions)};
  let persisted = null;
  try { persisted = sessionStorage.getItem("__arcanum_fixture_account"); } catch {}
  if (/^0x[0-9a-fA-F]{40}$/.test(persisted || "")) options.address = persisted;
  installSyntheticWallet(options);
  const prints = [];
  window.print = () => prints.push({ native: false, at: Date.now() });
  window.__arcanumFixture = {
    providerInstalled: true,
    printCalls: prints,
    schema: ${JSON.stringify(FIXTURE_SCHEMA)}
  };
})();
`;
    await page.addInitScript({ content: initScript });
    await page.setDefaultTimeout(options.timeoutMs ?? 8000);

    const routeHandler = async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      let response;
      if (url.pathname === "/api/auth/session") {
        response = jsonResponse({
          user: {
            walletAddress: fixture.identities.owner,
            tenantId: fixture.identities.tenantId,
            role: "owner",
            expiresAt: state.expiresAt,
          },
        });
      } else if (url.pathname === "/api/public-stats") {
        response = jsonResponse({ capitalGovernedUsdc: 12.5 });
      } else if (url.pathname === "/api/arc-rpc") {
        response = routeRpc(fixture, state, request);
      } else if (url.pathname.startsWith("/api/trpc/")) {
        const procedures = url.pathname.slice("/api/trpc/".length).split(",").filter(Boolean);
        if (!procedures.length) {
          response = failClosed(400, "BAD_REQUEST", "Empty tRPC procedure path.");
        } else if (request.method() !== "GET") {
          response = failClosed(
            403,
            "UNSUPPORTED",
            `Notebook owner adapter does not claim mutation ${procedures.join(",")}.`,
          );
        } else {
          const rawInput = url.searchParams.get("input");
          const responses = procedures.map((procedure, index) => {
            // Public procedures are routed from the same generated envelope.
            // Inputs remain visible to the caller; unknown procedure/input pairs
            // never get a generic success.
            const input = parseInput(rawInput, index);
            const known = fixture.trpc.responses?.[procedure];
            if (
              !known ||
              (procedure === "wallets.publicProfile" &&
                input?.address?.toLowerCase() !== known.input?.address?.toLowerCase())
            ) {
              return null;
            }
            return procedureResponse(fixture, procedure);
          });
          response = responses.some((item) => !item)
            ? failClosed(418, "NOT_FOUND", "Procedure or input is not in the fixture.")
            : jsonResponse(procedures.length === 1 ? responses[0] : responses);
        }
      } else if (url.pathname.startsWith("/api/")) {
        response = failClosed(418, "NOT_FOUND", `Unknown API endpoint ${url.pathname}.`);
      } else {
        await route.continue();
        return;
      }
      state.requests.push({
        method: request.method(),
        path: url.pathname,
        status: response.status,
        blocked: response.headers?.["x-arcanum-fixture-fail-closed"] === "1",
      });
      await route.fulfill(response);
    };
    await page.route("**/*", routeHandler);

    return {
      fixture,
      receipts: bundle.receipts,
      unsupported: bundle.unsupported,
      state,
      async assertProviderInstalled() {
        return page.evaluate(() => {
          if (!window.__arcanumFixture?.providerInstalled) {
            throw new Error("Synthetic provider was not installed before navigation.");
          }
          return window.__arcanumFixture;
        });
      },
      async providerCalls() {
        return page.evaluate(() => window.__syntheticWalletAudit?.calls ?? []);
      },
      blockedRequests() {
        return state.requests.filter((request) => request.blocked);
      },
      async checkpoint(label, extra = {}) {
        const safe = String(label).replace(/[^a-zA-Z0-9._-]+/g, "-");
        const record = {
          schema: "arcanum.remediation-browser-evidence.v1",
          label,
          url: page.url(),
          mode: state.mode,
          account: state.account,
          expiresAt: state.expiresAt,
          unsupported: bundle.unsupported,
          requests: state.requests,
          ...extra,
          providerCalls: await this.providerCalls(),
        };
        const artifact = { record, screenshotPath: null, recordPath: null };
        if (fs) {
          const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
          if (
            screenshot &&
            (await writeBinary(
              fs,
              `.local/audits/arcanum-closure-2026-09-12/browser-evidence/${safe}.png`,
              screenshot,
            ))
          ) {
            artifact.screenshotPath = `.local/audits/arcanum-closure-2026-09-12/browser-evidence/${safe}.png`;
          }
          artifact.recordPath = `.local/audits/arcanum-closure-2026-09-12/browser-evidence/${safe}.json`;
          await writeText(fs, artifact.recordPath, `${JSON.stringify(record, null, 2)}\n`);
        }
        return artifact;
      },
      async close() {
        await page.unroute("**/*", routeHandler);
      },
    };
  }

  global.ArcanumClosureNotebookAdapter = Object.freeze({
    DEFAULT_PATHS,
    FIXTURE_SCHEMA,
    SESSION_TTL_MS,
    UNSUPPORTED_FLOWS,
    loadFixtureBundle,
  });
})(typeof globalThis === "undefined" ? this : globalThis);
