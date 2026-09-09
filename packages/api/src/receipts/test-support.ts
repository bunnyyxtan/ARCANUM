import {
  ARC_CHAIN_ID,
  ARC_USDC_ADDRESS,
  createPaymentIntentMessage,
  deploymentManifestFor,
} from "@arcanum/shared";
import { testAgentAccount, testIssuer, testIssuerAccount } from "@arcanum/shared/testing";
import type { Address, Hex } from "viem";
import { expect } from "vitest";

import type { ApiContext } from "../context";
import { SupabaseRequestError, type SupabaseRow } from "../supabase/client";
import type { ReceiptServiceDeps, issuePaymentReceipt } from "./service";

// In-memory chain, read model and issuer shared by the receipt tests.

process.env.ARCANUM_DEMO_OWNER_WALLET = "0x1111111111111111111111111111111111111111";

export const WALLET = "0x1000000000000000000000000000000000000001" as Address;
export const WALLET_ID = "30000000-0000-4000-8000-000000000003";
export const ORG_ID = "40000000-0000-4000-8000-000000000004";
export const OWNER = "0x5555555555555555555555555555555555555555";
export const VENDOR = "0x2000000000000000000000000000000000000002" as Address;
export const MODULE = "0x4444444444444444444444444444444444444444" as Address;
export const BLOCK_HASH = `0x${"ab".repeat(32)}` as Hex;
export const BLOCK_TIMESTAMP = 1_789_000_000n;

export const RECEIPT_ID = "8d2b4d6e-1e5a-4b7f-9c1d-0a2b3c4d5e6f";
export const ISSUED_AT = new Date("2026-09-10T10:00:00.000Z");

export type ChainState = {
  signerAuthorized: boolean;
  frozen: boolean;
  dailySpent: bigint;
  spendDay: bigint;
  verdict: number;
  reason: number;
  walletToken: Address;
};

export function defaultChain(): ChainState {
  return {
    signerAuthorized: true,
    frozen: false,
    dailySpent: 1_000_000n,
    spendDay: BLOCK_TIMESTAMP / 86_400n,
    verdict: 0,
    reason: 0,
    walletToken: ARC_USDC_ADDRESS,
  };
}

/** A GuardedWallet, VendorRegistry, PolicyEngine and USDC contract, in memory. */
export function fakePublicClient(chain: ChainState, log: { policyEngineCalls: unknown[] }) {
  return {
    async getBlock() {
      return { number: 61_000_000n, hash: BLOCK_HASH, timestamp: BLOCK_TIMESTAMP };
    },
    async readContract(call: {
      address: Address;
      functionName: string;
      args?: readonly unknown[];
      blockNumber?: bigint;
    }) {
      expect(call.blockNumber).toBe(61_000_000n);
      switch (call.functionName) {
        case "usdc":
          return chain.walletToken;
        case "agentSigners":
          return chain.signerAuthorized;
        case "frozen":
          return chain.frozen;
        case "policy":
          return [100_000_000n, 500_000_000n, 5_000_000_000n, 6n, 50_000_000n, true, true];
        case "policyVersion":
          return 3n;
        case "dailySpent":
          return chain.dailySpent;
        case "monthlySpent":
          return 1_000_000n;
        case "spendDay":
          return chain.spendDay;
        case "spendMonth":
          return BLOCK_TIMESTAMP / 2_592_000n;
        case "policyEngine":
        case "vendorRegistry":
        case "escalationManager":
          return MODULE;
        case "getVendorFor":
          return {
            allowed: true,
            blocked: false,
            category: 1,
            perVendorCap: 0n,
            metadataHash: "0x",
          };
        case "balanceOf":
          return 250_000_000n;
        case "evaluate":
          log.policyEngineCalls.push(call.args);
          return [chain.verdict, chain.reason];
        default:
          throw new Error(`unexpected read ${call.functionName}`);
      }
    },
  } as unknown as ApiContext["publicClient"];
}

