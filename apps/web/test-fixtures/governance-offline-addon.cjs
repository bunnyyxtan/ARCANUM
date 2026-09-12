/*
 * Offline-only governance addon.
 *
 * The canonical remediation fixture remains unchanged. composeFixture() clones
 * it and adds exact ABI-derived routes for a positive policy update, signer
 * authorize/revoke, wallet freeze/unfreeze, and governed-wallet deployment.
 * The addon never signs, broadcasts, contacts a network, or accepts a
 * transaction by shape alone.
 */
"use strict";

const {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  encodeFunctionResult,
  stringToHex,
} = require("viem");
const guardedWalletAbi = require("../../../packages/contracts/abis/GuardedWallet.json");
const walletFactoryAbi = require("../../../packages/contracts/abis/WalletFactory.json");

const FIXTURE_SCHEMA = "arcanum.remediation-browser-fixtures.v1";
const ADDON_SCHEMA = "arcanum.governance-offline-addon.v1";
const OWNER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
const GOVERNED_WALLET = "0x1000000000000000000000000000000000000001";
const AGENT_SIGNER = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc";
const NEW_SIGNER = "0x4000000000000000000000000000000000000004";
const DEPLOYED_WALLET = "0x8000000000000000000000000000000000000008";
const DEPLOY_LABEL = "Governed Wallet";
const ANOMALY_ID = "0x77777777-7777-4777-8777-777777777777";
const DEPLOY_BLOCK_TIMESTAMP = 1789033800n;
const POLICY_UPDATE_HASH = "0x6666666666666666666666666666666666666666666666666666666666666666";
const SIGNER_AUTHORIZE_HASH = "0x4444444444444444444444444444444444444444444444444444444444444444";
const SIGNER_REVOKE_HASH = "0x5555555555555555555555555555555555555555555555555555555555555555";
const PAUSE_HASH = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const UNPAUSE_HASH = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
const DEPLOY_HASH = "0xabababababababababababababababababababababababababababababababab";

const INITIAL_POLICY = Object.freeze({
  perTxCap: 100000000n,
  daily24hCap: 500000000n,
  monthlyCap: 5000000000n,
  allowedCategories: 7n,
  escalationThreshold: 50000000n,
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
});
const UPDATED_POLICY = Object.freeze({
  perTxCap: 150000000n,
  daily24hCap: 750000000n,
  monthlyCap: 7500000000n,
  allowedCategories: 7n,
  escalationThreshold: 75000000n,
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
});
const DEPLOY_POLICY = Object.freeze({
  perTxCap: 100000000n,
  daily24hCap: 1000000000n,
  monthlyCap: 30000000000n,
  // DeployWalletModal enables all five policy categories by default.
  allowedCategories: 31n,
  escalationThreshold: 50000000n,
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
});

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function lower(value) {
  return typeof value === "string" ? value.toLowerCase() : value;
}

function abiFunction(abi, name) {
  const item = abi.find((candidate) => candidate.type === "function" && candidate.name === name);
  if (!item) throw new Error(`Governance addon ABI is missing ${name}.`);
  return item;
}

function abiEvent(abi, name) {
  const item = abi.find((candidate) => candidate.type === "event" && candidate.name === name);
  if (!item) throw new Error(`Governance addon ABI is missing ${name}.`);
  return item;
}

function encodeCall(abi, name, args = []) {
  return encodeFunctionData({ abi: [abiFunction(abi, name)], functionName: name, args });
}

function encodeResult(abi, name, result) {
  return encodeFunctionResult({
    abi: [abiFunction(abi, name)],
    functionName: name,
    result,
  });
}

function transaction(label, from, to, data, hash) {
  return { label, from, to, data, value: "0x0", hash };
}

function read(label, address, data, result, from) {
  return from ? { label, address, data, result, from } : { label, address, data, result };
}

