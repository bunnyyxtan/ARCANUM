/*
 * Safe browser adapter for the canonical Arcanum remediation fixture.
 *
 * This file is test support only. It never signs, sends, forwards, or persists
 * a real transaction. It deliberately routes only the exact fixture DTOs and
 * rejects every unknown API, RPC, mutation, signature, and transaction.
 *
 * The adapter is intentionally CommonJS so a Playwright worker can require it
 * without adding a test runner or changing the web application.
 */
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { loadBrowserReceiptFixtures } = require("./browser-receipt-fixtures.cjs");

const OWNER_CHAIN_ID = 5042002;
const FIXTURE_SCHEMA = "arcanum.remediation-browser-fixtures.v1";
const ACCOUNT_B = "0x5000000000000000000000000000000000000005";
const SESSION_TTL_MS = 604800000;
const VENDOR_MIRROR_CAP_BASE_UNITS = "12500000";
const UNKNOWN_VENDOR_ADDRESS = "0x6000000000000000000000000000000000000006";
const REMOVED_VENDOR_ADDRESS = "0x4000000000000000000000000000000000000004";
const SETTINGS_REMOVE_MAX_DELAY_MS = 2000;
const SETTINGS_REMOVE_MAX_FAILURES = 3;
const RESPONSE_HOLD_DEFAULT_TIMEOUT_MS = 8000;
const RESPONSE_HOLD_MAX_TIMEOUT_MS = 15000;
const RECEIPT_ISSUER_REGISTRY = Object.freeze([
  Object.freeze({
    keyId: "arc-testnet-2026-09",
    address: "0x768020000608ab6afc28a15b2b03a00273ef3288",
    chainId: 5042002,
    validFrom: "2026-09-10T00:00:00Z",
    retiredAt: null,
  }),
]);
const VENDOR_UI_RECIPES = Object.freeze({
  add: Object.freeze({
    label: "vendor.add",
    action: "register",
    address: "0x3000000000000000000000000000000000000003",
    // These are the fixed UI terms used by the original builder.  A browser
    // attempt with "Compute Nova" and blank notes emits a34bbaf9... instead;
    // that calldata is intentionally not accepted by this recipe.
    name: "Cloud Compute",
    category: "compute",
    categoryIndex: 1,
    capUsdc: "250",
    capBaseUnits: "250000000",
    notes: "Synthetic vendor",
    confidential: true,
    metadataPreimage:
      "arcanum-vendor:Cloud Compute:0x3000000000000000000000000000000000000003:Synthetic vendor",
    metadataHash: "0xfe973ef251cfcc23d33799789b5151b50878077520101d9a94bbf5a00164c062",
    rejectedObservedAttempt: Object.freeze({
      name: "Compute Nova",
      category: "compute",
      address: "0x3000000000000000000000000000000000000003",
      capUsdc: "250",
      notes: "",
      metadataHash: "0xa34bbaf9f4c64cf680c436a71529321bf37657f7e63cf5d80347a5dd5e18e866",
    }),
    from: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    to: "0x1000000000000000000000000000000000000001",
    hash: "0x7777777777777777777777777777777777777777777777777777777777777777",
    calldata:
      "0x13e90e7d00000000000000000000000030000000000000000000000000000000000000030000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000ee6b280fe973ef251cfcc23d33799789b5151b50878077520101d9a94bbf5a00164c062",
    recordInput: Object.freeze({
      vendorAddress: "0x3000000000000000000000000000000000000003",
      name: "Cloud Compute",
      category: "compute",
      kycStatus: "arcanevm",
    }),
  }),
  block: Object.freeze({
    label: "vendor.block",
    action: "block",
    address: "0x2000000000000000000000000000000000000002",
    name: "Compute Harbor",
    category: "compute",
    categoryIndex: 1,
    capUsdc: "12.5",
    capBaseUnits: "12500000",
    from: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    to: "0x1000000000000000000000000000000000000001",
    hash: "0x8888888888888888888888888888888888888888888888888888888888888888",
    calldata: "0x9f4508270000000000000000000000002000000000000000000000000000000000000002",
    recordInput: Object.freeze({
      vendorAddress: "0x2000000000000000000000000000000000000002",
      name: "Compute Harbor",
      category: "compute",
      kycStatus: "arcanevm",
    }),
  }),
  remove: Object.freeze({
    label: "vendor.remove",
    action: "remove",
    address: "0x2000000000000000000000000000000000000002",
    name: "Compute Harbor",
    category: "compute",
    categoryIndex: 1,
    capUsdc: "12.5",
    capBaseUnits: "12500000",
    from: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    to: "0x1000000000000000000000000000000000000001",
    hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
    calldata: "0x54b622c90000000000000000000000002000000000000000000000000000000000000002",
    recordInput: Object.freeze({
      vendorAddress: "0x2000000000000000000000000000000000000002",
      name: "Compute Harbor",
      category: "compute",
      kycStatus: "arcanevm",
    }),
  }),
  capUpdate: Object.freeze({
    label: "vendor.cap-update",
    action: "update-cap",
    address: "0x2000000000000000000000000000000000000002",
    name: "Compute Harbor",
    category: "compute",
    categoryIndex: 1,
    capUsdc: "125",
    capBaseUnits: "125000000",
    notes: "cap-update",
    metadataPreimage:
      "arcanum-vendor:Compute Harbor:0x2000000000000000000000000000000000000002:cap-update",
    metadataHash: "0x88bb5fc08c3340c1efdda1a06b0a9b78cb44dbdb0fbf27d5f4ab99e0b723fd44",
    from: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    to: "0x1000000000000000000000000000000000000001",
    hash: "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
    calldata:
      "0x13e90e7d00000000000000000000000020000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000773594088bb5fc08c3340c1efdda1a06b0a9b78cb44dbdb0fbf27d5f4ab99e0b723fd44",
    recordInput: Object.freeze({
      vendorAddress: "0x2000000000000000000000000000000000000002",
      name: "Compute Harbor",
      category: "compute",
      kycStatus: "arcanevm",
    }),
  }),
});
const SETTINGS_UI_RECIPES = Object.freeze({
  rename: Object.freeze({
    procedure: "org.update",
    input: Object.freeze({
      name: "Synthetic Treasury Workspace · Audit",
    }),
  }),
  addMember: Object.freeze({
    procedure: "org.addMember",
    input: Object.freeze({
      walletAddress: "0x4000000000000000000000000000000000000004",
      role: "approver",
    }),
  }),
  removeMember: Object.freeze({
    procedure: "org.removeMember",
    input: Object.freeze({
      walletAddress: "0x3000000000000000000000000000000000000003",
    }),
  }),
  removeCurrentOwner: Object.freeze({
    procedure: "org.removeMember",
    input: Object.freeze({
      walletAddress: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    }),
  }),
});
const SETTINGS_MUTATIONS = new Set(
  Object.values(SETTINGS_UI_RECIPES).map((recipe) => recipe.procedure),
);

const PROCEDURE_MUTATIONS_REQUIRING_TRANSACTION = new Set([
  "agents.syncSignerState",
  "escalations.recordDecision",
  "policies.recordDeployed",
  "vendors.recordOnChainState",
]);
const PROCEDURE_TRANSACTION_LABELS = {
  "agents.syncSignerState": new Set(["agentSigner.authorize", "agentSigner.revoke"]),
  "escalations.recordDecision": new Set([
    "escalation.approve",
    "escalation.approve.approver",
    "escalation.reject",
    "escalation.reject.approver",
    "escalation.cancel",
  ]),
  "policies.recordDeployed": new Set(["policy.update"]),
  "vendors.recordOnChainState": new Set([
    "vendor.add",
    "vendor.block",
    "vendor.remove",
    "vendor.cap-update",
  ]),
};
const PUBLIC_TRPC_PROCEDURES = new Set([
  "escalations.publicByKey",
  "ledger.byWallet",
  "wallets.publicProfile",
]);

function firstExisting(paths) {
  for (const candidate of paths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function defaultWorkspaceDirectory() {
  // The canonical repo is commonly run from either the workspace root or
  // arcanum/. Do not guess a deployment path or read a developer-specific
  // fixture; only these two checked-in/audit paths are accepted.
  return (
    firstExisting([
      path.resolve(process.cwd(), ".local"),
      path.resolve(process.cwd(), "..", ".local"),
      path.resolve(__dirname, "../../../../.local"),
    ])?.replace(/[\\/]\.local$/, "") ?? process.cwd()
  );
}

function defaultFixturePath() {
  return path.resolve(
    defaultWorkspaceDirectory(),
    ".local/audits/arcanum-2026-09-12/remediation-fixtures.json",
  );
}

function loadReceiptFixtures(workspaceDirectory = defaultWorkspaceDirectory()) {
  return loadBrowserReceiptFixtures(workspaceDirectory);
}

function loadFixture(fixturePath = defaultFixturePath()) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  if (fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(
      `Unexpected browser fixture schema: ${String(fixture.schema)} (expected ${FIXTURE_SCHEMA})`,
    );
  }
  return applyIndependentVendorMirror(fixture);
}

function clone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function exactObject(actual, expected) {
  if (!actual || typeof actual !== "object" || Array.isArray(actual)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key, index) => key === expectedKeys[index]) &&
    equalJsonSubset(actual, expected)
  );
}

function settingsRecipeForInput(procedure, input) {
  const candidates = Object.values(SETTINGS_UI_RECIPES).filter(
    (recipe) => recipe.procedure === procedure,
  );
  return candidates.find((recipe) => exactObject(input, recipe.input)) ?? null;
}

function boundedInteger(value, fallback, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(0, Math.floor(number)));
}

