/**
 * Build the deterministic browser fixture used by the 2026-09-12
 * remediation audit.
 *
 * This is intentionally a builder rather than a hand-edited JSON blob. The
 * read-model values go through the same Supabase mappers used by the API, and
 * the RPC values go through the published contract ABIs. Run from arcanum:
 *
 *   ./node_modules/.bin/tsx apps/web/test-fixtures/build-remediation-fixtures.ts
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { EscalationManagerAbi, GuardedWalletAbi } from "@arcanum/contracts";
import superjson from "superjson";
import {
  type Abi,
  type Address,
  type Hex,
  type RpcTransactionReceipt,
  encodeFunctionData,
  encodeFunctionResult,
  formatTransactionReceipt,
  keccak256,
  stringToHex,
  toBytes,
} from "viem";

import { ARC_CHAIN_ID } from "@arcanum/shared";
import type { SupabaseRow } from "../../../packages/api/src/supabase/client";
import {
  agentFromSigner,
  anomalyFromRow,
  escalationFromRow,
  policyFromDoctrineRow,
  postureFromDoctrineRow,
  publicProfileFromRow,
  transferFromRow,
  vendorFromRow,
  walletFromGovernedWalletRow,
} from "../../../packages/api/src/supabase/mappers";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceDirectory = resolve(scriptDirectory, "../../../../");
const outputPath = resolve(
  workspaceDirectory,
  ".local/audits/arcanum-2026-09-12/remediation-fixtures.json",
);
const receiptPath = resolve(
  workspaceDirectory,
  ".local/audits/arcanum-2026-09-12/fixtures/pdr-valid.json",
);

const TENANT_ID = "11111111-1111-4111-8111-111111111111";
const ORG_ID = "22222222-2222-4222-8222-222222222222";
const WALLET_ID = "33333333-3333-4333-8333-333333333333";
const OWNER = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8" as const;
const VIEWER = "0x3000000000000000000000000000000000000003" as const;
const AGENT_SIGNER = "0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc" as const;
const NEW_SIGNER = "0x4000000000000000000000000000000000000004" as const;
const GOVERNED_WALLET = "0x1000000000000000000000000000000000000001" as const;
const VENDOR = "0x2000000000000000000000000000000000000002" as const;
const NEW_VENDOR = "0x3000000000000000000000000000000000000003" as const;
const ESCALATION_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as const;
const BLOCK_HASH = "0xabababababababababababababababababababababababababababababababab" as const;
const repeatedHash = (character: string) => `0x${character.repeat(64)}` as Hex;
const TX_ALLOW = repeatedHash("a");
const TX_ESCALATED = repeatedHash("b");
const TX_DENIED = repeatedHash("c");
const TX_APPROVE = repeatedHash("1");
const TX_REJECT = repeatedHash("2");
const TX_CANCEL = repeatedHash("3");
const TX_SIGNER_ADD = repeatedHash("4");
const TX_SIGNER_REMOVE = repeatedHash("5");
const TX_POLICY = repeatedHash("6");
const TX_VENDOR_ADD = repeatedHash("7");
const TX_VENDOR_BLOCK = repeatedHash("8");
const TX_VENDOR_REMOVE = repeatedHash("9");
const TX_VENDOR_CAP = repeatedHash("d");

// The canonical mapper evaluates its owner fallback eagerly even when the row
// contains owner_address. Set only this fixed fixture value; never inherit a
// developer's or deployment's wallet identity.
process.env.ARCANUM_DEMO_OWNER_WALLET = OWNER;

const deployment = {
  escalationManager: "0xb5907700Df79B9030FafDaA48C26AE355512cCcd" as const,
  walletFactory: "0xbE1bC48F26e7166D872828d40e82A6407dbD350C" as const,
};

type JsonRecord = Record<string, unknown>;

function withSyntheticTenant<T extends { tenantId: string }>(value: T): T {
  return { ...value, tenantId: TENANT_ID };
}

function encodeData(abi: Abi, functionName: string, args: readonly unknown[] = []): Hex {
  return encodeFunctionData({
    abi,
    functionName,
    args,
  });
}

function encodeResult(abi: Abi, functionName: string, result: unknown): Hex {
  return encodeFunctionResult({
    abi,
    functionName,
    result,
  });
}

function trpcEnvelope(value: unknown): JsonRecord {
  const serialized = superjson.serialize(value);
  return {
    result: {
      data: {
        json: serialized.json,
        // Keep the meta member present even for a plain JSON response. This
        // makes the fixture shape explicit to a route handler and is accepted
        // by superjson.deserialize.
        meta: serialized.meta ?? {},
      },
    },
  };
}

function page(rows: unknown[], scope: "tenant-wallets" | "public-wallet" = "tenant-wallets") {
  return {
    rows,
    // The final ledger envelope deliberately keeps this nullable: a bounded
    // read may honestly report that more rows exist without inventing an
    // exact count.
    totalCount: null,
    page: 0,
    pageSize: 100,
    hasNext: false,
    hasPrevious: false,
    subset: "page",
    scope,
  };
}

function rpcCall(label: string, address: string, data: Hex, result: Hex, extra: JsonRecord = {}) {
  return {
    label,
    address,
    data,
    result,
    ...extra,
  };
}

function transaction(label: string, to: Address, data: Hex, hash: Hex, from: Address = OWNER) {
  return { label, from, to, data, value: "0x0", hash };
}

async function build() {
  const receiptEnvelope = JSON.parse(await readFile(receiptPath, "utf8"));

  // These rows deliberately use the same field names and decimal-USDC
  // compatibility fields that the production Supabase adapter accepts.
  const walletRow: SupabaseRow = {
    id: WALLET_ID,
    organization_id: ORG_ID,
    wallet_address: GOVERNED_WALLET,
    label: "Treasury Agent",
    owner_address: OWNER,
    created_block: 60951840,
    created_at: "2026-09-08T10:00:00.000Z",
    wallet_factory_address: deployment.walletFactory,
    status: "active",
    policy_version: 3,
  };
  const wallet = withSyntheticTenant(walletFromGovernedWalletRow(walletRow));

  const doctrineRow: SupabaseRow = {
    id: "55555555-5555-4555-8555-555555555555",
    governed_wallet_id: WALLET_ID,
    version: 3,
    per_tx_cap_usdc: "100",
    daily_cap_usdc: "500",
    monthly_cap_usdc: "5000",
    allowed_categories: ["api", "compute", "data"],
    escalate_above_usdc: "50",
    require_vendor_allowlist: true,
    freeze_on_blocked_vendor: true,
    signers: [AGENT_SIGNER],
    status: "active",
    updated_at: "2026-09-10T09:00:00.000Z",
  };
  const posture = postureFromDoctrineRow(doctrineRow, wallet.frozen);
  const agent = withSyntheticTenant(agentFromSigner(wallet, AGENT_SIGNER, doctrineRow, posture));
  const policy = withSyntheticTenant(policyFromDoctrineRow(doctrineRow, wallet));

  const transferRows: SupabaseRow[] = [
    {
      id: "66666666-6666-4666-8666-666666666661",
      tenant_id: TENANT_ID,
      wallet_id: WALLET_ID,
      agent_id: agent.id,
      tx_hash: TX_ALLOW,
      block_number: 61000001,
      event_time: "2026-09-10T09:45:00.000Z",
      to_address: VENDOR,
      amount: "12.500000",
      verdict: "ALLOW",
      decision_reason: "Within policy caps and the vendor is allowlisted.",
      vendor_category: "compute",
      daily_spent_after: "1.000000",
    },
    {
      id: "66666666-6666-4666-8666-666666666662",
      tenant_id: TENANT_ID,
      wallet_id: WALLET_ID,
      agent_id: agent.id,
      tx_hash: TX_ESCALATED,
      block_number: 61000002,
      event_time: "2026-09-10T09:50:00.000Z",
      to_address: VENDOR,
      amount: "75.000000",
      verdict: "ESCALATE",
      decision_reason: "Amount exceeds the escalation threshold.",
      vendor_category: "compute",
      daily_spent_after: "13.500000",
    },
    {
      id: "66666666-6666-4666-8666-666666666663",
      tenant_id: TENANT_ID,
      wallet_id: WALLET_ID,
      agent_id: agent.id,
      tx_hash: TX_DENIED,
      block_number: 61000003,
      event_time: "2026-09-10T09:55:00.000Z",
      to_address: VENDOR,
      amount: "7.250000",
      verdict: "DENY",
      decision_reason: "Vendor is blocked by policy.",
      vendor_category: "compute",
      daily_spent_after: "13.500000",
    },
  ];
  const transfers = transferRows.map((row) => withSyntheticTenant(transferFromRow(row, [wallet])));

  const escalationRow: SupabaseRow = {
    id: ESCALATION_ID,
    escalation_key: ESCALATION_ID,
    tenant_id: TENANT_ID,
    governed_wallet_id: WALLET_ID,
    to_address: VENDOR,
    counterparty_address: VENDOR,
    amount: "75.000000",
    reason: "Amount exceeds the escalation threshold.",
    created_at: "2026-09-10T09:50:00.000Z",
    expires_at: "2099-09-10T09:50:00.000Z",
    status: "pending",
    approvals_count: 1,
    quorum_required: 2,
    signers: [AGENT_SIGNER],
    policy_version: 3,
  };
  const escalation = withSyntheticTenant(escalationFromRow(escalationRow, [wallet]));
  const anomaly = withSyntheticTenant(
    anomalyFromRow(
      {
        id: "77777777-7777-4777-8777-777777777777",
        tenant_id: TENANT_ID,
        governed_wallet_id: WALLET_ID,
        agent_id: agent.id,
        score: "3.7",
        description: "Counterparty spend deviates from the agent baseline.",
        block_number: 61000003,
        tx_hash: TX_DENIED,
        severity: "high",
        detected_at: "2026-09-10T09:56:00.000Z",
      },
      [wallet],
    ),
  );
  const vendor = vendorFromRow(
    {
      id: "88888888-8888-4888-8888-888888888888",
      tenant_id: TENANT_ID,
      organization_id: ORG_ID,
      vendor_address: VENDOR,
      name: "Compute Harbor",
      category: "compute",
      status: "allowed",
      confidential: false,
      metadata_hash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      created_at: "2026-09-01T12:00:00.000Z",
    },
    wallet,
  );

  const members = [
    {
      id: "99999999-9999-4999-8999-999999999999",
      displayName: "Workspace Owner",
      walletAddress: OWNER,
      role: "owner",
      createdAt: new Date("2026-09-01T10:00:00.000Z"),
    },
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      displayName: "Review Viewer",
      walletAddress: VIEWER,
      role: "viewer",
      createdAt: new Date("2026-09-01T10:05:00.000Z"),
    },
  ];
  const orgBase = {
    id: ORG_ID,
    tenantId: TENANT_ID,
    name: "Synthetic Treasury Workspace",
    type: "DAO" as const,
    createdAt: new Date("2026-09-01T09:00:00.000Z"),
    ownerWallet: OWNER,
    multisigAddress: OWNER,
    chainId: ARC_CHAIN_ID,
    isSignedIn: true,
    hasWorkspace: true,
    hasCustomName: true,
  };
  const orgOwner = { ...orgBase, callerRole: "owner" };
  const orgViewer = { ...orgBase, callerRole: "viewer" };

  const publicProfile = publicProfileFromRow(
    {
      wallet_address: GOVERNED_WALLET,
      label: "Treasury Agent",
      posture_score: posture,
      status: "FORTIFIED",
      total_spend: "12500000",
      threats_blocked: 1,
      governed_days: 4,
      data_source: "supabase",
    },
    "supabase",
  );
  const escalationPublic = {
    escalationKey: ESCALATION_ID,
    walletAddress: GOVERNED_WALLET,
    chainId: ARC_CHAIN_ID,
    amount: "75000000",
    amountBaseUnits: "75000000",
    counterpartyAddress: VENDOR,
    counterparty: VENDOR,
    threshold: 2,
    signatureCount: 1,
    expiresAt: new Date("2099-09-10T09:50:00.000Z"),
    status: "PENDING",
    policyVersion: 3,
  };

  const ledgerPage = page(transfers);
  const publicLedgerPage = page(transfers, "public-wallet");
  const commonResponses: Record<string, unknown> = {
    "agents.list": { agents: [agent], legacyWalletCount: 0 },
    "wallets.list": [wallet],
    "ledger.list": ledgerPage,
    "ledger.byWallet": ledgerPage,
    "escalations.list": [escalation],
    "escalations.publicByKey": escalationPublic,
    "anomalies.list": [anomaly],
    "vendors.list": [{ ...vendor, tenantId: TENANT_ID }],
    "vendorFlags.list": [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        tenantId: TENANT_ID,
        vendorAddress: VENDOR,
        flaggedBy: OWNER,
        note: "Review unusual concentration before approving.",
        noteUpdatedBy: null,
        noteUpdatedAt: null,
        removedBy: null,
        removedAt: null,
        createdAt: new Date("2026-09-10T08:00:00.000Z"),
      },
    ],
    "vendorFlags.history": [
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        vendorAddress: VENDOR,
        eventType: "flagged",
        actor: OWNER,
        note: "Review unusual concentration before approving.",
        createdAt: new Date("2026-09-10T08:00:00.000Z"),
      },
    ],
    "events.list": [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        tenantId: TENANT_ID,
        walletId: WALLET_ID,
        type: "TRANSFER_DENIED",
        severity: "danger",
        payload: { category: "compute", amountUsdc: 7.25 },
        blockNumber: 61000003,
        txHash: TX_DENIED,
        timestamp: new Date("2026-09-10T09:55:00.000Z"),
      },
    ],
    "org.getCurrent": orgOwner,
    "org.currentOrg": orgOwner,
    "org.members": members,
    "org.listMembers": members,
    "analytics.postureIndex": posture,
    "analytics.valueGoverned24h": {
      valueBaseUnits: "12500000",
      movementCount: 1,
      outcome: "ALLOW",
      windowStart: "2026-09-09T10:00:00.000Z",
      windowEnd: "2026-09-10T10:00:00.000Z",
      complete: true,
    },
    "analytics.walletActivity24h": {
      rows: [
        {
          walletId: WALLET_ID,
          spendBaseUnits: "12500000",
          lastActivityAt: "2026-09-10T09:55:00.000Z",
        },
      ],
      windowStart: "2026-09-09T10:00:00.000Z",
      windowEnd: "2026-09-10T10:00:00.000Z",
      complete: true,
    },
    "analytics.activeAgents": 1,
    "analytics.threatsBlocked24h": {
      count: 1,
      outcomes: ["DENY", "FREEZE"],
      windowStart: "2026-09-09T10:00:00.000Z",
      windowEnd: "2026-09-10T10:00:00.000Z",
      complete: true,
    },
    "analytics.pendingEscalations": 1,
    "policies.readOnChain": {
      owner: OWNER,
      policy: {
        perTxCap: "100000000",
        daily24hCap: "500000000",
        monthlyCap: "5000000000",
        allowedCategories: "7",
        escalationThreshold: "50000000",
        requireAllowlist: true,
        freezeOnBlockedVendor: true,
      },
    },
    "policies.get": policy,
    "policies.count": 1,
    "wallets.publicProfile": publicProfile,
    "receipts.list": {
      items: [
        {
          receipt: receiptEnvelope,
          walletLabel: wallet.label,
          createdAt: receiptEnvelope.receipt.issuedAt,
        },
      ],
      nextCursor: null,
    },
    "receipts.get": {
      receipt: receiptEnvelope,
      evidence: [],
      wallet: { id: WALLET_ID, label: wallet.label, ownerAddress: OWNER },
      createdAt: receiptEnvelope.receipt.issuedAt,
    },
    "receipts.issuers": [
      {
        keyId: receiptEnvelope.receipt.issuer.keyId,
        address: receiptEnvelope.receipt.issuer.address,
      },
    ],
    "health.ping": {
      ok: true,
      supabase: {
        api: { status: "available", urlConfigured: true, anonKeyConfigured: true, error: null },
        serviceRole: { status: "configured" },
        readModel: { status: "available", sampleRows: 1, error: null },
        indexerCheckpoint: {
          status: "available",
          lastIndexedBlock: 61000003,
          lastSeenChainBlock: 61000003,
          lastIndexedAt: "2026-09-10T09:56:00.000Z",
          lastEventAt: "2026-09-10T09:56:00.000Z",
          lastCatchupAt: "2026-09-10T09:56:00.000Z",
          error: null,
        },
      },
      redisVersion: "unconfigured",
      indexer: {
        status: "available",
        lastIndexedBlock: 61000003,
        lastSeenChainBlock: 61000003,
        lastIndexedAt: "2026-09-10T09:56:00.000Z",
        lastEventAt: "2026-09-10T09:56:00.000Z",
        lastCatchupAt: "2026-09-10T09:56:00.000Z",
        error: null,
      },
      rpc: { status: "available", latestBlock: "61000003", error: null },
      deploymentMode: "supabase",
    },
  };

  const contextResponses = {
    owner: {
      "org.getCurrent": trpcEnvelope(orgOwner),
      "org.currentOrg": trpcEnvelope(orgOwner),
    },
    viewer: {
      "org.getCurrent": trpcEnvelope(orgViewer),
      "org.currentOrg": trpcEnvelope(orgViewer),
    },
  };
  const trpcResponses: Record<string, { response: JsonRecord; input: JsonRecord | null }> =
    Object.fromEntries(
      Object.entries(commonResponses).map(([procedure, value]) => [
        procedure,
        {
          response: trpcEnvelope(value),
          input: null,
        },
      ]),
    );
  const receiptId = receiptEnvelope.receipt.receiptId;
  trpcResponses["receipts.get"] = {
    input: { receiptId },
    response: trpcEnvelope(commonResponses["receipts.get"]),
  };
  trpcResponses["ledger.byWallet"] = {
    input: { wallet: GOVERNED_WALLET, page: 0, pageSize: 100 },
    response: trpcEnvelope(publicLedgerPage),
  };
  trpcResponses["escalations.publicByKey"] = {
    input: { escalationKey: ESCALATION_ID },
    response: trpcEnvelope(escalationPublic),
  };
  trpcResponses["wallets.publicProfile"] = {
    input: { address: GOVERNED_WALLET },
    response: trpcEnvelope(publicProfile),
  };
  trpcResponses["policies.readOnChain"] = {
    input: { walletAddress: GOVERNED_WALLET },
    response: trpcEnvelope(commonResponses["policies.readOnChain"]),
  };

  const pendingEscalationResult = [
    GOVERNED_WALLET,
    VENDOR,
    75000000n,
    stringToHex("Amount exceeds the escalation threshold."),
    1789033800n,
    4081769400n,
    2n,
    1,
    0,
    3n,
    1n,
  ];
  const deniedEscalationResult = [
    GOVERNED_WALLET,
    VENDOR,
    75000000n,
    stringToHex("Amount exceeds the escalation threshold."),
    1789033800n,
    4081769400n,
    2n,
    2,
    4,
    3n,
    1n,
  ];
  const rejectedEscalationResult = [
    GOVERNED_WALLET,
    VENDOR,
    75000000n,
    stringToHex("Amount exceeds the escalation threshold."),
    1789033800n,
    4081769400n,
    2n,
    1,
    2,
    3n,
    1n,
  ];
  const cancelledEscalationResult = [
    GOVERNED_WALLET,
    VENDOR,
    75000000n,
    stringToHex("Amount exceeds the escalation threshold."),
    1789033800n,
    4081769400n,
    2n,
    1,
    5,
    3n,
    1n,
  ];
  const rpcRead = {
    common: [
      rpcCall("governedWallet.getCode", GOVERNED_WALLET, "0x", "0x60006000"),
      rpcCall(
        "governedWallet.owner",
        GOVERNED_WALLET,
        encodeData(GuardedWalletAbi, "owner"),
        encodeResult(GuardedWalletAbi, "owner", OWNER),
      ),
      rpcCall(
        "governedWallet.agentSigners(agentSigner)",
        GOVERNED_WALLET,
        encodeData(GuardedWalletAbi, "agentSigners", [AGENT_SIGNER]),
        encodeResult(GuardedWalletAbi, "agentSigners", true),
      ),
      rpcCall(
        "governedWallet.frozen",
        GOVERNED_WALLET,
        encodeData(GuardedWalletAbi, "frozen"),
        encodeResult(GuardedWalletAbi, "frozen", false),
      ),
      rpcCall(
        "governedWallet.policy",
        GOVERNED_WALLET,
        encodeData(GuardedWalletAbi, "policy"),
        encodeResult(GuardedWalletAbi, "policy", [
          100000000n,
          500000000n,
          5000000000n,
          7n,
          50000000n,
          true,
          true,
        ]),
      ),
    ],
    approver: {
      initial: rpcCall(
        "escalationManager.getEscalation.pending",
        deployment.escalationManager,
        encodeData(EscalationManagerAbi, "getEscalation", [ESCALATION_ID]),
        encodeResult(EscalationManagerAbi, "getEscalation", pendingEscalationResult),
      ),
      settled: {
        approve: rpcCall(
          "escalationManager.getEscalation.denied",
          deployment.escalationManager,
          encodeData(EscalationManagerAbi, "getEscalation", [ESCALATION_ID]),
          encodeResult(EscalationManagerAbi, "getEscalation", deniedEscalationResult),
        ),
        reject: rpcCall(
          "escalationManager.getEscalation.rejected",
          deployment.escalationManager,
          encodeData(EscalationManagerAbi, "getEscalation", [ESCALATION_ID]),
          encodeResult(EscalationManagerAbi, "getEscalation", rejectedEscalationResult),
        ),
        cancel: rpcCall(
          "escalationManager.getEscalation.cancelled",
          deployment.escalationManager,
          encodeData(EscalationManagerAbi, "getEscalation", [ESCALATION_ID]),
          encodeResult(EscalationManagerAbi, "getEscalation", cancelledEscalationResult),
        ),
      },
      isRequiredSignerOwner: rpcCall(
        "escalationManager.isRequiredSigner(owner)",
        deployment.escalationManager,
        encodeData(EscalationManagerAbi, "isRequiredSigner", [GOVERNED_WALLET, OWNER]),
        encodeResult(EscalationManagerAbi, "isRequiredSigner", true),
      ),
      isRequiredSignerViewer: rpcCall(
        "escalationManager.isRequiredSigner(viewer)",
        deployment.escalationManager,
        encodeData(EscalationManagerAbi, "isRequiredSigner", [GOVERNED_WALLET, VIEWER]),
        encodeResult(EscalationManagerAbi, "isRequiredSigner", false),
      ),
      signedFalse: rpcCall(
        "escalationManager.signed(false)",
        deployment.escalationManager,
        encodeData(EscalationManagerAbi, "signed", [ESCALATION_ID, OWNER]),
        encodeResult(EscalationManagerAbi, "signed", false),
      ),
      signedFalseViewer: rpcCall(
        "escalationManager.signed(false, viewer)",
        deployment.escalationManager,
        encodeData(EscalationManagerAbi, "signed", [ESCALATION_ID, VIEWER]),
        encodeResult(EscalationManagerAbi, "signed", false),
      ),
    },
  };

  const policyEnvelope = {
    perTxCap: 150000000n,
    daily24hCap: 750000000n,
    monthlyCap: 7500000000n,
    allowedCategories: 7n,
    escalationThreshold: 75000000n,
    requireAllowlist: true,
    freezeOnBlockedVendor: true,
  };
  const vendorMetadata = (name: string, suffix: string) =>
    keccak256(toBytes(`arcanum-vendor:${name}:${NEW_VENDOR}:${suffix}`));
  const transactions = [
    transaction(
      "escalation.approve",
      deployment.escalationManager,
      encodeData(EscalationManagerAbi, "approve", [ESCALATION_ID]),
      TX_APPROVE,
    ),
    transaction(
      "escalation.reject",
      deployment.escalationManager,
      encodeData(EscalationManagerAbi, "reject", [ESCALATION_ID]),
      TX_REJECT,
    ),
    transaction(
      "escalation.cancel",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "cancelEscalation", [ESCALATION_ID]),
      TX_CANCEL,
    ),
    transaction(
      "agentSigner.authorize",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "addSigner", [NEW_SIGNER]),
      TX_SIGNER_ADD,
    ),
    transaction(
      "agentSigner.revoke",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "removeSigner", [AGENT_SIGNER]),
      TX_SIGNER_REMOVE,
    ),
    transaction(
      "policy.update",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "setPolicy", [policyEnvelope]),
      TX_POLICY,
    ),
    transaction(
      "vendor.add",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "addVendor", [
        NEW_VENDOR,
        1,
        250000000n,
        vendorMetadata("Cloud Compute", "Synthetic vendor"),
      ]),
      TX_VENDOR_ADD,
    ),
    transaction(
      "vendor.block",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "blockVendor", [VENDOR]),
      TX_VENDOR_BLOCK,
    ),
    transaction(
      "vendor.remove",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "removeVendor", [VENDOR]),
      TX_VENDOR_REMOVE,
    ),
    transaction(
      "vendor.cap-update",
      GOVERNED_WALLET,
      encodeData(GuardedWalletAbi, "addVendor", [
        VENDOR,
        1,
        125000000n,
        keccak256(toBytes(`arcanum-vendor:Compute Harbor:${VENDOR}:cap-update`)),
      ]),
      TX_VENDOR_CAP,
    ),
  ];

  const receipt = (item: (typeof transactions)[number]): RpcTransactionReceipt => ({
    transactionHash: item.hash,
    transactionIndex: "0x0",
    blockHash: BLOCK_HASH,
    blockNumber: "0x3a45f03",
    from: item.from,
    to: item.to,
    cumulativeGasUsed: "0x5208",
    gasUsed: "0x5208",
    contractAddress: null,
    logs: [],
    logsBloom: `0x${"00".repeat(256)}` as Hex,
    // This object is returned directly from the synthetic eth_getTransactionReceipt
    // handler, so keep the JSON-RPC status code here. Viem's formatter turns
    // 0x1 into "success" after the response has crossed the RPC boundary.
    status: "0x1" as const,
    effectiveGasPrice: "0x1",
    type: "0x2",
  });
  const transactionReceipts = Object.fromEntries(
    transactions.map((item) => [item.hash, receipt(item)]),
  );
  for (const [hash, rawReceipt] of Object.entries(transactionReceipts)) {
    if (rawReceipt.status !== "0x1") {
      throw new Error(`Synthetic receipt ${hash} must use raw JSON-RPC status 0x1.`);
    }
    const formattedReceipt = formatTransactionReceipt(rawReceipt);
    if (formattedReceipt.status !== "success") {
      throw new Error(`Synthetic receipt ${hash} did not format to viem success.`);
    }
  }
  const rpc = {
    chainId: ARC_CHAIN_ID,
    read: rpcRead,
    generic: {
      eth_blockNumber: "0x3a45f03",
      eth_getCode: "0x60006000",
      eth_estimateGas: "0x5208",
      eth_gasPrice: "0x1",
      eth_getTransactionCount: "0x0",
    },
    transactionReceipts,
    transactions,
  };

  const mutationResponses = {
    "agents.syncSignerState": trpcEnvelope({
      dataSource: "supabase",
      signers: [AGENT_SIGNER, NEW_SIGNER],
      status: "active",
    }),
    "escalations.recordDecision": trpcEnvelope({
      id: ESCALATION_ID,
      status: "released",
      approvalsCount: 2,
      txHash: TX_APPROVE,
    }),
    "vendors.recordOnChainState": trpcEnvelope({
      id: "88888888-8888-4888-8888-888888888888",
      address: VENDOR,
      category: "compute",
      status: "allowed",
      perVendorCap: "0",
    }),
    "policies.recordDeployed": trpcEnvelope({
      ...policy,
      version: 4,
    }),
    "vendorFlags.flag": trpcEnvelope({ flagged: true }),
    "vendorFlags.updateNote": trpcEnvelope({ flagged: true }),
    "vendorFlags.unflag": trpcEnvelope({ flagged: false }),
    "anomalies.acknowledge": trpcEnvelope({ anomaly, acknowledged: true }),
    "anomalies.dismiss": trpcEnvelope({ anomaly, dismissed: true }),
    "org.update": trpcEnvelope({
      organization: orgOwner,
      defaultPolicyTemplate: "balanced",
      notifications: true,
    }),
  };

  const fixture = {
    schema: "arcanum.remediation-browser-fixtures.v1",
    generatedAt: "2026-09-12T00:00:00.000Z",
    chain: {
      id: ARC_CHAIN_ID,
      name: "Arc Testnet",
      deployment,
      token: {
        symbol: "USDC",
        decimals: 6,
        address: "0x3600000000000000000000000000000000000000",
      },
    },
    identities: {
      tenantId: TENANT_ID,
      orgId: ORG_ID,
      walletId: WALLET_ID,
      agentId: agent.id,
      governedWallet: GOVERNED_WALLET,
      owner: OWNER,
      viewer: VIEWER,
      agentSigner: AGENT_SIGNER,
      newSigner: NEW_SIGNER,
      vendor: VENDOR,
      newVendor: NEW_VENDOR,
      escalationId: ESCALATION_ID,
      receiptId,
    },
    readModel: {
      rows: {
        governedWallet: walletRow,
        doctrine: doctrineRow,
        transfers: transferRows,
        escalation: escalationRow,
      },
      normalized: { wallet, agent, policy, transfers, escalation, anomaly, vendor },
    },
    receipt: {
      // This is copied from pdr-valid.json at build time. No field in the
      // signed body or its signature is altered.
      envelope: receiptEnvelope,
      source: ".local/audits/arcanum-2026-09-12/fixtures/pdr-valid.json",
    },
    trpc: {
      protocol: {
        transformer: "superjson",
        response: "{result:{data:{json:<value>,meta:<superjson metadata>}}}",
        batchResponse: "[{result:{data:{json:<value>,meta:<superjson metadata>}}}]",
      },
      responses: trpcResponses,
      contexts: contextResponses,
      mutations: mutationResponses,
    },
    rpc,
    routingInstructions: {
      trpc: [
        "Route /api/trpc/* before the app reaches the network.",
        "Split the pathname after /api/trpc/ on commas; each name is a procedure in trpc.responses.",
        "For each procedure return its response envelope. A batched request must receive an array in the same procedure order.",
        "Match input from the query's JSON input only when a response has a non-null input; otherwise reuse the common response.",
        "Use trpc.contexts.owner or trpc.contexts.viewer for org.getCurrent/currentOrg after switching the synthetic account.",
        "For mutation requests return the matching trpc.mutations envelope; refresh queries should continue to return the fixture read responses.",
      ],
      rpc: [
        "Route the configured Arc JSON-RPC POST endpoint and answer JSON-RPC requests from rpc.read and rpc.generic.",
        "For eth_call match both params[0].to and params[0].data case-insensitively; return the listed result.",
        "Use rpc.read.approver.initial for the first getEscalation read. After a transaction, use the selected settled approve/reject/cancel response.",
        "Return eth_getCode as 0x60006000, eth_getTransactionReceipt from rpc.transactionReceipts, and generic values for polling/estimation.",
      ],
      wallet: [
        "Install apps/web/test-fixtures/synthetic-wallet-provider.cjs with address identities.owner before dashboard owner flows.",
        "Switch with window.__syntheticWalletAudit.changeAccount(identities.viewer) for viewer authorization checks; the fixture's owner response stays identities.owner.",
        "The provider only accepts exact rpc.transactions {to,data,value,from}; never add a private key or real network transport.",
      ],
      writes: [
        "Escalation approve/reject/cancel, agent signer authorize/revoke, policy update, and vendor add/block/remove/cap-update each have an exact encoded transaction fixture in rpc.transactions.",
        "After an onchain write, route the corresponding receipt hash and then the listed settled getEscalation result; route the matching mutation envelope to model indexer sync.",
      ],
    },
  };

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

await build();
