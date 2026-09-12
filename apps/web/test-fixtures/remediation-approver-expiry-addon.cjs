/*
 * Offline-only addon for the distinct approver and expired-escalation journey.
 *
 * The canonical remediation fixture stays immutable. composeFixture() clones it,
 * adds the one non-owner approver, and appends only the exact reads,
 * transactions, receipts, and response overlays needed by this journey.
 * Nothing in this file signs, broadcasts, or contacts a network.
 */
"use strict";

const { decodeFunctionResult, encodeFunctionData, encodeFunctionResult } = require("viem");
const escalationManagerAbi = require("../../../packages/contracts/abis/EscalationManager.json");

const FIXTURE_SCHEMA = "arcanum.remediation-browser-fixtures.v1";
const ADDON_SCHEMA = "arcanum.remediation-approver-expiry-addon.v1";
const APPROVER = "0x7000000000000000000000000000000000000007";
const EXPIRED_STATUS = 3;
const APPROVER_ACTION_LABELS = Object.freeze({
  approve: "escalation.approve.approver",
  reject: "escalation.reject.approver",
});
const SWEEP_ACTION_LABELS = Object.freeze({
  owner: "escalation.sweepExpired.owner",
  viewer: "escalation.sweepExpired.viewer",
});
const ACTION_PATH = "/escalations";

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function lower(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function isAddress(value) {
  return typeof value === "string" && /^0x[0-9a-f]{40}$/i.test(value);
}

function escalationFunction(name) {
  const item = escalationManagerAbi.find(
    (candidate) => candidate.type === "function" && candidate.name === name,
  );
  if (!item) throw new Error(`EscalationManager ABI is missing ${name}.`);
  return item;
}

function encodeCall(functionName, args) {
  return encodeFunctionData({
    abi: [escalationFunction(functionName)],
    functionName,
    args,
  });
}

function decodeEscalation(data) {
  return decodeFunctionResult({
    abi: [escalationFunction("getEscalation")],
    functionName: "getEscalation",
    data,
  });
}

function encodeEscalation(result) {
  return encodeFunctionResult({
    abi: [escalationFunction("getEscalation")],
    functionName: "getEscalation",
    result,
  });
}

function getEscalationId(fixture) {
  const id = fixture.identities?.escalationId;
  if (typeof id !== "string" || !/^0x[0-9a-f]{64}$/i.test(id)) {
    throw new Error("Approver expiry addon requires the canonical bytes32 escalation id.");
  }
  return id;
}

function expirationFor(options = {}) {
  const explicitSeconds =
    options.expiresAtSeconds === undefined ? null : Number(options.expiresAtSeconds);
  if (explicitSeconds !== null) {
    if (!Number.isFinite(explicitSeconds) || explicitSeconds < 0) {
      throw new Error(
        "Approver expiry addon expiresAtSeconds must be a finite non-negative number.",
      );
    }
    return {
      expiresAtSeconds: Math.floor(explicitSeconds),
      expiresAt: new Date(Math.floor(explicitSeconds) * 1000).toISOString(),
    };
  }
  const nowMs =
    options.nowMs === undefined
      ? Date.now()
      : typeof options.nowMs === "function"
        ? options.nowMs()
        : Number(options.nowMs);
  if (!Number.isFinite(nowMs)) throw new Error("Approver expiry addon nowMs must be finite.");
  const expiresAtSeconds = Math.max(0, Math.floor(nowMs / 1000) - 3600);
  return {
    expiresAtSeconds,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

function withEscalationStatus(data, expiresAtSeconds, status) {
  const decoded = decodeEscalation(data);
  decoded[5] = BigInt(expiresAtSeconds);
  decoded[8] = status;
  return encodeEscalation(decoded);
}

function requireResponse(fixture, procedure) {
  const response = fixture.trpc?.responses?.[procedure]?.response;
  if (!response) throw new Error(`Approver expiry addon requires ${procedure}.`);
  return response;
}

function overlayEscalationResponses(fixture, expiresAt) {
  const listResponse = requireResponse(fixture, "escalations.list");
  const list = listResponse.result?.data?.json;
  const id = lower(fixture.identities.escalationId);
  if (!Array.isArray(list) || !list.some((item) => lower(item.id) === id)) {
    throw new Error("Approver expiry addon requires the canonical escalation list row.");
  }
  for (const item of list) {
    if (lower(item.id) === id) item.expiresAt = expiresAt;
  }
  const publicResponse = requireResponse(fixture, "escalations.publicByKey");
  const publicItem = publicResponse.result?.data?.json;
  if (!publicItem || lower(publicItem.escalationKey) !== id) {
    throw new Error("Approver expiry addon requires the canonical public escalation row.");
  }
  publicItem.expiresAt = expiresAt;
  // Keep superjson's Date metadata: the JSON value is an ISO string while the
  // metadata tells the browser tRPC decoder to materialize a Date.
  listResponse.result.data.meta = listResponse.result.data.meta || {
    values: {},
    v: 1,
  };
  listResponse.result.data.meta.values = {
    ...(listResponse.result.data.meta.values || {}),
    "0.expiresAt": ["Date"],
  };
  publicResponse.result.data.meta = publicResponse.result.data.meta || {
    values: {},
    v: 1,
  };
  publicResponse.result.data.meta.values = {
    ...(publicResponse.result.data.meta.values || {}),
    expiresAt: ["Date"],
  };
}

function makeReceipt(transaction, template) {
  const receipt = clone(template);
  if (!receipt) throw new Error("Approver expiry addon requires a receipt template.");
  receipt.transactionHash = transaction.hash;
  receipt.from = transaction.from;
  receipt.to = transaction.to;
  return receipt;
}

function appendTransaction(fixture, transaction, receiptTemplate) {
  const transactions = fixture.rpc.transactions;
  if (!Array.isArray(transactions)) throw new Error("Canonical fixture transactions are missing.");
  if (transactions.some((item) => lower(item.hash) === lower(transaction.hash))) {
    throw new Error(`Approver expiry transaction hash already exists: ${transaction.hash}`);
  }
  transactions.push(transaction);
  fixture.rpc.transactionReceipts = fixture.rpc.transactionReceipts || {};
  fixture.rpc.transactionReceipts[transaction.hash] = makeReceipt(transaction, receiptTemplate);
}

function findTransaction(fixture, label) {
  const transaction = fixture.rpc.transactions?.find((item) => item.label === label);
  if (!transaction) throw new Error(`Canonical fixture transaction is missing ${label}.`);
  return transaction;
}

function receiptTemplate(fixture) {
  const firstHash = fixture.rpc.transactions?.[0]?.hash;
  const template = firstHash && fixture.rpc.transactionReceipts?.[firstHash];
  if (!template) throw new Error("Canonical fixture has no transaction receipt template.");
  return template;
}

function makeRead(label, address, data, result) {
  return { label, address, data, result };
}

function makeOverlayReads(fixture, initial, expiresAtSeconds) {
  const manager = initial.address;
  const wallet = fixture.identities.governedWallet;
  const id = getEscalationId(fixture);
  const owner = fixture.identities.owner;
  const viewer = fixture.identities.viewer;
  return {
    initial: {
      ...initial,
      result: withEscalationStatus(initial.result, expiresAtSeconds, 0),
    },
    settled: {
      approve: {
        ...fixture.rpc.read.approver.settled.approve,
        result: withEscalationStatus(
          fixture.rpc.read.approver.settled.approve.result,
          expiresAtSeconds,
          4,
        ),
      },
      reject: {
        ...fixture.rpc.read.approver.settled.reject,
        result: withEscalationStatus(
          fixture.rpc.read.approver.settled.reject.result,
          expiresAtSeconds,
          2,
        ),
      },
      cancel: {
        ...fixture.rpc.read.approver.settled.cancel,
        result: withEscalationStatus(
          fixture.rpc.read.approver.settled.cancel.result,
          expiresAtSeconds,
          5,
        ),
      },
      sweep: makeRead(
        "escalationManager.getEscalation.expired",
        manager,
        initial.data,
        withEscalationStatus(initial.result, expiresAtSeconds, EXPIRED_STATUS),
      ),
    },
    isRequiredSignerOwner: {
      ...fixture.rpc.read.approver.isRequiredSignerOwner,
      data: encodeCall("isRequiredSigner", [wallet, owner]),
    },
    isRequiredSignerViewer: {
      ...fixture.rpc.read.approver.isRequiredSignerViewer,
      data: encodeCall("isRequiredSigner", [wallet, viewer]),
    },
    isRequiredSignerApprover: makeRead(
      "escalationManager.isRequiredSigner(approver)",
      manager,
      encodeCall("isRequiredSigner", [wallet, APPROVER]),
      `0x${"0".repeat(63)}1`,
    ),
    signedFalse: {
      ...fixture.rpc.read.approver.signedFalse,
      data: encodeCall("signed", [id, owner]),
    },
    signedFalseViewer: {
      ...fixture.rpc.read.approver.signedFalseViewer,
      data: encodeCall("signed", [id, viewer]),
    },
    signedFalseApprover: makeRead(
      "escalationManager.signed(false, approver)",
      manager,
      encodeCall("signed", [id, APPROVER]),
      `0x${"0".repeat(64)}`,
    ),
  };
}

function contextForApprover(fixture) {
  const viewerContexts = fixture.trpc.contexts?.viewer;
  if (!viewerContexts) throw new Error("Canonical fixture viewer contexts are missing.");
  const context = clone(viewerContexts);
  for (const response of Object.values(context)) {
    const json = response?.result?.data?.json;
    if (json && typeof json === "object" && !Array.isArray(json)) {
      json.callerRole = "operator";
    }
  }
  return context;
}

function composeFixture(baseFixture, options = {}) {
  const fixture = clone(baseFixture);
  if (!fixture || fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`Unexpected fixture schema: ${String(fixture?.schema)}`);
  }
  const owner = fixture.identities?.owner;
  const viewer = fixture.identities?.viewer;
  if (!isAddress(owner) || !isAddress(viewer)) {
    throw new Error("Approver expiry addon requires owner and viewer identities.");
  }
  if (lower(owner) === lower(APPROVER) || lower(viewer) === lower(APPROVER)) {
    throw new Error("Approver identity must remain distinct from owner and viewer.");
  }
  if (!fixture.rpc?.read?.approver) {
    throw new Error("Canonical fixture rpc.read.approver is missing.");
  }

  const { expiresAtSeconds, expiresAt } = expirationFor(options);
  const id = getEscalationId(fixture);
  const initial = fixture.rpc.read.approver.initial;
  fixture.identities.approver = APPROVER;
  fixture.rpc.read.approver = makeOverlayReads(fixture, initial, expiresAtSeconds);
  overlayEscalationResponses(fixture, expiresAt);

  const template = receiptTemplate(fixture);
  const manager = initial.address;
  const approve = findTransaction(fixture, "escalation.approve");
  const reject = findTransaction(fixture, "escalation.reject");
  const sweepData = encodeCall("sweepExpired", [id]);
  const actionTransactions = [
    {
      label: APPROVER_ACTION_LABELS.approve,
      from: APPROVER,
      to: approve.to,
      data: approve.data,
      value: approve.value || "0x0",
      hash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    {
      label: APPROVER_ACTION_LABELS.reject,
      from: APPROVER,
      to: reject.to,
      data: reject.data,
      value: reject.value || "0x0",
      hash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
    {
      label: SWEEP_ACTION_LABELS.owner,
      from: owner,
      to: manager,
      data: sweepData,
      value: "0x0",
      hash: "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
    },
    {
      label: SWEEP_ACTION_LABELS.viewer,
      from: viewer,
      to: manager,
      data: sweepData,
      value: "0x0",
      hash: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    },
  ];
  for (const transaction of actionTransactions) appendTransaction(fixture, transaction, template);

  fixture.trpc.contexts = fixture.trpc.contexts || {};
  fixture.trpc.contexts.approver = contextForApprover(fixture);
  fixture.routingInstructions = fixture.routingInstructions || {};
  fixture.routingInstructions.rpc = [
    ...(fixture.routingInstructions.rpc || []),
    "For the expired journey, route only the exact sweepExpired calldata and owner/viewer receipt hashes from this addon.",
  ];
  fixture.routingInstructions.trpc = [
    ...(fixture.routingInstructions.trpc || []),
    "Approver sessions may read the exact escalation procedures and recordDecision only after their exact approve/reject receipt.",
  ];
  fixture.approverExpiryAddon = {
    schema: ADDON_SCHEMA,
    identity: {
      address: APPROVER,
      sessionRole: "operator",
      walletRole: "operator",
      organizationRole: "operator",
      label: "Council approver",
    },
    expiry: {
      expiresAt,
      expiresAtSeconds,
      status: "EXPIRED",
      source: "offline clock",
    },
    permissions: {
      reads: ["escalations.list", "escalations.publicByKey"],
      mutations: ["escalations.recordDecision"],
      transactionLabels: [
        APPROVER_ACTION_LABELS.approve,
        APPROVER_ACTION_LABELS.reject,
        SWEEP_ACTION_LABELS.owner,
        SWEEP_ACTION_LABELS.viewer,
      ],
    },
    actions: [
      {
        id: "approve",
        label: "Approve escalation",
        actor: APPROVER,
        actorLabel: "Council approver",
        url: `${ACTION_PATH}/${id}/approve`,
        transactionLabel: APPROVER_ACTION_LABELS.approve,
        hash: actionTransactions[0].hash,
        signature: null,
      },
      {
        id: "reject",
        label: "Reject escalation",
        actor: APPROVER,
        actorLabel: "Council approver",
        url: `${ACTION_PATH}/${id}/reject`,
        transactionLabel: APPROVER_ACTION_LABELS.reject,
        hash: actionTransactions[1].hash,
        signature: null,
      },
      {
        id: "sweep-owner",
        label: "Sweep expired escalation",
        actor: owner,
        actorLabel: "Workspace owner",
        url: `${ACTION_PATH}/${id}/sweep`,
        transactionLabel: SWEEP_ACTION_LABELS.owner,
        hash: actionTransactions[2].hash,
        signature: null,
      },
      {
        id: "sweep-viewer",
        label: "Sweep expired escalation",
        actor: viewer,
        actorLabel: "Workspace viewer",
        url: `${ACTION_PATH}/${id}/sweep`,
        transactionLabel: SWEEP_ACTION_LABELS.viewer,
        hash: actionTransactions[3].hash,
        signature: null,
      },
    ],
  };
  return fixture;
}

function composeBundle(bundle, options = {}) {
  if (!bundle || !bundle.fixture)
    throw new Error("Approver expiry addon requires a fixture bundle.");
  const fixture = composeFixture(bundle.fixture, options);
  const unsupported = (bundle.unsupported || []).filter(
    (item) => !/approver|sweepExpired|expired workspace\/public/i.test(String(item)),
  );
  return {
    ...bundle,
    fixture,
    unsupported,
  };
}

function assertFixtureRoutes(fixture, { requireExpired = true } = {}) {
  const addon = fixture?.approverExpiryAddon;
  if (!addon || addon.schema !== ADDON_SCHEMA) {
    throw new Error("Approver expiry addon metadata is missing.");
  }
  const reads = [
    fixture.rpc.read.approver.initial,
    fixture.rpc.read.approver.settled.sweep,
    fixture.rpc.read.approver.isRequiredSignerApprover,
    fixture.rpc.read.approver.signedFalseApprover,
  ];
  if (reads.some((read) => !read?.address || !read?.data || read.result === undefined)) {
    throw new Error("Approver expiry fixture has an incomplete exact read route.");
  }
  const nowSeconds = Math.floor(Date.now() / 1000);
  const initial = decodeEscalation(fixture.rpc.read.approver.initial.result);
  const expired = decodeEscalation(fixture.rpc.read.approver.settled.sweep.result);
  if (
    expired[5] !== initial[5] ||
    expired[8] !== EXPIRED_STATUS ||
    (requireExpired && initial[5] >= BigInt(nowSeconds)) ||
    (!requireExpired && initial[5] <= BigInt(nowSeconds))
  ) {
    throw new Error("Approver expiry fixture does not contain a finite expired ABI result.");
  }
  const listItem = fixture.trpc.responses["escalations.list"].response.result.data.json.find(
    (item) => lower(item.id) === lower(fixture.identities.escalationId),
  );
  const publicItem = fixture.trpc.responses["escalations.publicByKey"].response.result.data.json;
  if (
    listItem?.expiresAt !== fixture.approverExpiryAddon.expiry.expiresAt ||
    publicItem?.expiresAt !== fixture.approverExpiryAddon.expiry.expiresAt ||
    (listItem &&
      fixture.trpc.responses["escalations.list"].response.result.data.meta?.values?.[
        "0.expiresAt"
      ]?.[0] !== "Date") ||
    (publicItem &&
      fixture.trpc.responses["escalations.publicByKey"].response.result.data.meta?.values
        ?.expiresAt?.[0] !== "Date") ||
    (requireExpired &&
      new Date(fixture.approverExpiryAddon.expiry.expiresAt).getTime() >= Date.now())
  ) {
    throw new Error("Approver expiry fixture public/list expiry metadata is not expired.");
  }
  const labels = new Set(fixture.rpc.transactions.map((item) => item.label));
  for (const label of addon.permissions.transactionLabels) {
    if (!labels.has(label))
      throw new Error(`Approver expiry transaction route is missing ${label}.`);
  }
  const sweepData = encodeCall("sweepExpired", [fixture.identities.escalationId]);
  for (const label of Object.values(SWEEP_ACTION_LABELS)) {
    const transaction = fixture.rpc.transactions.find((item) => item.label === label);
    if (!transaction || lower(transaction.data) !== lower(sweepData)) {
      throw new Error(`Sweep route is not exact for ${label}.`);
    }
  }
  return Object.freeze({
    exactReads: reads.length,
    exactTransactions: addon.permissions.transactionLabels.length,
    unknownRpc: "blocked",
    unknownApi: "blocked",
    signatures: "none",
  });
}

const BROWSER_INSTALL_RECIPE = Object.freeze({
  source: "arcanum/apps/web/test-fixtures/remediation-approver-expiry-addon.cjs",
  steps: Object.freeze([
    "Load the canonical bundle with ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs }).",
    "Read .local/audits/arcanum-closure-2026-09-12/fixtures/approver-expired-unswept.json with JSON.parse(await fs.readFile(path, 'utf8')).",
    "Pass { ...bundle, fixture } to ArcanumClosureNotebookFullAdapter.loadFullFixtureBundle({ bundle: transformedBundle, fs, io }).",
    "Call transformed.installFullFixtureHarness(page, { mode: 'approver' }) before navigation.",
    "Use transformed.installFullFixtureHarness(page, { mode: 'owner'|'viewer' }) for sweep actor routes.",
    "Keep page routing and the synthetic wallet installed before page.goto('/escalations').",
  ]),
  constraints: Object.freeze([
    "Offline fixture routes only; no app edits, builds, browser launches, or live network.",
    "Do not add a private key or signature; every signature field is null.",
  ]),
});
const BROWSER_INSTALL_RECIPE_SOURCE = [
  "const baseBundle = await ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs });",
  "const path = '.local/audits/arcanum-closure-2026-09-12/fixtures/approver-expired-unswept.json';",
  "const fixture = JSON.parse(await fs.readFile(path, 'utf8'));",
  "const transformedBundle = { ...baseBundle, fixture };",
  "const loaded = await ArcanumClosureNotebookFullAdapter.loadFullFixtureBundle({",
  "  fs, io, bundle: transformedBundle,",
  "});",
  "const harness = await loaded.installFullFixtureHarness(page, { mode: 'approver' });",
].join("\n");

module.exports = {
  ADDON_SCHEMA,
  APPROVER,
  APPROVER_ACTION_LABELS,
  BROWSER_INSTALL_RECIPE,
  BROWSER_INSTALL_RECIPE_SOURCE,
  EXPIRED_STATUS,
  SWEEP_ACTION_LABELS,
  assertFixtureRoutes,
  checkFakeRoutes: assertFixtureRoutes,
  composeBundle,
  composeFixture,
  composeApproverExpiryBundle: composeBundle,
  createApproverExpiryFixture: composeFixture,
  encodeCall,
};