function normalizeSettingsRemovalControl(control = {}) {
  const requestedStatus = control.failureStatus ?? control.status;
  const status = [409, 500, 503].includes(Number(requestedStatus)) ? Number(requestedStatus) : 503;
  const failures = boundedInteger(
    control.failuresRemaining ?? control.failures ?? 0,
    0,
    SETTINGS_REMOVE_MAX_FAILURES,
  );
  const delayMs = boundedInteger(control.delayMs, 0, SETTINGS_REMOVE_MAX_DELAY_MS);
  const defaults = {
    409: ["CONFLICT", "Synthetic removal conflict."],
    500: ["INTERNAL_SERVER_ERROR", "Synthetic removal failure."],
    503: ["UNAVAILABLE", "Synthetic removal service unavailable."],
  };
  const [defaultCode, defaultMessage] = defaults[status];
  return {
    delayMs,
    failuresRemaining: failures,
    failureStatus: status,
    failureCode: control.failureCode ?? control.code ?? defaultCode,
    failureMessage: control.failureMessage ?? control.message ?? defaultMessage,
  };
}

function settingsMembersMeta(members, prefix = "") {
  const values = {};
  members.forEach((member, index) => {
    if (member.createdAt) values[`${prefix}${index}.createdAt`] = ["Date"];
  });
  return { values, v: 1 };
}

function settingsMutationResult(fixture, state, procedure, input) {
  if (procedure === "org.update") {
    state.organizationName = input.name;
    const response = clone(fixture.trpc.mutations?.["org.update"]);
    response.result.data.json.organization = {
      ...response.result.data.json.organization,
      name: state.organizationName,
      hasCustomName: true,
    };
    return { ok: true, response };
  }

  if (procedure === "org.addMember") {
    if (
      state.settingsMembers.some(
        (member) => lower(member.walletAddress) === lower(input.walletAddress),
      )
    ) {
      return {
        ok: false,
        response: failClosed(409, "CONFLICT", "That wallet is already a workspace member."),
      };
    }
    state.settingsMembers.push({
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      displayName: "Workspace Approver",
      walletAddress: input.walletAddress,
      role: input.role,
      createdAt: "2026-09-12T15:30:00.000Z",
    });
    return {
      ok: true,
      response: {
        result: {
          data: {
            json: { members: clone(state.settingsMembers) },
            meta: settingsMembersMeta(state.settingsMembers, "members."),
          },
        },
      },
    };
  }

  if (procedure === "org.removeMember") {
    const control = state.settingsRemoval;
    const targetIndex = state.settingsMembers.findIndex(
      (member) => lower(member.walletAddress) === lower(input.walletAddress),
    );
    if (targetIndex < 0) {
      return {
        ok: false,
        response: failClosed(404, "NOT_FOUND", "That wallet is not a workspace member."),
        delayMs: control.delayMs,
      };
    }
    const target = state.settingsMembers[targetIndex];
    const ownerCount = state.settingsMembers.filter((member) => member.role === "owner").length;
    if (target.role === "owner" && ownerCount <= 1) {
      return {
        ok: false,
        response: failClosed(400, "BAD_REQUEST", "A workspace has to keep at least one owner."),
        delayMs: control.delayMs,
      };
    }
    if (control.failuresRemaining > 0) {
      control.failuresRemaining -= 1;
      return {
        ok: false,
        response: failClosed(control.failureStatus, control.failureCode, control.failureMessage),
        delayMs: control.delayMs,
      };
    }
    state.settingsMembers.splice(targetIndex, 1);
    return {
      ok: true,
      response: {
        result: {
          data: {
            json: { members: clone(state.settingsMembers) },
            meta: settingsMembersMeta(state.settingsMembers, "members."),
          },
        },
      },
      delayMs: control.delayMs,
    };
  }

  return {
    ok: false,
    response: failClosed(418, "NOT_FOUND", `Unknown settings fixture ${procedure}.`),
  };
}

/**
 * Keep the browser mirror independent from the Supabase mapper. These values
 * are the closure oracle: the known vendor has a 12.5 USDC cap, a separate
 * allowed vendor has no observed cap, and a removed vendor remains in history.
 */
function assertVendorTransactionRecipes(fixture) {
  for (const recipe of Object.values(VENDOR_UI_RECIPES)) {
    const transaction = fixture.rpc.transactions?.find(
      (candidate) => candidate.label === recipe.label,
    );
    if (
      !transaction ||
      lower(transaction.hash) !== lower(recipe.hash) ||
      lower(transaction.from) !== lower(recipe.from) ||
      lower(transaction.to) !== lower(recipe.to) ||
      lower(transaction.data) !== lower(recipe.calldata)
    ) {
      throw new Error(`Vendor fixture transaction no longer matches ${recipe.label}.`);
    }
    if (
      recipe.metadataHash &&
      !lower(transaction.data).endsWith(lower(recipe.metadataHash).replace(/^0x/, ""))
    ) {
      throw new Error(`Vendor fixture metadata hash no longer matches ${recipe.label}.`);
    }
  }
}

function applyIndependentVendorMirror(fixture) {
  const result = clone(fixture);
  assertVendorTransactionRecipes(result);
  const issuerResponse = result.trpc.responses?.["receipts.issuers"]?.response;
  if (!issuerResponse?.result?.data) {
    throw new Error("Receipt issuer fixture response is missing its tRPC envelope.");
  }
  issuerResponse.result.data.json = clone(RECEIPT_ISSUER_REGISTRY);
  const response = result.trpc.responses?.["vendors.list"]?.response;
  const rows = response?.result?.data?.json;
  if (!Array.isArray(rows)) {
    throw new Error("Vendor fixture response is missing its DTO array.");
  }
  const existing = rows.find((row) => lower(row.address) === lower(result.identities.vendor));
  if (!existing) throw new Error("Known vendor is missing from the fixture.");
  const overlayAddresses = new Set([lower(UNKNOWN_VENDOR_ADDRESS), lower(REMOVED_VENDOR_ADDRESS)]);
  const retainedRows = rows.filter((row) => !overlayAddresses.has(lower(row.address)));
  rows.splice(0, rows.length, ...retainedRows);
  const tenantId = result.identities.tenantId;
  const walletId = result.identities.walletId;
  const owner = result.identities.owner;
  existing.perVendorCap = VENDOR_MIRROR_CAP_BASE_UNITS;
  existing.kycStatus = "arcanevm";
  rows.push(
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      tenantId,
      walletId,
      address: UNKNOWN_VENDOR_ADDRESS,
      category: "compute",
      status: "allowed",
      perVendorCap: null,
      metadataHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      addedAt: "2026-09-02T12:00:00.000Z",
      addedBy: owner,
      name: "Unpriced Compute Vendor",
      kycStatus: "public",
      walletAddress: result.identities.governedWallet,
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      tenantId,
      walletId,
      address: REMOVED_VENDOR_ADDRESS,
      category: "subcontracting",
      status: "removed",
      perVendorCap: null,
      metadataHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      addedAt: "2026-09-03T12:00:00.000Z",
      addedBy: owner,
      name: "Removed Subcontractor",
      kycStatus: "public",
      walletAddress: result.identities.governedWallet,
    },
  );
  return result;
}

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-arcanum-fixture-mode": "isolated-simulation",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function trpcErrorCode(status) {
  switch (status) {
    case 400:
      return -32600;
    case 401:
      return -32001;
    case 403:
      return -32003;
    case 404:
      return -32004;
    case 409:
      return -32009;
    case 418:
      return -32004;
    case 503:
      return -32008;
    case 500:
      return -32603;
    default:
      return -32000;
  }
}

function failClosed(status, code, message) {
  return jsonResponse(
    {
      error: {
        json: {
          message: `SYNTHETIC_FIXTURE_BLOCKED: ${message}`,
          code: trpcErrorCode(status),
          data: { code, httpStatus: status },
        },
      },
    },
    status,
    { "x-arcanum-fixture-fail-closed": "1" },
  );
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

function equalJsonSubset(actual, expected) {
  if (expected === null || expected === undefined) return true;
  if (typeof expected !== "object" || expected === null) return actual === expected;
  if (typeof actual !== "object" || actual === null) return false;
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      expected.length === actual.length &&
      expected.every((item, index) => equalJsonSubset(actual[index], item))
    );
  }
  return Object.entries(expected).every(([key, value]) => equalJsonSubset(actual[key], value));
}

function parseTrpcInput(rawInput, index = 0) {
  if (!rawInput) return null;
  let decoded;
  try {
    decoded = typeof rawInput === "string" ? JSON.parse(rawInput) : rawInput;
  } catch {
    return null;
  }
  const selected = Array.isArray(decoded) ? decoded[index] : (decoded?.[String(index)] ?? decoded);
  return selected?.json ?? selected ?? null;
}

function pathnameAfter(pathname, prefix) {
  const index = pathname.indexOf(prefix);
  return index === -1 ? null : pathname.slice(index + prefix.length).split("?")[0];
}

function accountForRole(fixture, role) {
  if (role === "viewer") return fixture.identities.viewer;
  if (role === "unrelated") return ACCOUNT_B;
  if (role === "approver") {
    const approver = fixture.identities?.approver;
    if (
      fixture.approverExpiryAddon?.schema &&
      /^0x[0-9a-fA-F]{40}$/.test(approver || "") &&
      lower(approver) !== lower(fixture.identities.owner) &&
      lower(approver) !== lower(fixture.identities.viewer)
    ) {
      return approver;
    }
    throw new Error(
      "Distinct non-owner approver fixture is not installed; use the approver scenario addon.",
    );
  }
  return fixture.identities.owner;
}

function roleForMode(fixture, mode) {
  if (mode === "viewer") return "viewer";
  if (mode === "approver") {
    accountForRole(fixture, mode);
    const role =
      fixture.approverExpiryAddon?.identity?.organizationRole ??
      fixture.approverExpiryAddon?.identity?.sessionRole ??
      "operator";
    if (role === "owner") {
      throw new Error("Approver fixture identity cannot use the owner organization role.");
    }
    return role;
  }
  return "owner";
}