/** Enough of PostgREST to exercise inserts, unique keys and filtered reads. */
export function fakeSupabase(tables: Record<string, SupabaseRow[]>) {
  const uniqueKeys: Record<string, (row: SupabaseRow) => string> = {
    payment_receipts: (row) =>
      [row.chain_id, row.wallet_address, row.agent_signer_address, row.reference].join("|"),
    payment_receipt_evidence: (row) =>
      [row.receipt_id, row.kind, row.outcome, row.tx_hash ?? ""].join("|"),
  };

  function matches(row: SupabaseRow, options?: Record<string, unknown>) {
    const filters = (options?.filters ?? {}) as Record<string, unknown>;
    const inFilters = (options?.inFilters ?? {}) as Record<string, string[]>;
    return (
      Object.entries(filters).every(
        ([key, value]) =>
          value === undefined || value === null || value === "" || row[key] === value,
      ) && Object.entries(inFilters).every(([key, values]) => values.includes(String(row[key])))
    );
  }

  const client: NonNullable<ApiContext["supabase"]> = {
    configured: true,
    selectRows: async (table, options) => {
      const rows = (tables[table] ?? []).filter((row) => matches(row, options));
      const limit = (options as { limit?: number } | undefined)?.limit;
      return limit ? rows.slice(0, limit) : rows;
    },
    insertRows: async (table, rows) => {
      const key = uniqueKeys[table];
      tables[table] ??= [];
      for (const row of rows) {
        if (key && tables[table].some((existing) => key(existing) === key(row))) {
          throw new SupabaseRequestError(table, "POST", 409, "duplicate key value");
        }
        // Column defaults the real database would fill in, rendered the way
        // PostgREST renders timestamptz: explicit offset, trimmed fraction.
        const stored: SupabaseRow = { ...row, id: row.id ?? crypto.randomUUID() };
        if (table === "payment_receipt_evidence") {
          stored.observed_at = postgrestTimestamp(row.observed_at ?? new Date().toISOString());
        }
        if (typeof stored.created_at === "string") {
          stored.created_at = postgrestTimestamp(stored.created_at);
        }
        tables[table].push(stored);
      }
      return rows;
    },
    upsertRows: async () => {
      throw new Error("receipts must never merge duplicates");
    },
    patchRows: async () => {
      throw new Error("receipts are immutable");
    },
    callFunction: async () => null,
  };
  return client;
}

function postgrestTimestamp(value: unknown) {
  const iso = new Date(String(value)).toISOString();
  return `${iso.replace(/\.?0+Z$/, "").replace(/Z$/, "")}+00:00`;
}

export function walletRow(): SupabaseRow {
  return {
    id: WALLET_ID,
    organization_id: ORG_ID,
    wallet_address: WALLET,
    owner_address: OWNER,
    label: "Ops wallet",
    wallet_factory_address: deploymentManifestFor("testnet").walletFactory.toLowerCase(),
    status: "active",
    created_at: "2026-09-01T00:00:00.000Z",
  };
}

export async function signedIntent(overrides: Record<string, unknown> = {}) {
  const intent = {
    chainId: ARC_CHAIN_ID,
    governedWalletAddress: WALLET,
    agentSignerAddress: testAgentAccount.address,
    vendorAddress: VENDOR,
    tokenAddress: ARC_USDC_ADDRESS,
    tokenSymbol: "USDC" as const,
    amount: "12.5",
    purpose: "Monthly API quota",
    reference: "inv-2026-09-0001",
    ...overrides,
  };
  const signature = await testAgentAccount.signMessage({
    message: createPaymentIntentMessage(intent),
  });
  return { ...intent, signature };
}

export function deps(overrides: Partial<ReceiptServiceDeps> = {}): ReceiptServiceDeps {
  let counter = 0;
  return {
    issuer: () => ({
      keyId: testIssuer.keyId,
      address: testIssuer.address,
      registration: testIssuer,
      signMessage: (message) => testIssuerAccount.signMessage({ message }),
    }),
    now: () => ISSUED_AT,
    receiptId: () => (counter++ === 0 ? RECEIPT_ID : crypto.randomUUID()),
    isCouncilMember: async () => false,
    ...overrides,
  };
}

export function context(input: {
  chain?: ChainState;
  tables?: Record<string, SupabaseRow[]>;
  session?: ApiContext["session"];
  log?: { policyEngineCalls: unknown[] };
}): ApiContext {
  return {
    db: null as never,
    session: input.session ?? null,
    publicClient: fakePublicClient(
      input.chain ?? defaultChain(),
      input.log ?? { policyEngineCalls: [] },
    ),
    supabase: fakeSupabase(input.tables ?? { governed_wallets: [walletRow()] }),
    requestFingerprint: "203.0.113.9",
    env: { authConfigured: true, allowDevAuth: false },
  };
}

export function session(walletAddress: string): ApiContext["session"] {
  return {
    walletAddress,
    tenantId: "20000000-0000-4000-8000-000000000002",
    role: "owner",
    expiresAt: Date.now() + 60_000,
  };
}

export const normalized = (intent: Awaited<ReturnType<typeof signedIntent>>) =>
  ({
    ...intent,
    governedWalletAddress: intent.governedWalletAddress.toLowerCase(),
    agentSignerAddress: intent.agentSignerAddress.toLowerCase(),
    vendorAddress: intent.vendorAddress.toLowerCase(),
    tokenAddress: intent.tokenAddress.toLowerCase(),
    signature: intent.signature.toLowerCase(),
  }) as Parameters<typeof issuePaymentReceipt>[1];

export type Tables = { governed_wallets: SupabaseRow[]; payment_receipts: SupabaseRow[] };