function findTransaction(fixture, label) {
  const item = fixture.rpc?.transactions?.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Canonical fixture transaction is missing ${label}.`);
  return item;
}

function receiptTemplate(fixture) {
  const firstHash = fixture.rpc?.transactions?.[0]?.hash;
  const receipt = firstHash && fixture.rpc.transactionReceipts?.[firstHash];
  if (!receipt) throw new Error("Canonical fixture has no receipt template.");
  return receipt;
}

function successfulReceipt(template, transactionValue, logs = []) {
  return {
    ...clone(template),
    transactionHash: transactionValue.hash,
    from: transactionValue.from,
    to: transactionValue.to,
    logs,
    status: "0x1",
  };
}

function appendTransaction(fixture, item, receipt) {
  if (fixture.rpc.transactions.some((candidate) => lower(candidate.hash) === lower(item.hash))) {
    throw new Error(`Governance addon transaction hash already exists: ${item.hash}`);
  }
  fixture.rpc.transactions.push(item);
  fixture.rpc.transactionReceipts[item.hash] = receipt;
}

function exactPolicyTransaction(fixture) {
  const item = findTransaction(fixture, "policy.update");
  const expected = encodeCall(guardedWalletAbi, "setPolicy", [UPDATED_POLICY]);
  if (lower(item.from) !== lower(OWNER) || lower(item.to) !== lower(GOVERNED_WALLET)) {
    throw new Error("Canonical policy transaction actor or target changed.");
  }
  if (lower(item.data) !== lower(expected) || lower(item.hash) !== lower(POLICY_UPDATE_HASH)) {
    throw new Error("Canonical policy transaction is not the expected positive fixture.");
  }
  return item;
}

function exactSignerTransaction(fixture, label, functionName, signer, hash) {
  const item = findTransaction(fixture, label);
  const expected = encodeCall(guardedWalletAbi, functionName, [signer]);
  if (
    lower(item.from) !== lower(OWNER) ||
    lower(item.to) !== lower(GOVERNED_WALLET) ||
    lower(item.data) !== lower(expected) ||
    lower(item.hash) !== lower(hash)
  ) {
    throw new Error(`Canonical ${label} transaction is not exact.`);
  }
  return item;
}

function pauseReason() {
  return stringToHex(`anomaly:${ANOMALY_ID}`);
}

function makeDeploymentInputs() {
  const policy = DEPLOY_POLICY;
  return {
    owner: OWNER,
    label: DEPLOY_LABEL,
    initialPolicy: policy,
    initialSigners: [OWNER],
    escalationCouncil: [OWNER],
    escalationThreshold: 1,
    escalationExpirySeconds: 3600n,
  };
}

function deploymentCall() {
  const input = makeDeploymentInputs();
  return encodeCall(walletFactoryAbi, "createWallet", [
    input.owner,
    input.label,
    input.initialPolicy,
    input.initialSigners,
    input.escalationCouncil,
    input.escalationThreshold,
    input.escalationExpirySeconds,
  ]);
}

function deploymentPredictCall(nonce = 0n) {
  const input = makeDeploymentInputs();
  return encodeCall(walletFactoryAbi, "predictWallet", [
    input.owner,
    input.owner,
    input.label,
    nonce,
    input.initialPolicy,
    input.initialSigners,
    input.escalationCouncil,
    input.escalationThreshold,
    input.escalationExpirySeconds,
  ]);
}

function walletCreatedLog(factoryAddress) {
  const event = abiEvent(walletFactoryAbi, "WalletCreated");
  const topics = encodeEventTopics({
    abi: [event],
    eventName: "WalletCreated",
    args: { wallet: DEPLOYED_WALLET, owner: OWNER },
  });
  const data = encodeAbiParameters(
    event.inputs.filter((input) => !input.indexed),
    [DEPLOY_LABEL, 1n, DEPLOY_BLOCK_TIMESTAMP],
  );
  return {
    address: factoryAddress,
    topics,
    data,
    blockNumber: "0x3a45f03",
    transactionHash: DEPLOY_HASH,
    transactionIndex: "0x0",
    logIndex: "0x0",
    removed: false,
  };
}

function envelopeFrom(baseEnvelope, json) {
  const envelope = clone(baseEnvelope);
  if (!envelope?.result?.data) throw new Error("Fixture mutation envelope is incomplete.");
  envelope.result.data.json = json;
  envelope.result.data.meta = envelope.result.data.meta ?? {};
  return envelope;
}

function createdWalletMirror(fixture) {
  const wallet = clone(fixture.readModel?.normalized?.wallet);
  const agent = clone(fixture.readModel?.normalized?.agent);
  if (!wallet || !agent) throw new Error("Canonical normalized wallet/agent rows are required.");
  wallet.address = DEPLOYED_WALLET.toLowerCase();
  wallet.ownerAddress = OWNER.toLowerCase();
  wallet.label = DEPLOY_LABEL;
  wallet.frozen = false;
  wallet.policyVersion = 1;
  agent.walletAddress = DEPLOYED_WALLET.toLowerCase();
  agent.signerAddress = OWNER.toLowerCase();
  agent.label = DEPLOY_LABEL;
  agent.status = "active";
  agent.perTxCap = "100000000";
  agent.daily24hCap = "1000000000";
  agent.monthlyCap = "30000000000";
  agent.escalationThreshold = "50000000";
  agent.policyVersion = 1;
  return { wallet, agent };
}

function policyMirror(fixture) {
  const current = clone(fixture.readModel?.normalized?.policy);
  if (!current) throw new Error("Canonical normalized policy is required.");
  return {
    ...current,
    version: 4,
    perTxCap: "150000000",
    daily24hCap: "750000000",
    monthlyCap: "7500000000",
    escalationThreshold: "75000000",
    allowedCategories: ["api", "compute", "data"],
    requireAllowlist: true,
    freezeOnBlockedVendor: true,
  };
}

function postReadRoutes(
  fixture,
  factoryAddress,
  policyTx,
  signerAdd,
  signerRemove,
  pause,
  unpause,
) {
  const policyData = encodeCall(guardedWalletAbi, "policy");
  const signerAddData = encodeCall(guardedWalletAbi, "agentSigners", [NEW_SIGNER]);
  const signerRemoveData = encodeCall(guardedWalletAbi, "agentSigners", [AGENT_SIGNER]);
  const frozenData = encodeCall(guardedWalletAbi, "frozen");
  const ownerData = encodeCall(guardedWalletAbi, "owner");
  return {
    policy: read(
      "governedWallet.policy.after-policy.update",
      GOVERNED_WALLET,
      policyData,
      encodeResult(guardedWalletAbi, "policy", [
        UPDATED_POLICY.perTxCap,
        UPDATED_POLICY.daily24hCap,
        UPDATED_POLICY.monthlyCap,
        UPDATED_POLICY.allowedCategories,
        UPDATED_POLICY.escalationThreshold,
        UPDATED_POLICY.requireAllowlist,
        UPDATED_POLICY.freezeOnBlockedVendor,
      ]),
    ),
    signerAuthorize: read(
      "governedWallet.agentSigners(newSigner).after-authorize",
      GOVERNED_WALLET,
      signerAddData,
      encodeResult(guardedWalletAbi, "agentSigners", true),
    ),
    signerRevoke: read(
      "governedWallet.agentSigners(agentSigner).after-revoke",
      GOVERNED_WALLET,
      signerRemoveData,
      encodeResult(guardedWalletAbi, "agentSigners", false),
    ),
    pause: read(
      "governedWallet.frozen.after-pause",
      GOVERNED_WALLET,
      frozenData,
      encodeResult(guardedWalletAbi, "frozen", true),
    ),
    unpause: read(
      "governedWallet.frozen.after-unpause",
      GOVERNED_WALLET,
      frozenData,
      encodeResult(guardedWalletAbi, "frozen", false),
    ),
    deployment: {
      owner: read(
        "deployedWallet.owner.after-deploy",
        DEPLOYED_WALLET,
        ownerData,
        encodeResult(guardedWalletAbi, "owner", OWNER),
      ),
      frozen: read(
        "deployedWallet.frozen.after-deploy",
        DEPLOYED_WALLET,
        frozenData,
        encodeResult(guardedWalletAbi, "frozen", false),
      ),
      policy: read(
        "deployedWallet.policy.after-deploy",
        DEPLOYED_WALLET,
        policyData,
        encodeResult(guardedWalletAbi, "policy", [
          DEPLOY_POLICY.perTxCap,
          DEPLOY_POLICY.daily24hCap,
          DEPLOY_POLICY.monthlyCap,
          DEPLOY_POLICY.allowedCategories,
          DEPLOY_POLICY.escalationThreshold,
          DEPLOY_POLICY.requireAllowlist,
          DEPLOY_POLICY.freezeOnBlockedVendor,
        ]),
      ),
    },
    references: {
      factoryAddress,
      policyHash: policyTx.hash,
      signerAuthorizeHash: signerAdd.hash,
      signerRevokeHash: signerRemove.hash,
      pauseHash: pause.hash,
      unpauseHash: unpause.hash,
    },
  };
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

function composeFixture(baseFixture) {
  const fixture = clone(baseFixture);
  if (!fixture || fixture.schema !== FIXTURE_SCHEMA) {
    throw new Error(`Unexpected fixture schema: ${String(fixture?.schema)}`);
  }
  if (!fixture.rpc?.transactions || !fixture.rpc?.transactionReceipts) {
    throw new Error("Canonical fixture RPC transaction and receipt maps are required.");
  }
  const factoryAddress = fixture.chain?.deployment?.walletFactory;
  if (!factoryAddress) throw new Error("Canonical fixture wallet factory address is required.");

  const policyTx = exactPolicyTransaction(fixture);
  const signerAdd = exactSignerTransaction(
    fixture,
    "agentSigner.authorize",
    "addSigner",
    NEW_SIGNER,
    SIGNER_AUTHORIZE_HASH,
  );
  const signerRemove = exactSignerTransaction(
    fixture,
    "agentSigner.revoke",
    "removeSigner",
    AGENT_SIGNER,
    SIGNER_REVOKE_HASH,
  );
  const pause = transaction(
    "wallet.pause",
    OWNER,
    GOVERNED_WALLET,
    encodeCall(guardedWalletAbi, "freeze", [pauseReason()]),
    PAUSE_HASH,
  );
  const unpause = transaction(
    "wallet.unpause",
    OWNER,
    GOVERNED_WALLET,
    encodeCall(guardedWalletAbi, "unfreeze"),
    UNPAUSE_HASH,
  );
  const deploy = transaction("wallet.deploy", OWNER, factoryAddress, deploymentCall(), DEPLOY_HASH);
  const template = receiptTemplate(fixture);
  appendTransaction(fixture, pause, successfulReceipt(template, pause));
  appendTransaction(fixture, unpause, successfulReceipt(template, unpause));
  appendTransaction(
    fixture,
    deploy,
    successfulReceipt(template, deploy, [walletCreatedLog(factoryAddress)]),
  );

  const initialGovernanceReads = {
    nonce: read(
      "walletFactory.nonces(owner)",
      factoryAddress,
      encodeCall(walletFactoryAbi, "nonces", [OWNER]),
      encodeResult(walletFactoryAbi, "nonces", 0n),
    ),
    predicted: read(
      "walletFactory.predictWallet",
      factoryAddress,
      deploymentPredictCall(),
      encodeResult(walletFactoryAbi, "predictWallet", DEPLOYED_WALLET),
    ),
    signerCandidate: read(
      "governedWallet.agentSigners(newSigner)",
      GOVERNED_WALLET,
      encodeCall(guardedWalletAbi, "agentSigners", [NEW_SIGNER]),
      encodeResult(guardedWalletAbi, "agentSigners", false),
    ),
    freezeSimulation: read(
      "governedWallet.freeze.simulate",
      GOVERNED_WALLET,
      encodeCall(guardedWalletAbi, "freeze", [pauseReason()]),
      "0x",
      OWNER,
    ),
  };
  fixture.rpc.read.common.push(
    initialGovernanceReads.nonce,
    initialGovernanceReads.predicted,
    initialGovernanceReads.signerCandidate,
    initialGovernanceReads.freezeSimulation,
  );
  fixture.rpc.read.governance = {
    initial: {
      policy: fixture.rpc.read.common.find((item) => item.label === "governedWallet.policy"),
      signerAgent: fixture.rpc.read.common.find(
        (item) => item.label === "governedWallet.agentSigners(agentSigner)",
      ),
      signerCandidate: initialGovernanceReads.signerCandidate,
      freezeSimulation: initialGovernanceReads.freezeSimulation,
      frozen: fixture.rpc.read.common.find((item) => item.label === "governedWallet.frozen"),
      nonce: initialGovernanceReads.nonce,
      predicted: initialGovernanceReads.predicted,
    },
    post: postReadRoutes(
      fixture,
      factoryAddress,
      policyTx,
      signerAdd,
      signerRemove,
      pause,
      unpause,
    ),
  };

  const policyResponse = fixture.trpc.mutations?.["policies.recordDeployed"];
  if (!policyResponse) throw new Error("Canonical policy mirror envelope is required.");
  fixture.trpc.mutations["policies.recordDeployed"] = envelopeFrom(
    policyResponse,
    policyMirror(fixture),
  );
  const signerResponse = fixture.trpc.mutations?.["agents.syncSignerState"];
  if (!signerResponse) throw new Error("Canonical signer mirror envelope is required.");
  fixture.trpc.mutations["agents.syncSignerStateAuthorize"] = envelopeFrom(signerResponse, {
    dataSource: "supabase",
    signers: [AGENT_SIGNER, NEW_SIGNER],
    status: "active",
  });
  fixture.trpc.mutations["agents.syncSignerStateRevoke"] = envelopeFrom(signerResponse, {
    dataSource: "supabase",
    signers: [NEW_SIGNER],
    status: "active",
  });
  const created = createdWalletMirror(fixture);
  const createdResponse = envelopeFrom(signerResponse, {
    dataSource: "supabase",
    wallet: created.wallet,
    agent: created.agent,
  });
  fixture.trpc.mutations["agents.recordCreatedWallet"] = createdResponse;

  fixture.governanceOffline = {
    schema: ADDON_SCHEMA,
    safety: {
      transport: "offline fixture only",
      signing: "never",
      funding: "never",
      unknownTransactions: "blocked",
    },
    policy: {
      initial: INITIAL_POLICY,
      updateInput: UPDATED_POLICY,
      transactionLabel: policyTx.label,
      transactionHash: policyTx.hash,
      mirrorInput: {
        walletAddress: GOVERNED_WALLET,
        txHash: policyTx.hash,
        perTxCap: "150",
        dailyCap: "750",
        monthlyCap: "7500",
        escalationThreshold: "75",
        allowedCategories: ["api", "compute", "data"],
        requireAllowlist: true,
        freezeOnBlockedVendor: true,
      },
      expectedPostRead: fixture.rpc.read.governance.post.policy,
      expectedMirrorEnvelope: clone(fixture.trpc.mutations["policies.recordDeployed"]),
      expectedStateAfterReceipt: {
        policy: UPDATED_POLICY,
        registry: "unchanged until mirror",
      },
      expectedStateAfterMirror: {
        policy: UPDATED_POLICY,
        registry: "version 4 and updated caps",
      },
    },
    signer: {
      authorize: {
        input: { action: "authorize", signerAddress: NEW_SIGNER, walletAddress: GOVERNED_WALLET },
        transaction: signerAdd,
        expectedPostRead: fixture.rpc.read.governance.post.signerAuthorize,
        expectedMirrorEnvelope: clone(fixture.trpc.mutations["agents.syncSignerStateAuthorize"]),
      },
      revoke: {
        input: { action: "revoke", signerAddress: AGENT_SIGNER, walletAddress: GOVERNED_WALLET },
        transaction: signerRemove,
        expectedPostRead: fixture.rpc.read.governance.post.signerRevoke,
        expectedMirrorEnvelope: clone(fixture.trpc.mutations["agents.syncSignerStateRevoke"]),
      },
    },
    pause: {
      input: { walletAddress: GOVERNED_WALLET, reason: pauseReason(), anomalyId: ANOMALY_ID },
      transaction: pause,
      expectedPostRead: fixture.rpc.read.governance.post.pause,
      expectedStateAfterReceipt: { frozen: true, mirror: "anomalies.acknowledge" },
      mirrorInput: { anomalyId: ANOMALY_ID },
      expectedMirrorEnvelope: clone(fixture.trpc.mutations["anomalies.acknowledge"]),
    },
    unpause: {
      input: { walletAddress: GOVERNED_WALLET },
      transaction: unpause,
      expectedPostRead: fixture.rpc.read.governance.post.unpause,
      expectedStateAfterReceipt: { frozen: false, mirror: "unsupported-by-current-UI" },
      expectedMirrorEnvelope: null,
    },
    deploy: {
      input: {
        ...makeDeploymentInputs(),
        deployTxHash: deploy.hash,
        predictedWallet: DEPLOYED_WALLET,
      },
      mirrorInput: {
        walletAddress: DEPLOYED_WALLET,
        ownerAddress: OWNER,
        label: DEPLOY_LABEL,
        deployTxHash: deploy.hash,
        chainId: fixture.rpc.chainId,
        perTxCap: "100",
        dailyCap: "1000",
        monthlyCap: "30000",
        escalationThreshold: "50",
        requireAllowlist: true,
        freezeOnBlockedVendor: true,
        signers: [OWNER],
        council: [OWNER],
        quorum: 1,
      },
      transaction: deploy,
      receipt: fixture.rpc.transactionReceipts[deploy.hash],
      expectedPostReads: fixture.rpc.read.governance.post.deployment,
      expectedMirrorEnvelope: clone(fixture.trpc.mutations["agents.recordCreatedWallet"]),
      expectedStateAfterReceipt: {
        wallet: DEPLOYED_WALLET,
        owner: OWNER,
        label: DEPLOY_LABEL,
        registry: "unchanged until agents.recordCreatedWallet",
      },
      expectedStateAfterMirror: {
        wallet: DEPLOYED_WALLET,
        owner: OWNER,
        registry: "supabase mirror success envelope",
      },
    },
    integrationContract: {
      transactionBoundary:
        "Match exact {from,to,data,value} against rpc.transactions; reject every other transaction.",
      receiptBoundary:
        "Require rpc.transactionReceipts[hash].status === 0x1 before any mirror mutation.",
      postReadBoundary:
        "After the receipt, route only governanceOffline.*.expectedPostRead(s) for that action.",
      mirrorBoundary:
        "Require the exact input and return governanceOffline.*.expectedMirrorEnvelope; no generic success.",
      deployProof:
        "Require the configured factory WalletCreated log with DEPLOYED_WALLET and OWNER before recordCreatedWallet.",
    },
    unsupported: [
      "No unfreeze/unpause button is exposed by the current web UI; wallet.unpause is fixture-ready for a future owner control only.",
      "The current agents.freeze/unfreeze API intentionally rejects writes; pause is exposed through the anomaly freeze path and mirrors with anomalies.acknowledge.",
      "No funding, gas, CCTP, SIWE, private key, signing, or live transport is supported.",
    ],
  };
  fixture.routingInstructions.governance = [
    "Use only governanceOffline transaction objects and their exact receipts; unknown transaction calldata remains blocked.",
    "Do not call a mirror mutation until its listed receipt status is 0x1 and post-read matches the listed ABI result.",
    "For policy and signer actions, use the listed action-specific mirror envelope rather than the canonical generic mutation envelope.",
    "For deployment, verify the WalletCreated log from the configured factory, owner, label, and predicted wallet before the recordCreatedWallet envelope.",
  ];
  return fixture;
}

function composeBundle(bundle) {
  if (!bundle || !bundle.fixture) throw new Error("Governance addon requires a fixture bundle.");
  const fixture = composeFixture(bundle.fixture);
  return {
    ...bundle,
    fixture,
    unsupported: [...(bundle.unsupported || []), ...fixture.governanceOffline.unsupported],
  };
}

function assertFixtureRoutes(fixture) {
  if (fixture?.governanceOffline?.schema !== ADDON_SCHEMA) {
    throw new Error("Governance addon metadata is missing.");
  }
  if (
    INITIAL_POLICY.escalationThreshold > INITIAL_POLICY.perTxCap ||
    UPDATED_POLICY.escalationThreshold > UPDATED_POLICY.perTxCap ||
    DEPLOY_POLICY.escalationThreshold > DEPLOY_POLICY.perTxCap
  ) {
    throw new Error("Positive governance policy fixture violates threshold <= perTxCap.");
  }
  const transactionLabels = [
    "policy.update",
    "agentSigner.authorize",
    "agentSigner.revoke",
    "wallet.pause",
    "wallet.unpause",
    "wallet.deploy",
  ];
  for (const label of transactionLabels) {
    const item = fixture.rpc.transactions.find((candidate) => candidate.label === label);
    if (!item) throw new Error(`Governance transaction route is missing ${label}.`);
    const receipt = fixture.rpc.transactionReceipts[item.hash];
    if (
      !receipt ||
      receipt.status !== "0x1" ||
      lower(receipt.transactionHash) !== lower(item.hash)
    ) {
      throw new Error(`Governance transaction receipt is incomplete for ${label}.`);
    }
  }
  const deploy = fixture.governanceOffline.deploy;
  const log = deploy.receipt?.logs?.[0];
  if (
    !log ||
    lower(log.address) !== lower(fixture.chain.deployment.walletFactory) ||
    !Array.isArray(log.topics) ||
    log.topics.length !== 3 ||
    lower(log.data) !== lower(fixture.rpc.transactionReceipts[DEPLOY_HASH].logs[0].data)
  ) {
    throw new Error(
      "Governed-wallet deployment receipt does not contain the exact WalletCreated log.",
    );
  }
  return Object.freeze({
    exactTransactions: transactionLabels.length,
    exactPostReads: 7,
    exactMirrorEnvelopes: 5,
    unknownTransactions: "blocked",
    signing: "none",
  });
}

const BROWSER_INSTALL_RECIPE = Object.freeze({
  source: "arcanum/apps/web/test-fixtures/governance-offline-addon.cjs",
  fixture: ".local/audits/arcanum-2026-09-12/fixtures/governance-offline.json",
  steps: Object.freeze([
    "Load the canonical bundle with ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs }).",
    "Read governance-offline.json with JSON.parse(await fs.readFile(path, 'utf8')).",
    "Pass { ...bundle, fixture } to ArcanumClosureNotebookFullAdapter.loadFullFixtureBundle({ bundle: transformedBundle, fs, io }).",
    "Install the full harness before navigation; use the closure-browser-harness post-state hook contract below.",
    "For each action, submit only governanceOffline.*.transaction and wait for its exact 0x1 receipt before the listed mirror envelope.",
  ]),
  constraints: Object.freeze([
    "Offline fixture routes only; no app edits, browser launches, builds, or live network calls are part of this recipe.",
    "Never add a private key, signature, funding request, SIWE request, or arbitrary transaction allowlist.",
    "A simulated result must be reported as SIMULATED FIXTURE SUCCESS.",
  ]),
});
const BROWSER_INSTALL_RECIPE_SOURCE = [
  "const baseBundle = await ArcanumClosureNotebookAdapter.loadFixtureBundle({ fs });",
  "const path = '.local/audits/arcanum-2026-09-12/fixtures/governance-offline.json';",
  "const fixture = JSON.parse(await fs.readFile(path, 'utf8'));",
  "const transformedBundle = { ...baseBundle, fixture };",
  "const loaded = await ArcanumClosureNotebookFullAdapter.loadFullFixtureBundle({ fs, io, bundle: transformedBundle });",
  "const harness = await loaded.installFullFixtureHarness(page, { mode: 'owner' });",
  "const contract = fixture.governanceOffline.integrationContract;",
  "// closure-browser-harness owns the action-specific post-state hook.",
].join("\n");

module.exports = {
  ADDON_SCHEMA,
  BROWSER_INSTALL_RECIPE,
  BROWSER_INSTALL_RECIPE_SOURCE,
  DEPLOYED_WALLET,
  DEPLOY_HASH,
  GOVERNED_WALLET,
  INITIAL_POLICY,
  UPDATED_POLICY,
  composeBundle,
  composeFixture,
  assertFixtureRoutes,
  encodeCall,
  makeDeploymentInputs,
  deploymentCall,
};