function sessionForMode(fixture, mode) {
  const expiresAt = Math.trunc(Date.now() + SESSION_TTL_MS);
  const user = (walletAddress, role) => ({
    walletAddress,
    tenantId: fixture.identities.tenantId,
    role,
    expiresAt,
  });
  switch (mode) {
    case "owner":
      return { user: user(fixture.identities.owner, "owner") };
    case "approver":
      return { user: user(accountForRole(fixture, mode), roleForMode(fixture, mode)) };
    case "viewer":
      return { user: user(fixture.identities.viewer, "viewer") };
    case "unrelated":
      return { user: user(ACCOUNT_B, "viewer") };
    case "mismatch":
      return { user: user(fixture.identities.owner, "owner") };
    case "unsigned":
    case "anonymous":
    case "expired":
      return { user: null };
    default:
      throw new Error(`Unknown fixture session mode: ${mode}`);
  }
}

function exactTransaction(fixture, request) {
  const tx = request?.params?.[0];
  if (!tx || typeof tx !== "object") return null;
  if (Object.keys(tx).some((key) => !["from", "to", "data", "value"].includes(key))) {
    return null;
  }
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

function allRpcReads(fixture) {
  const approver = fixture.rpc.read?.approver ?? {};
  return [
    ...(fixture.rpc.read?.common ?? []),
    approver.initial,
    approver.settled?.approve,
    approver.settled?.reject,
    approver.settled?.cancel,
    approver.isRequiredSignerOwner,
    approver.isRequiredSignerViewer,
    approver.isRequiredSignerApprover,
    approver.signedFalse,
    approver.signedFalseViewer,
    approver.signedFalseApprover,
  ].filter(Boolean);
}

function governanceMetadata(fixture) {
  const metadata = fixture?.governanceOffline;
  return metadata && typeof metadata === "object" && metadata.schema ? metadata : null;
}

function governanceDefinitions(fixture) {
  const metadata = governanceMetadata(fixture);
  if (!metadata) return [];
  const policy = metadata.policy;
  const definitions = [
    {
      action: "policy",
      metadata: policy,
      label: policy?.transactionLabel,
      hash: policy?.transactionHash,
      expectedPostReads: policy?.expectedPostRead ? [policy.expectedPostRead] : [],
    },
    {
      action: "signerAuthorize",
      metadata: metadata.signer?.authorize,
      label: metadata.signer?.authorize?.transaction?.label,
      hash: metadata.signer?.authorize?.transaction?.hash,
      expectedPostReads: metadata.signer?.authorize?.expectedPostRead
        ? [metadata.signer.authorize.expectedPostRead]
        : [],
    },
    {
      action: "signerRevoke",
      metadata: metadata.signer?.revoke,
      label: metadata.signer?.revoke?.transaction?.label,
      hash: metadata.signer?.revoke?.transaction?.hash,
      expectedPostReads: metadata.signer?.revoke?.expectedPostRead
        ? [metadata.signer.revoke.expectedPostRead]
        : [],
    },
    {
      action: "pause",
      metadata: metadata.pause,
      label: metadata.pause?.transaction?.label,
      hash: metadata.pause?.transaction?.hash,
      expectedPostReads: metadata.pause?.expectedPostRead ? [metadata.pause.expectedPostRead] : [],
    },
    {
      action: "unpause",
      metadata: metadata.unpause,
      label: metadata.unpause?.transaction?.label,
      hash: metadata.unpause?.transaction?.hash,
      expectedPostReads: metadata.unpause?.expectedPostRead
        ? [metadata.unpause.expectedPostRead]
        : [],
    },
    {
      action: "deploy",
      metadata: metadata.deploy,
      label: metadata.deploy?.transaction?.label,
      hash: metadata.deploy?.transaction?.hash,
      expectedPostReads: metadata.deploy?.expectedPostReads
        ? Object.values(metadata.deploy.expectedPostReads)
        : [],
    },
  ];
  return definitions.filter((definition) => definition.metadata && definition.hash);
}

function transactionFieldsMatch(actual, expected) {
  return Boolean(
    actual &&
      expected &&
      lower(actual.from) === lower(expected.from) &&
      lower(actual.to) === lower(expected.to) &&
      lower(actual.data) === lower(expected.data) &&
      lower(actual.value || "0x0") === lower(expected.value || "0x0"),
  );
}

function governanceTransaction(fixture, definition) {
  const transaction = fixture.rpc?.transactions?.find(
    (candidate) =>
      lower(candidate.hash) === lower(definition.hash) && candidate.label === definition.label,
  );
  const expected = definition.metadata?.transaction;
  return transaction && (!expected || transactionFieldsMatch(transaction, expected))
    ? transaction
    : null;
}

function governanceTransactionForHash(fixture, hash) {
  return governanceDefinitions(fixture).find(
    (definition) =>
      lower(definition.hash) === lower(hash) && governanceTransaction(fixture, definition),
  );
}

function policyMirrorInputMatches(actual, expected) {
  if (!actual || typeof actual !== "object" || !expected || typeof expected !== "object") {
    return false;
  }
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    return false;
  }
  for (const key of expectedKeys) {
    if (key === "allowedCategories") continue;
    if (JSON.stringify(actual[key]) !== JSON.stringify(expected[key])) return false;
  }
  const expectedCategories = expected.allowedCategories;
  const actualCategories = actual.allowedCategories;
  if (!Array.isArray(expectedCategories) || !Array.isArray(actualCategories)) return false;
  const knownCategories = new Set(["api", "compute", "data", "subcontracting", "other"]);
  const expectedSet = new Set(expectedCategories);
  const actualSet = new Set(actualCategories);
  return (
    expectedCategories.length === expectedSet.size &&
    actualCategories.length === actualSet.size &&
    expectedCategories.every((category) => knownCategories.has(category)) &&
    actualCategories.every((category) => knownCategories.has(category)) &&
    expectedSet.size === actualSet.size &&
    [...expectedSet].every((category) => actualSet.has(category))
  );
}

function deploymentReceiptProofMatches(definition, receipt) {
  if (definition.action !== "deploy") return true;
  const expectedLog = definition.metadata?.receipt?.logs?.[0];
  const actualLog = receipt?.logs?.find(
    (candidate) =>
      expectedLog &&
      lower(candidate.address) === lower(expectedLog.address) &&
      lower(candidate.data) === lower(expectedLog.data) &&
      JSON.stringify(candidate.topics || []) === JSON.stringify(expectedLog.topics || []),
  );
  return Boolean(
    expectedLog &&
      actualLog &&
      lower(actualLog.transactionHash) === lower(receipt.transactionHash) &&
      equalJsonSubset(actualLog, expectedLog),
  );
}

function governanceReceiptSucceeded(fixture, definition, receipt) {
  const transaction = governanceTransaction(fixture, definition);
  return Boolean(
    transaction &&
      receipt &&
      receipt.status === "0x1" &&
      lower(receipt.transactionHash) === lower(transaction.hash) &&
      lower(receipt.from) === lower(transaction.from) &&
      lower(receipt.to) === lower(transaction.to) &&
      deploymentReceiptProofMatches(definition, receipt),
  );
}

function governanceMirrorCandidate(fixture, procedure, input) {
  const metadata = governanceMetadata(fixture);
  if (!metadata) return null;
  if (procedure === "policies.recordDeployed") {
    const expectedInput = metadata.policy?.mirrorInput;
    return {
      action: "policy",
      definition: governanceDefinitions(fixture).find((item) => item.action === "policy"),
      expectedInput,
      envelope: metadata.policy?.expectedMirrorEnvelope,
      invalid: !policyMirrorInputMatches(input, expectedInput),
    };
  }
  if (procedure === "agents.syncSignerState") {
    for (const action of ["authorize", "revoke"]) {
      const item = metadata.signer?.[action];
      if (exactObject(input, item?.input)) {
        return {
          action: action === "authorize" ? "signerAuthorize" : "signerRevoke",
          definition: governanceDefinitions(fixture).find(
            (candidate) =>
              candidate.action === (action === "authorize" ? "signerAuthorize" : "signerRevoke"),
          ),
          expectedInput: item.input,
          envelope: item.expectedMirrorEnvelope,
        };
      }
    }
    return {
      invalid: true,
      message: "Signer mirror input does not match an exact authorize/revoke recipe.",
    };
  }
  if (procedure === "agents.syncSignerStateAuthorize") {
    const item = metadata.signer?.authorize;
    return {
      action: "signerAuthorize",
      definition: governanceDefinitions(fixture).find(
        (candidate) => candidate.action === "signerAuthorize",
      ),
      expectedInput: item?.input,
      envelope: item?.expectedMirrorEnvelope,
      invalid: !exactObject(input, item?.input),
    };
  }
  if (procedure === "agents.syncSignerStateRevoke") {
    const item = metadata.signer?.revoke;
    return {
      action: "signerRevoke",
      definition: governanceDefinitions(fixture).find(
        (candidate) => candidate.action === "signerRevoke",
      ),
      expectedInput: item?.input,
      envelope: item?.expectedMirrorEnvelope,
      invalid: !exactObject(input, item?.input),
    };
  }
  if (procedure === "anomalies.acknowledge") {
    return {
      action: "pause",
      definition: governanceDefinitions(fixture).find((item) => item.action === "pause"),
      expectedInput: metadata.pause?.mirrorInput,
      envelope: metadata.pause?.expectedMirrorEnvelope,
      invalid: !exactObject(input, metadata.pause?.mirrorInput),
    };
  }
  if (procedure === "agents.recordCreatedWallet") {
    return {
      action: "deploy",
      definition: governanceDefinitions(fixture).find((item) => item.action === "deploy"),
      expectedInput: metadata.deploy?.mirrorInput,
      envelope: metadata.deploy?.expectedMirrorEnvelope,
      invalid: !exactObject(input, metadata.deploy?.mirrorInput),
    };
  }
  return null;
}

function isGovernanceMirrorProcedure(procedure) {
  return new Set([
    "policies.recordDeployed",
    "agents.syncSignerState",
    "agents.syncSignerStateAuthorize",
    "agents.syncSignerStateRevoke",
    "anomalies.acknowledge",
    "agents.recordCreatedWallet",
  ]).has(procedure);
}

function governancePostReadKey(action, read) {
  return `${action}:${read?.label ?? ""}`;
}

function governanceReadOverride(fixture, state, to, data, from) {
  const governance = state.governance;
  if (!governance) return null;
  const definitions = governanceDefinitions(fixture);
  for (const action of [...governance.receiptActions].reverse()) {
    const definition = definitions.find((item) => item.action === action);
    const read = definition?.expectedPostReads?.find(
      (candidate) =>
        lower(candidate.address) === lower(to) &&
        lower(candidate.data) === lower(data) &&
        lower(candidate.from) === lower(from),
    );
    if (read) {
      governance.postReads.add(governancePostReadKey(action, read));
      return read;
    }
  }
  return null;
}

function governanceHasPostReads(state, definition) {
  return Boolean(
    definition?.expectedPostReads?.length &&
      definition.expectedPostReads.every((read) =>
        state.governance.postReads.has(governancePostReadKey(definition.action, read)),
      ),
  );
}

function activateGovernanceReceipt(fixture, state, hash, receipt) {
  const definition = governanceTransactionForHash(fixture, hash);
  if (!definition) return null;
  if (!governanceReceiptSucceeded(fixture, definition, receipt)) return false;
  if (!state.governance) return false;
  if (!state.governance.receiptActions.includes(definition.action)) {
    state.governance.receiptActions.push(definition.action);
  }
  return definition.action;
}

function matchRpcRead(fixture, request, state) {
  const params = request.params || [];
  if (request.method === "eth_call") {
    const target = params[0] || {};
    if (
      params.length > 2 ||
      (params[1] !== undefined && params[1] !== "latest") ||
      Object.keys(target).some((key) => !["to", "data", "from"].includes(key))
    ) {
      return null;
    }
    const to = lower(target.to);
    const data = lower(target.data);
    const governanceRead = governanceReadOverride(fixture, state, to, data, target.from);
    if (governanceRead) return governanceRead;
    const reads = allRpcReads(fixture);
    const candidateReads = reads.filter(
      (item) =>
        lower(item.address) === to &&
        lower(item.data) === data &&
        lower(item.from) === lower(target.from),
    );
    if (candidateReads.length === 0) return null;
    const approverReads = fixture.rpc.read?.approver;
    if (
      approverReads &&
      lower(candidateReads[0].data) === lower(approverReads.initial.data) &&
      state.settledAction
    ) {
      return approverReads.settled?.[state.settledAction] ?? candidateReads[0];
    }
    return candidateReads[0];
  }
  if (request.method === "eth_getCode") {
    if (params.length > 2 || (params[1] !== undefined && params[1] !== "latest")) return null;
    const address = lower(params[0]);
    const known = (fixture.rpc.read?.common ?? []).find(
      (item) => item.label === "governedWallet.getCode" && lower(item.address) === address,
    );
    return known ? { result: known.result } : null;
  }
  if (request.method === "eth_getTransactionReceipt") {
    if (params.length !== 1) return null;
    const hash = lower(params[0]);
    const receipt = Object.entries(fixture.rpc.transactionReceipts || {}).find(
      ([candidateHash]) => lower(candidateHash) === hash,
    );
    return receipt ? { result: receipt[1] } : null;
  }
  return null;
}

function knownTrpcProcedure(fixture, procedure) {
  return Boolean(
    SETTINGS_MUTATIONS.has(procedure) ||
      fixture.trpc.responses?.[procedure] ||
      fixture.trpc.mutations?.[procedure] ||
      fixture.trpc.contexts?.owner?.[procedure] ||
      fixture.trpc.contexts?.viewer?.[procedure] ||
      fixture.trpc.contexts?.approver?.[procedure],
  );
}

function governanceMirrorJson(fixture, state, action) {
  const metadata = governanceMetadata(fixture);
  if (!metadata || !state.governance?.mirroredActions.has(action)) return null;
  const definition = governanceDefinitions(fixture).find((item) => item.action === action);
  return definition?.metadata?.expectedMirrorEnvelope?.result?.data?.json ?? null;
}

function latestGovernanceSignerJson(fixture, state) {
  for (const action of [...(state.governance?.mirroredOrder ?? [])].reverse()) {
    if (action !== "signerAuthorize" && action !== "signerRevoke") continue;
    return governanceMirrorJson(fixture, state, action);
  }
  return null;
}

function applyGovernanceQueryState(fixture, state, procedure, response) {
  const json = response?.result?.data?.json;
  if (json === undefined) return;
  const definitions = governanceDefinitions(fixture);
  const policyDefinition = definitions.find((item) => item.action === "policy");
  const policyMetadata = policyDefinition?.metadata;
  const policyMirror = governanceMirrorJson(fixture, state, "policy");
  const policyReceipt = state.governance?.receiptActions.includes("policy");
  const signerMirror = latestGovernanceSignerJson(fixture, state);
  const deploymentMirror = governanceMirrorJson(fixture, state, "deploy");
  const pauseMirror = state.governance?.mirroredActions.has("pause");

  if (procedure === "policies.readOnChain" && policyReceipt && policyMetadata) {
    const policy = policyMetadata.expectedStateAfterReceipt?.policy;
    if (policy && json && typeof json === "object") {
      response.result.data.json = {
        ...json,
        policy: clone(policy),
      };
    }
  }
  if (procedure === "policies.get" && policyMirror) {
    response.result.data.json = clone(policyMirror);
    const meta = policyDefinition?.metadata?.expectedMirrorEnvelope?.result?.data?.meta;
    if (meta !== undefined) response.result.data.meta = clone(meta);
  }
  if (procedure === "agents.list" && json && typeof json === "object") {
    if (deploymentMirror?.agent) {
      response.result.data.json = {
        ...json,
        agents: [clone(deploymentMirror.agent)],
      };
    } else {
      const sourceAgents = Array.isArray(json.agents) ? json.agents : [];
      const policy = policyMirror;
      const signers = signerMirror?.signers;
      let agents = sourceAgents.map((agent) => {
        const next = { ...agent };
        if (policy) {
          next.perTxCap = policy.perTxCap;
          next.daily24hCap = policy.daily24hCap;
          next.monthlyCap = policy.monthlyCap;
          next.escalationThreshold = policy.escalationThreshold;
          next.policyVersion = policy.version;
        }
        return next;
      });
      if (Array.isArray(signers)) {
        const template = agents[0] ?? sourceAgents[0];
        agents = template ? signers.map((signer) => ({ ...template, signerAddress: signer })) : [];
      }
      response.result.data.json = { ...json, agents };
    }
  }
  if (procedure === "wallets.list" && Array.isArray(json)) {
    if (deploymentMirror?.wallet) {
      response.result.data.json = [clone(deploymentMirror.wallet)];
    } else if (policyMirror || pauseMirror) {
      response.result.data.json = json.map((wallet) => ({
        ...wallet,
        ...(policyMirror ? { policyVersion: policyMirror.version } : {}),
        ...(pauseMirror ? { frozen: true } : {}),
      }));
    }
  }
}

function changedTrpcResponse(fixture, procedure, state) {
  let response =
    state.role === "viewer" && fixture.trpc.contexts?.viewer?.[procedure]
      ? fixture.trpc.contexts.viewer[procedure]
      : state.role === "operator" && fixture.trpc.contexts?.approver?.[procedure]
        ? fixture.trpc.contexts.approver[procedure]
        : fixture.trpc.responses?.[procedure]?.response;
  if (!response) return null;
  response = clone(response);
  const json = response?.result?.data?.json;
  if (
    (procedure === "org.getCurrent" || procedure === "org.currentOrg") &&
    json &&
    state.organizationName
  ) {
    response.result.data.json = {
      ...json,
      name: state.organizationName,
      hasCustomName: true,
    };
  }
  if (
    (procedure === "org.listMembers" || procedure === "org.members") &&
    Array.isArray(state.settingsMembers)
  ) {
    response.result.data.json = clone(state.settingsMembers);
    response.result.data.meta = settingsMembersMeta(state.settingsMembers);
  }
  const selectedAction = state.settledAction;
  if (procedure === "escalations.list" && selectedAction && Array.isArray(json)) {
    const statusByAction = {
      approve: "DENIED",
      reject: "REJECTED",
      cancel: "CANCELLED",
      sweep: "EXPIRED",
    };
    const nextStatus = statusByAction[selectedAction];
    response.result.data.json = json.map((item) =>
      item.id?.toLowerCase() === fixture.identities.escalationId.toLowerCase()
        ? {
            ...item,
            status: nextStatus,
            signaturesCount: nextStatus === "DENIED" ? 2 : item.signaturesCount,
            executedTxHash: null,
          }
        : item,
    );
  }
  if (procedure === "escalations.publicByKey" && selectedAction && json) {
    const statusByAction = {
      approve: "DENIED",
      reject: "REJECTED",
      cancel: "CANCELLED",
      sweep: "EXPIRED",
    };
    response.result.data.json = {
      ...json,
      status: statusByAction[selectedAction],
      signatureCount: selectedAction === "approve" ? 2 : json.signatureCount,
    };
  }
  if (procedure === "anomalies.list" && state.dismissedAnomaly) {
    response.result.data.json = [];
  }
  if (procedure === "vendorFlags.list" && state.unflaggedVendor) {
    response.result.data.json = [];
  }
  if (procedure === "vendors.list" && state.vendorAction) {
    const action = state.vendorAction.label;
    const vendorAddress = lower(state.vendorAction.vendorAddress);
    const update = (row) => {
      if (lower(row.address) !== vendorAddress) return row;
      if (action === "vendor.add") {
        return {
          ...row,
          status: "allowed",
          perVendorCap: "250000000",
          kycStatus: "arcanevm",
        };
      }
      if (action === "vendor.cap-update") {
        return {
          ...row,
          status: "allowed",
          perVendorCap: "125000000",
          kycStatus: "arcanevm",
        };
      }
      if (action === "vendor.block") {
        return { ...row, status: "blocked" };
      }
      if (action === "vendor.remove") {
        return { ...row, status: "removed", perVendorCap: null };
      }
      return row;
    };
    const sourceRows = Array.isArray(state.vendorRows) ? state.vendorRows : json;
    const updatedRows = sourceRows.map(update);
    if (
      action === "vendor.add" &&
      !updatedRows.some((row) => lower(row.address) === vendorAddress)
    ) {
      updatedRows.push(state.vendorAction.row);
    }
    state.vendorRows = updatedRows;
    response.result.data.json = updatedRows;
  }
  applyGovernanceQueryState(fixture, state, procedure, response);
  return response;
}

function mutationKey(procedure, input) {
  return `${procedure}:${JSON.stringify(input ?? null)}`;
}

function hasSyntheticReceiptForProcedure(fixture, state, procedure, input) {
  const requestedHash = input?.txHash;
  const labels = PROCEDURE_TRANSACTION_LABELS[procedure] ?? new Set();
  if (procedure === "vendors.recordOnChainState") {
    if (requestedHash) {
      const hash = lower(requestedHash);
      const transaction = fixture.rpc.transactions.find((item) => lower(item.hash) === hash);
      return Boolean(
        transaction &&
          labels.has(transaction.label) &&
          state.acceptedTransactions.has(hash) &&
          !state.consumedTransactions.has(hash),
      );
    }
    return Boolean(acceptedVendorTransaction(fixture, state));
  }
  if (requestedHash) {
    const hash = lower(requestedHash);
    const transaction = fixture.rpc.transactions.find((item) => lower(item.hash) === hash);
    return Boolean(
      transaction && labels.has(transaction.label) && state.acceptedTransactions.has(hash),
    );
  }
  return fixture.rpc.transactions.some(
    (item) => labels.has(item.label) && state.acceptedTransactions.has(lower(item.hash)),
  );
}

function acceptedVendorTransaction(fixture, state) {
  const labels = PROCEDURE_TRANSACTION_LABELS["vendors.recordOnChainState"];
  for (const hash of [...state.acceptedTransactions].reverse()) {
    if (state.consumedTransactions.has(hash)) continue;
    const transaction = fixture.rpc.transactions.find((item) => lower(item.hash) === hash);
    if (transaction && labels.has(transaction.label)) return transaction;
  }
  return null;
}

function vendorRecipeForTransaction(transaction) {
  return Object.values(VENDOR_UI_RECIPES).find((recipe) => recipe.label === transaction?.label);
}

function expectedVendorRecordInput(fixture, recipe) {
  return {
    walletAddress: fixture.identities.governedWallet,
    ...recipe.recordInput,
  };
}

function exactVendorRecordInput(fixture, recipe, input) {
  const expected = expectedVendorRecordInput(fixture, recipe);
  if (!input || typeof input !== "object") return false;
  const expectedKeys = Object.keys(expected).sort();
  const actualKeys = Object.keys(input).sort();
  return (
    expectedKeys.length === actualKeys.length &&
    expectedKeys.every((key, index) => key === actualKeys[index]) &&
    equalJsonSubset(input, expected)
  );
}

function vendorRowForMutation(fixture, recipe, input, state) {
  const list =
    state.vendorRows ??
    fixture.trpc.responses?.["vendors.list"]?.response?.result?.data?.json ??
    [];
  const existing = list.find((row) => lower(row.address) === lower(input.vendorAddress));
  const base = existing ?? {
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    tenantId: fixture.identities.tenantId,
    walletId: fixture.identities.walletId,
    address: input.vendorAddress,
    category: input.category,
    metadataHash: recipe.metadataHash ?? null,
    addedAt: "2026-09-12T10:00:00.000Z",
    addedBy: fixture.identities.owner,
    name: input.name,
    walletAddress: fixture.identities.governedWallet,
  };
  const status =
    recipe.action === "block" ? "blocked" : recipe.action === "remove" ? "removed" : "allowed";
  const cap =
    recipe.action === "remove"
      ? null
      : recipe.action === "update-cap"
        ? "125000000"
        : recipe.action === "register"
          ? "250000000"
          : base.perVendorCap;
  return {
    ...base,
    address: input.vendorAddress,
    category: input.category,
    name: input.name,
    status,
    perVendorCap: cap,
    kycStatus: input.kycStatus,
    walletAddress: fixture.identities.governedWallet,
  };
}

function vendorMutationResponse(fixture, recipe, input, state) {
  const row = vendorRowForMutation(fixture, recipe, input, state);
  return {
    result: {
      data: {
        json: {
          id: row.id,
          address: row.address,
          category: row.category,
          status: row.status,
          perVendorCap: row.perVendorCap,
          name: row.name,
          walletAddress: row.walletAddress,
        },
        // Match the checked-in superjson envelope, including meta even when
        // the returned DTO has no non-JSON values.  This is also valid for a
        // one-item tRPC batch response.
        meta: {},
      },
    },
  };
}

function escalationMutationResponse(fixture, state) {
  const response = clone(fixture.trpc.mutations["escalations.recordDecision"]);
  const action = state.settledAction;
  const labelsByAction = {
    approve: new Set(["escalation.approve", "escalation.approve.approver"]),
    reject: new Set(["escalation.reject", "escalation.reject.approver"]),
    cancel: new Set(["escalation.cancel"]),
  };
  const labels = labelsByAction[action];
  const transaction = labels
    ? fixture.rpc.transactions.find(
        (item) => labels.has(item.label) && state.acceptedTransactions.has(lower(item.hash)),
      )
    : null;
  const json = response?.result?.data?.json;
  if (json && transaction) {
    json.txHash = transaction.hash;
    json.status =
      action === "approve" ? "released" : action === "cancel" ? "cancelled" : "rejected";
    json.approvalsCount = action === "approve" ? 2 : 1;
  }
  return response;
}

function routeTrpc(fixture, state, request, procedureNames) {
  const inputs = procedureNames.map((_, index) => {
    const url = new URL(request.url());
    return parseTrpcInput(url.searchParams.get("input"), index);
  });
  if (request.method() !== "GET") {
    let body = null;
    try {
      body = JSON.parse(request.postData() || "null");
    } catch {
      return failClosed(400, "BAD_REQUEST", "tRPC body is not JSON.");
    }
    inputs.splice(
      0,
      inputs.length,
      ...procedureNames.map((_, index) => parseTrpcInput(body, index)),
    );
  }

  const isMutation = request.method() !== "GET";
  const responses = [];
  let routeDelayMs = 0;
  for (let index = 0; index < procedureNames.length; index += 1) {
    const procedure = procedureNames[index];
    const input = inputs[index];
    if (!knownTrpcProcedure(fixture, procedure)) {
      return failClosed(418, "NOT_FOUND", `Unknown tRPC procedure ${procedure}.`);
    }
    if (
      state.mode === "approver" &&
      !new Set([
        "escalations.list",
        "escalations.publicByKey",
        "escalations.recordDecision",
        "org.currentOrg",
        "org.getCurrent",
      ]).has(procedure)
    ) {
      return failClosed(403, "FORBIDDEN", `${procedure} is unavailable for the approver identity.`);
    }
    if (isMutation) {
      if (state.mode !== "owner" && state.mode !== "approver") {
        return failClosed(403, "FORBIDDEN", `${procedure} is unavailable for this identity.`);
      }
      if (state.mode === "approver" && procedure !== "escalations.recordDecision") {
        return failClosed(
          403,
          "FORBIDDEN",
          `${procedure} is unavailable for the approver identity.`,
        );
      }
      const settingsRecipe = SETTINGS_MUTATIONS.has(procedure)
        ? settingsRecipeForInput(procedure, input)
        : null;
      if (SETTINGS_MUTATIONS.has(procedure) && !settingsRecipe) {
        return failClosed(400, "BAD_REQUEST", `Input mismatch for ${procedure}.`);
      }
      const expected = fixture.trpc.responses?.[procedure]?.input;
      if (expected && !equalJsonSubset(input, expected)) {
        return failClosed(400, "BAD_REQUEST", `Input mismatch for ${procedure}.`);
      }
      const governanceMirror =
        governanceMetadata(fixture) && isGovernanceMirrorProcedure(procedure)
          ? governanceMirrorCandidate(fixture, procedure, input)
          : null;
      if (governanceMirror?.invalid) {
        return failClosed(
          400,
          "BAD_REQUEST",
          governanceMirror.message ?? `Input mismatch for ${procedure}.`,
        );
      }
      if (governanceMirror) {
        if (!governanceMirror.definition || !governanceMirror.envelope) {
          return failClosed(
            409,
            "PRECONDITION_FAILED",
            `${procedure} has no complete governance fixture route.`,
          );
        }
        if (!state.governance.receiptActions.includes(governanceMirror.action)) {
          return failClosed(
            409,
            "PRECONDITION_FAILED",
            `${procedure} requires the exact successful governance receipt first.`,
          );
        }
        if (!governanceHasPostReads(state, governanceMirror.definition)) {
          return failClosed(
            409,
            "PRECONDITION_FAILED",
            `${procedure} requires the exact governance post-read first.`,
          );
        }
      }
      let key = mutationKey(procedure, input);
      if (procedure !== "vendors.recordOnChainState" && state.mutationKeys.has(key)) {
        return failClosed(409, "CONFLICT", `${procedure} already succeeded in this fixture.`);
      }
      if (
        governanceMirror?.action &&
        state.governance.mirroredActions.has(governanceMirror.action)
      ) {
        return failClosed(409, "CONFLICT", `${procedure} already succeeded in this fixture.`);
      }
      if (PROCEDURE_MUTATIONS_REQUIRING_TRANSACTION.has(procedure)) {
        const hasReceipt = hasSyntheticReceiptForProcedure(fixture, state, procedure, input);
        if (!hasReceipt) {
          return failClosed(
            409,
            "PRECONDITION_FAILED",
            `${procedure} requires the exact synthetic transaction receipt first.`,
          );
        }
      }
      let vendorRecipe = null;
      let vendorTransaction = null;
      if (procedure === "vendors.recordOnChainState") {
        vendorTransaction = acceptedVendorTransaction(fixture, state);
        vendorRecipe = vendorRecipeForTransaction(vendorTransaction);
        if (
          !vendorTransaction ||
          !vendorRecipe ||
          !exactVendorRecordInput(fixture, vendorRecipe, input)
        ) {
          return failClosed(
            400,
            "BAD_REQUEST",
            "Vendor state input does not exactly match the accepted fixture transaction recipe.",
          );
        }
      }
      if (procedure === "vendors.recordOnChainState") {
        key = mutationKey(procedure, {
          ...input,
          fixtureTransactionLabel: vendorTransaction.label,
        });
        if (state.mutationKeys.has(key)) {
          return failClosed(409, "CONFLICT", `${procedure} already succeeded in this fixture.`);
        }
      }
      if (settingsRecipe) {
        const result = settingsMutationResult(fixture, state, procedure, input);
        if (!result.ok) {
          const response = result.response;
          if (result.delayMs) response.delayMs = result.delayMs;
          return response;
        }
        state.mutationKeys.add(key);
        routeDelayMs = Math.max(routeDelayMs, result.delayMs ?? 0);
        responses.push(result.response);
        continue;
      }
      if (governanceMirror) {
        state.mutationKeys.add(key);
        state.governance.mirroredActions.add(governanceMirror.action);
        state.governance.mirroredOrder.push(governanceMirror.action);
        responses.push(clone(governanceMirror.envelope));
        continue;
      }
      if (!fixture.trpc.mutations?.[procedure]) {
        return failClosed(418, "NOT_FOUND", `No successful fixture response for ${procedure}.`);
      }
      state.mutationKeys.add(key);
      if (procedure === "anomalies.dismiss") state.dismissedAnomaly = true;
      if (procedure === "vendorFlags.unflag") state.unflaggedVendor = true;
      if (procedure === "vendors.recordOnChainState") {
        if (vendorTransaction && input?.vendorAddress) {
          state.consumedTransactions.add(lower(vendorTransaction.hash));
          state.vendorAction = {
            label: vendorTransaction.label,
            vendorAddress: input.vendorAddress,
            input,
            row: vendorRowForMutation(fixture, vendorRecipe, input, state),
          };
          const vendorAddress = lower(input.vendorAddress);
          const updateRows = state.vendorRows.map((row) => {
            if (lower(row.address) !== vendorAddress) return row;
            if (vendorTransaction.label === "vendor.add") {
              return {
                ...row,
                status: "allowed",
                perVendorCap: "250000000",
                kycStatus: "arcanevm",
              };
            }
            if (vendorTransaction.label === "vendor.cap-update") {
              return {
                ...row,
                status: "allowed",
                perVendorCap: "125000000",
                kycStatus: "arcanevm",
              };
            }
            if (vendorTransaction.label === "vendor.block") {
              return { ...row, status: "blocked" };
            }
            if (vendorTransaction.label === "vendor.remove") {
              return { ...row, status: "removed", perVendorCap: null };
            }
            return row;
          });
          if (
            vendorTransaction.label === "vendor.add" &&
            !updateRows.some((row) => lower(row.address) === vendorAddress)
          ) {
            updateRows.push(state.vendorAction.row);
          }
          state.vendorRows = updateRows;
        }
      }
      responses.push(
        procedure === "vendors.recordOnChainState"
          ? vendorMutationResponse(fixture, vendorRecipe, input, state)
          : procedure === "escalations.recordDecision"
            ? escalationMutationResponse(fixture, state)
            : clone(fixture.trpc.mutations[procedure]),
      );
      continue;
    }

    if (
      state.mode === "unrelated" ||
      state.mode === "mismatch" ||
      state.mode === "unsigned" ||
      state.mode === "anonymous" ||
      state.mode === "failed" ||
      state.mode === "expired"
    ) {
      if (!PUBLIC_TRPC_PROCEDURES.has(procedure)) {
        return failClosed(403, "FORBIDDEN", `${procedure} is not public for this identity.`);
      }
    }
    const expectedReadInput = fixture.trpc.responses?.[procedure]?.input;
    if (expectedReadInput && !equalJsonSubset(input, expectedReadInput)) {
      return failClosed(404, "NOT_FOUND", `Input is not in the fixture for ${procedure}.`);
    }
    if (PUBLIC_TRPC_PROCEDURES.has(procedure) && procedure === "wallets.publicProfile") {
      const expected = fixture.trpc.responses?.[procedure]?.input;
      if (expected && !equalJsonSubset(input, expected)) {
        return failClosed(404, "NOT_FOUND", "This wallet has no published public profile.");
      }
    }
    const response = changedTrpcResponse(fixture, procedure, state);
    if (!response) {
      return failClosed(418, "NOT_FOUND", `No exact fixture response for ${procedure}.`);
    }
    responses.push(response);
  }
  const response = jsonResponse(procedureNames.length === 1 ? responses[0] : responses);
  if (routeDelayMs > 0) response.delayMs = routeDelayMs;
  return response;
}

function routeRpc(fixture, state, request) {
  let payload;
  try {
    payload = JSON.parse(request.postData() || "null");
  } catch {
    return jsonResponse(rpcError(null, "RPC body is not JSON."), 200);
  }
  const calls = Array.isArray(payload) ? payload : [payload];
  const results = calls.map((call) => {
    if (!call || typeof call.method !== "string") {
      return rpcError(call?.id, "RPC request is malformed.", -32600);
    }
    if (
      call.method === "eth_sendRawTransaction" ||
      call.method === "eth_sign" ||
      call.method === "personal_sign" ||
      call.method.startsWith("eth_signTypedData") ||
      call.method === "wallet_sendCalls"
    ) {
      return rpcError(call.id, `${call.method} is never permitted in an isolated fixture.`, 4001);
    }
    if (call.method === "eth_sendTransaction") {
      // The provider, not this endpoint, is the only simulated send boundary.
      return rpcError(
        call.id,
        "Transactions must be submitted through the synthetic provider.",
        4001,
      );
    }
    if (call.method === "eth_chainId") {
      if ((call.params || []).length > 0) {
        return rpcError(call.id, "eth_chainId does not accept fixture parameters.");
      }
      const chainId = fixture.rpc.chainId ?? OWNER_CHAIN_ID;
      return { jsonrpc: "2.0", id: call.id ?? null, result: `0x${chainId.toString(16)}` };
    }
    const matched = matchRpcRead(fixture, call, state);
    if (matched) {
      if (call.method === "eth_getTransactionReceipt") {
        const receiptHash = lower(call.params?.[0]);
        const receipt = matched.result ?? matched;
        const governanceAction = activateGovernanceReceipt(fixture, state, receiptHash, receipt);
        // A known governance receipt only becomes an accepted transaction when
        // its exact fixture receipt is successful.  Other canonical fixture
        // receipts retain the original escalation/vendor behavior.
        if (governanceAction !== false) state.acceptedTransactions.add(receiptHash);
        const transaction = fixture.rpc.transactions.find(
          (item) => lower(item.hash) === receiptHash,
        );
        const actionByLabel = {
          "escalation.approve": "approve",
          "escalation.approve.approver": "approve",
          "escalation.reject": "reject",
          "escalation.reject.approver": "reject",
          "escalation.cancel": "cancel",
          "escalation.sweepExpired": "sweep",
          "escalation.sweepExpired.owner": "sweep",
          "escalation.sweepExpired.viewer": "sweep",
        };
        const action = transaction ? actionByLabel[transaction.label] : null;
        if (action) state.settledAction = action;
      }
      return { jsonrpc: "2.0", id: call.id ?? null, result: matched.result ?? matched };
    }
    if (call.method === "eth_blockNumber") {
      if ((call.params || []).length > 0) {
        return rpcError(call.id, "eth_blockNumber does not accept fixture parameters.");
      }
      return { jsonrpc: "2.0", id: call.id ?? null, result: fixture.rpc.generic.eth_blockNumber };
    }
    if (call.method === "eth_gasPrice") {
      if ((call.params || []).length > 0) {
        return rpcError(call.id, "eth_gasPrice does not accept fixture parameters.");
      }
      return { jsonrpc: "2.0", id: call.id ?? null, result: fixture.rpc.generic.eth_gasPrice };
    }
    if (call.method === "eth_getTransactionCount") {
      const [address, blockTag] = call.params || [];
      const nonceAccount = lower(address);
      const actorForMode =
        state.mode === "approver"
          ? fixture.identities.approver
          : state.mode === "viewer"
            ? fixture.identities.viewer
            : fixture.identities.owner;
      const exactActorTransaction = fixture.rpc.transactions.some(
        (item) =>
          lower(item.from) === nonceAccount &&
          lower(item.from) === lower(actorForMode) &&
          (item.label === "escalation.approve.approver" ||
            item.label === "escalation.reject.approver" ||
            item.label === "escalation.sweepExpired.owner" ||
            item.label === "escalation.sweepExpired.viewer"),
      );
      if (
        (nonceAccount !== lower(fixture.identities.owner) && !exactActorTransaction) ||
        (blockTag !== undefined && !["latest", "pending"].includes(blockTag))
      ) {
        return rpcError(call.id, "Nonce lookup is allowed only for an exact fixture actor.");
      }
      return {
        jsonrpc: "2.0",
        id: call.id ?? null,
        result: fixture.rpc.generic.eth_getTransactionCount,
      };
    }
    if (call.method === "eth_estimateGas") {
      const tx = exactTransaction(fixture, { params: call.params });
      return tx && lower(tx.from) === lower(state.account)
        ? { jsonrpc: "2.0", id: call.id ?? null, result: fixture.rpc.generic.eth_estimateGas }
        : rpcError(
            call.id,
            "Gas estimation is allowed only for this identity's exact fixture transaction.",
          );
    }
    return rpcError(call.id, `${call.method} or its parameters are not in the fixture.`);
  });
  return jsonResponse(Array.isArray(payload) ? results : results[0]);
}

function requestKind(url) {
  const parsed = new URL(url);
  if (parsed.pathname === "/api/arc-rpc") return "rpc";
  if (parsed.pathname.startsWith("/api/trpc/")) return "trpc";
  if (parsed.pathname === "/api/auth/session") return "auth-session";
  if (parsed.pathname === "/api/auth/logout") return "auth-logout";
  if (parsed.pathname === "/api/public-stats") return "public-stats";
  if (parsed.pathname === "/api/auth/nonce") return "auth-nonce";
  if (parsed.pathname === "/api/auth/verify") return "auth-verify";
  if (parsed.pathname.startsWith("/api/cctp/")) return "cctp";
  if (parsed.pathname === "/api/receipts/issuers") return "receipt-issuers";
  if (parsed.pathname.startsWith("/api/")) return "unknown-api";
  return null;
}

async function readStream(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function responseHoldTimeout(value) {
  return Math.max(
    1,
    boundedInteger(value, RESPONSE_HOLD_DEFAULT_TIMEOUT_MS, RESPONSE_HOLD_MAX_TIMEOUT_MS),
  );
}

function responseHoldInfo(held) {
  return {
    procedure: held.procedure,
    requestUrl: held.requestUrl,
    url: held.requestUrl,
    status: held.snapshot.status,
    headers: clone(held.snapshot.headers),
    body: held.snapshot.body,
    mode: held.mode,
  };
}

/**
 * Hold one already-rendered owner tRPC response. The response is serialized
 * before the hold is exposed, so switching the fixture account cannot change
 * the body that is eventually fulfilled. This is intentionally a narrow
 * evidence helper, not a general route interception API.
 */
function createResponseControls(fixture, state) {
  let pending = null;
  let held = null;

  const clearTimer = (entry) => {
    if (entry?.timer) clearTimeout(entry.timer);
    if (entry) entry.timer = null;
  };

  const controls = {
    holdNext(procedure, options = {}) {
      if (state.mode !== "owner") {
        throw new Error("Response holds are available only in owner mode.");
      }
      if (
        typeof procedure !== "string" ||
        !/^[A-Za-z][A-Za-z0-9_.]*$/.test(procedure) ||
        !knownTrpcProcedure(fixture, procedure)
      ) {
        throw new Error(
          `Response hold procedure is not an exact fixture procedure: ${String(procedure)}.`,
        );
      }
      if (pending || held) {
        throw new Error("Only one response hold may be active.");
      }
      const timeoutMs = responseHoldTimeout(options.timeoutMs);
      let captureResolve;
      let captureReject;
      const capture = new Promise((resolve, reject) => {
        captureResolve = resolve;
        captureReject = reject;
      });
      // A forgotten waitForHeld must not create an unhandled rejection while
      // the bounded timer still cleans up the pending control.
      capture.catch(() => {});
      pending = {
        procedure,
        timeoutMs,
        capture,
        captureResolve,
        captureReject,
        timer: setTimeout(() => {
          if (pending?.procedure !== procedure) return;
          pending = null;
          captureReject(new Error(`Timed out waiting for ${procedure} response capture.`));
        }, timeoutMs),
      };
      return { procedure, timeoutMs };
    },

    waitForHeld(options = {}) {
      if (held) return Promise.resolve(responseHoldInfo(held));
      if (!pending) {
        return Promise.reject(new Error("No response hold is pending."));
      }
      const timeoutMs = responseHoldTimeout(
        typeof options === "number" ? options : options.timeoutMs,
      );
      return Promise.race([
        pending.capture,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timed out waiting for response capture.")), timeoutMs),
        ),
      ]);
    },

    capture(procedureNames, request, response) {
      if (
        !pending ||
        state.mode !== "owner" ||
        !Array.isArray(procedureNames) ||
        procedureNames.length !== 1 ||
        procedureNames[0] !== pending.procedure
      ) {
        return null;
      }
      const requestUrl = request.url();
      const snapshot = {
        status: response.status,
        headers: { ...(response.headers || {}) },
        body: response.body,
      };
      const config = pending;
      clearTimer(config);
      pending = null;
      let releaseResolve;
      let doneResolve;
      const released = new Promise((resolve) => {
        releaseResolve = resolve;
      });
      const done = new Promise((resolve) => {
        doneResolve = resolve;
      });
      const captured = {
        procedure: config.procedure,
        requestUrl,
        mode: state.mode,
        snapshot,
        route: null,
        released,
        releaseResolve,
        done,
        doneResolve,
        outcome: null,
        timer: null,
      };
      held = captured;
      config.captureResolve(responseHoldInfo(captured));
      captured.timer = setTimeout(() => {
        if (held !== captured || captured.outcome) return;
        captured.outcome = "timeout";
        captured.releaseResolve();
      }, config.timeoutMs);
      return captured;
    },

    async settle(heldResponse, route) {
      heldResponse.route = route;
      await heldResponse.released;
      try {
        if (heldResponse.outcome === "release") {
          await route.fulfill(heldResponse.snapshot);
        } else if (typeof route.abort === "function") {
          await route.abort("blockedbyclient");
        } else {
          // Narrow fake routes may not expose abort; fulfill the immutable
          // snapshot rather than leaving a request promise unresolved.
          await route.fulfill(heldResponse.snapshot);
        }
      } catch {
        // Browser cancellation/request failure is an acceptable evidence
        // result. Do not retry through an upstream route or live endpoint.
      } finally {
        clearTimer(heldResponse);
        if (held === heldResponse) held = null;
        heldResponse.doneResolve({
          outcome: heldResponse.outcome,
          ...responseHoldInfo(heldResponse),
        });
      }
    },

    async release() {
      if (!held) throw new Error("No captured response is available to release.");
      if (held.outcome) throw new Error(`Captured response is already ${held.outcome}.`);
      held.outcome = "release";
      held.releaseResolve();
      return held.done;
    },

    async cleanup() {
      if (pending) {
        const config = pending;
        pending = null;
        clearTimer(config);
        config.captureReject(new Error("Response hold was cleaned up before capture."));
      }
      if (!held) return { outcome: "cleaned" };
      if (!held.outcome) {
        held.outcome = "cleanup";
        held.releaseResolve();
      }
      return held.done;
    },
  };

  return controls;
}

async function installFixtureHarness(page, options = {}) {
  const fixture = applyIndependentVendorMirror(options.fixture ?? loadFixture(options.fixturePath));
  const workspaceDirectory = defaultWorkspaceDirectory();
  const walletPath = options.walletPath ?? path.join(__dirname, "synthetic-wallet-provider.cjs");
  const walletSource = await fsp.readFile(walletPath, "utf8");
  const initialMode = options.mode ?? "owner";
  const state = {
    mode: initialMode,
    role: roleForMode(fixture, initialMode),
    account: accountForRole(fixture, initialMode),
    acceptedTransactions: new Set(),
    consumedTransactions: new Set(),
    mutationKeys: new Set(),
    dismissedAnomaly: false,
    unflaggedVendor: false,
    vendorRows: clone(fixture.trpc.responses?.["vendors.list"]?.response?.result?.data?.json ?? []),
    vendorAction: null,
    organizationName:
      fixture.trpc.responses?.["org.getCurrent"]?.response?.result?.data?.json?.name ??
      "Synthetic Treasury Workspace",
    settingsMembers: clone(
      fixture.trpc.responses?.["org.listMembers"]?.response?.result?.data?.json ?? [],
    ),
    settingsRemoval: normalizeSettingsRemovalControl(options.settingsRemoval),
    settledAction: null,
    governance: {
      receiptActions: [],
      postReads: new Set(),
      mirroredActions: new Set(),
      mirroredOrder: [],
    },
    requests: [],
    evidence: [],
  };
  if (
    ![
      "owner",
      "viewer",
      "approver",
      "unrelated",
      "unsigned",
      "anonymous",
      "mismatch",
      "failed",
      "expired",
    ].includes(initialMode)
  ) {
    throw new Error(`Unknown fixture mode: ${initialMode}`);
  }
  const responseControls = createResponseControls(fixture, state);
  const providerOptions = {
    address: accountForRole(fixture, initialMode) || fixture.identities.owner,
    chainId: fixture.rpc.chainId ?? OWNER_CHAIN_ID,
    transactions: fixture.rpc.transactions,
  };
  const walletBrowserSource = walletSource.replace(
    /\s*module\.exports\s*=\s*\{\s*installSyntheticWallet\s*\};?\s*$/,
    "",
  );
  if (walletBrowserSource.includes("module.exports")) {
    throw new Error("Synthetic provider export could not be removed for browser injection.");
  }
  const initScript = `
${walletBrowserSource}
(() => {
  const options = ${JSON.stringify(providerOptions)};
  let persisted = null;
  try { persisted = sessionStorage.getItem("__arcanum_fixture_account"); } catch {}
  if (/^0x[0-9a-fA-F]{40}$/.test(persisted || "")) options.address = persisted;
  installSyntheticWallet(options);
  const calls = [];
  const originalPrint = window.print;
  window.print = () => { calls.push({ at: Date.now(), native: false }); };
  window.__arcanumFixture = {
    schema: ${JSON.stringify(FIXTURE_SCHEMA)},
    providerInstalled: true,
    printCalls: calls,
    originalPrintAvailable: typeof originalPrint === "function",
  };
})();
`;
  await page.addInitScript({ content: initScript });
  await page.setDefaultTimeout(options.timeoutMs ?? 8000);

  const routeHandler = async (route) => {
    const request = route.request();
    const url = request.url();
    const kind = requestKind(url);
    if (!kind) {
      await route.continue();
      return;
    }
    let response;
    let trpcProcedures = null;
    try {
      if (kind === "auth-session") {
        if (state.mode === "failed")
          response = failClosed(503, "UNAVAILABLE", "Session fixture is unavailable.");
        else if (state.mode === "expired") response = jsonResponse({ user: null });
        else response = jsonResponse(sessionForMode(fixture, state.mode));
      } else if (kind === "auth-logout") {
        state.mode = "anonymous";
        response = {
          status: 204,
          headers: { "x-arcanum-fixture-mode": "isolated-simulation" },
          body: "",
        };
      } else if (kind === "auth-nonce" || kind === "auth-verify") {
        response = failClosed(403, "FORBIDDEN", "SIWE signing is disabled in the browser fixture.");
      } else if (kind === "public-stats") {
        response = jsonResponse({ capitalGovernedUsdc: 12.5 });
      } else if (kind === "receipt-issuers") {
        response = jsonResponse({ issuers: RECEIPT_ISSUER_REGISTRY }, 200, {
          "cache-control": "public, max-age=300",
        });
      } else if (kind === "rpc") {
        response = routeRpc(fixture, state, request);
      } else if (kind === "trpc") {
        const procedurePath = pathnameAfter(new URL(url).pathname, "/api/trpc/");
        trpcProcedures = procedurePath ? procedurePath.split(",").filter(Boolean) : [];
        response =
          trpcProcedures.length > 0
            ? routeTrpc(fixture, state, request, trpcProcedures)
            : failClosed(400, "BAD_REQUEST", "tRPC procedure path is empty.");
      } else if (kind === "cctp") {
        response = failClosed(503, "UNAVAILABLE", "CCTP quote/relay is not simulated.");
      } else {
        response = failClosed(418, "NOT_FOUND", `Unknown API endpoint ${new URL(url).pathname}.`);
      }
    } catch (error) {
      response = failClosed(
        500,
        "INTERNAL_SERVER_ERROR",
        error instanceof Error ? error.message : "Fixture route failed.",
      );
    }
    const delayMs = boundedInteger(response?.delayMs, 0, SETTINGS_REMOVE_MAX_DELAY_MS);
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const { delayMs: _delayMs, ...immediateResponse } = response;
      response = immediateResponse;
    }
    state.requests.push({
      at: new Date().toISOString(),
      kind,
      method: request.method(),
      path: new URL(url).pathname,
      status: response.status,
      blocked: response.headers?.["x-arcanum-fixture-fail-closed"] === "1",
    });
    if (kind === "trpc" && trpcProcedures) {
      const heldResponse = responseControls.capture(trpcProcedures, request, response);
      if (heldResponse) {
        await responseControls.settle(heldResponse, route);
        return;
      }
    }
    await route.fulfill(response);
  };
  await page.route("**/*", routeHandler);

  const harness = {
    fixture,
    state,
    identities: {
      ...fixture.identities,
      unrelated: ACCOUNT_B,
    },
    receiptFixtures: loadBrowserReceiptFixtures(workspaceDirectory),
    receiptIssuers: RECEIPT_ISSUER_REGISTRY,
    responseControls,
    settingsControls: {
      removal() {
        return { ...state.settingsRemoval };
      },
      configureRemoval(control = {}) {
        state.settingsRemoval = normalizeSettingsRemovalControl(control);
        return { ...state.settingsRemoval };
      },
      failNextRemoval({
        count = 1,
        status = state.settingsRemoval.failureStatus,
        message = state.settingsRemoval.failureMessage,
        delayMs = state.settingsRemoval.delayMs,
      } = {}) {
        state.settingsRemoval = normalizeSettingsRemovalControl({
          ...state.settingsRemoval,
          failuresRemaining: count,
          failureStatus: status,
          failureMessage: message,
          delayMs,
        });
        return { ...state.settingsRemoval };
      },
      clearRemoval() {
        state.settingsRemoval = normalizeSettingsRemovalControl();
        return { ...state.settingsRemoval };
      },
    },
    async switchAccount(role, { session = role, reload = false } = {}) {
      const nextAccount = accountForRole(fixture, role);
      state.account = nextAccount;
      state.role = roleForMode(fixture, role);
      state.mode = session;
      await page.evaluate((account) => {
        try {
          sessionStorage.setItem("__arcanum_fixture_account", account);
        } catch {}
        if (!window.__syntheticWalletAudit)
          throw new Error("Synthetic provider was not installed.");
        window.__syntheticWalletAudit.changeAccount(account);
      }, nextAccount);
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
    },
    async disconnect({ reload = false } = {}) {
      state.account = null;
      state.mode = "anonymous";
      await page.evaluate(() => {
        try {
          sessionStorage.removeItem("__arcanum_fixture_account");
        } catch {}
        window.__syntheticWalletAudit.disconnect();
      });
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
    },
    async setSession(mode, { reload = false } = {}) {
      state.mode = mode;
      state.role = roleForMode(fixture, mode);
      if (reload) await page.reload({ waitUntil: "domcontentloaded" });
    },
    async providerCalls() {
      return page.evaluate(() => window.__syntheticWalletAudit?.calls ?? []);
    },
    async assertProviderInstalled() {
      return page.evaluate(() => {
        if (!window.__arcanumFixture?.providerInstalled) {
          throw new Error("Synthetic wallet was not installed before navigation.");
        }
        return window.__arcanumFixture;
      });
    },
    async checkpoint(label, extra = {}) {
      const safe = String(label)
        .replace(/[^a-zA-Z0-9._-]+/g, "-")
        .replace(/^-|-$/g, "");
      const index = String(state.evidence.length + 1).padStart(2, "0");
      const evidenceDirectory =
        options.evidenceDirectory ??
        path.resolve(
          workspaceDirectory,
          ".local/audits/arcanum-closure-2026-09-12/browser-evidence",
        );
      await fsp.mkdir(evidenceDirectory, { recursive: true });
      const screenshotPath = path.join(evidenceDirectory, `${index}-${safe}.png`);
      const recordPath = path.join(evidenceDirectory, `${index}-${safe}.json`);
      const record = {
        schema: "arcanum.remediation-browser-evidence.v1",
        label,
        url: page.url(),
        mode: state.mode,
        account: state.account,
        ...extra,
        blockedRequests: state.requests.filter((item) => item.blocked),
        providerCalls: await harness.providerCalls(),
      };
      await page.screenshot({ path: screenshotPath, fullPage: true });
      await fsp.writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      state.evidence.push({ label, screenshotPath, recordPath });
      return { ...record, screenshotPath, recordPath };
    },
    async captureDownload(action, timeoutMs = options.timeoutMs ?? 8000) {
      const downloadPromise = page.waitForEvent("download", { timeout: timeoutMs });
      await action();
      const download = await downloadPromise;
      const stream = await download.createReadStream();
      if (!stream) throw new Error("Browser did not expose download bytes.");
      const bytes = await readStream(stream);
      return {
        suggestedFilename: download.suggestedFilename(),
        failure: await download.failure(),
        bytes,
        text: bytes.toString("utf8"),
      };
    },
    async capturePrint(action, timeoutMs = options.timeoutMs ?? 8000) {
      const popupPromise = page.waitForEvent("popup", { timeout: timeoutMs });
      await action();
      const popup = await popupPromise;
      await popup.waitForLoadState("domcontentloaded").catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 350));
      const print = await popup.evaluate(() => ({
        calls: window.__arcanumFixture?.printCalls ?? [],
        title: document.title,
        bodyText: document.body.innerText,
      }));
      await popup.close();
      return { ...print, nativeDialogOpened: false };
    },
    blockedRequests() {
      return state.requests.filter((item) => item.blocked);
    },
    allRequests() {
      return [...state.requests];
    },
    async close() {
      await responseControls.cleanup();
      await page.unroute("**/*", routeHandler);
    },
  };
  return harness;
}

const JOURNEY_CASES = Object.freeze([
  {
    id: "owner-session",
    route: "/dashboard",
    mode: "owner",
    selector: "getByRole('heading', { name: /overview|dashboard/i })",
    expects: [
      "owner address visible in account menu",
      "Treasury Agent",
      "at least one populated read",
    ],
  },
  {
    id: "viewer-account-event",
    route: "/dashboard",
    transition: "switchAccount('viewer', { session: 'viewer', reload: true })",
    selector: "getByRole('link', { name: 'SETTINGS' })",
    expects: [
      "same workspace reads remain visible",
      "owner-only controls absent or disabled",
      "no mutation succeeds",
    ],
  },
  {
    id: "approver-non-owner-addon",
    route: "/escalations",
    mode: "approver",
    selector: "getByRole('heading', { name: /escalations/i })",
    expects: [
      "distinct operator approver address visible in the session",
      "exact isRequiredSigner(true) and signed(false) reads",
      "approve/reject mutations only after an exact approver receipt",
      "owner-only mutations remain fail-closed",
    ],
  },
  {
    id: "unrelated-account-b",
    route: "/dashboard",
    transition: "switchAccount('unrelated', { session: 'unrelated', reload: true })",
    selector: "getByText(/connect|unauthorized|unavailable/i)",
    expects: ["no private fixture rows", "direct private reads fail closed"],
  },
  {
    id: "unsigned",
    route: "/receipts",
    transition: "switchAccount('owner', { session: 'unsigned', reload: true })",
    selector: "getByText(/Sign in with the connected wallet/i)",
    expects: [
      "connected_unsigned state",
      "no empty authenticated list",
      "SIWE request remains blocked",
    ],
  },
  {
    id: "failed-session",
    route: "/dashboard",
    transition: "setSession('failed', { reload: true })",
    selector: "getByText(/unavailable|connect|read-only/i)",
    expects: ["session outage is not presented as authenticated data", "private tRPC is blocked"],
  },
]);

module.exports = {
  ACCOUNT_B,
  FIXTURE_SCHEMA,
  JOURNEY_CASES,
  OWNER_CHAIN_ID,
  RECEIPT_ISSUER_REGISTRY,
  REMOVED_VENDOR_ADDRESS,
  RESPONSE_HOLD_DEFAULT_TIMEOUT_MS,
  RESPONSE_HOLD_MAX_TIMEOUT_MS,
  SESSION_TTL_MS,
  SETTINGS_REMOVE_MAX_DELAY_MS,
  SETTINGS_UI_RECIPES,
  UNKNOWN_VENDOR_ADDRESS,
  VENDOR_MIRROR_CAP_BASE_UNITS,
  VENDOR_UI_RECIPES,
  defaultFixturePath,
  installFixtureHarness,
  loadFixture,
  loadReceiptFixtures,
};
