import { WalletFactoryAbi } from "@arcanum/contracts";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../context";
import type { SupabaseRequestOptions, SupabaseRow } from "../supabase";
import { escalationStatusFromString } from "../supabase";
import { agentsRouter } from "./agents";
import { anomaliesRouter } from "./anomalies";
import { escalationsRouter } from "./escalations";

const OWNER = "0x1111111111111111111111111111111111111111";
const OTHER_OWNER = "0x2222222222222222222222222222222222222222";
const WALLET = "0x3333333333333333333333333333333333333333";
const FACTORY = "0x4444444444444444444444444444444444444444";
const TX_HASH = `0x${"ab".repeat(32)}` as const;
const ESCALATION_KEY = `0x${"cd".repeat(32)}` as const;
const ORG_ID = "10000000-0000-4000-8000-000000000001";
const PROFILE_ID = "20000000-0000-4000-8000-000000000002";
const WALLET_ID = "30000000-0000-4000-8000-000000000003";
const ANOMALY_ID = "40000000-0000-4000-8000-000000000004";

afterEach(() => {
  vi.unstubAllEnvs();
});

function context(input: {
  owner?: string | null;
  selectRows?: (table: string, options?: SupabaseRequestOptions) => Promise<SupabaseRow[]>;
  patchRows?: ApiContext["supabase"] extends infer _T
    ? NonNullable<ApiContext["supabase"]>["patchRows"]
    : never;
  callFunction?: NonNullable<ApiContext["supabase"]>["callFunction"];
  receipt?: SupabaseRow;
}): ApiContext {
  return {
    db: null as never,
    session:
      input.owner === null
        ? null
        : {
            walletAddress: input.owner ?? OWNER,
            tenantId: ORG_ID,
            role: "viewer",
            expiresAt: Date.now() + 60_000,
          },
    publicClient: {
      getTransactionReceipt: () => Promise.resolve(input.receipt),
    } as never,
    supabase: {
      configured: true,
      selectRows: input.selectRows ?? (() => Promise.resolve([])),
      upsertRows: () => Promise.resolve([]),
      patchRows: input.patchRows ?? (() => Promise.resolve([])),
      callFunction: input.callFunction ?? (() => Promise.resolve(null)),
    },
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  };
}

function walletCreatedReceipt(address = FACTORY, status = "success") {
  return {
    status,
    logs: [
      {
        address,
        topics: encodeEventTopics({
          abi: WalletFactoryAbi,
          eventName: "WalletCreated",
          args: { wallet: WALLET, owner: OWNER },
        }),
        data: encodeAbiParameters(
          [{ type: "string" }, { type: "uint256" }, { type: "uint256" }],
          ["Agent", 1n, 1n],
        ),
      },
    ],
  };
}

const createdWalletInput = {
  walletAddress: WALLET,
  ownerAddress: OWNER,
  label: "Agent",
  deployTxHash: TX_HASH,
  chainId: 5_042_002,
  perTxCap: "100",
  dailyCap: "1000",
  monthlyCap: "30000",
  escalationThreshold: "50",
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
  signers: [OWNER],
  council: [OWNER],
  quorum: 1,
};

describe("created wallet verification", () => {
  it("refuses an existing wallet owned by someone else without table writes", async () => {
    const patchRows = vi.fn(() => Promise.resolve([]));
    const upsertRows = vi.fn(() => Promise.resolve([]));
    const ctx = context({
      receipt: walletCreatedReceipt(),
      callFunction: () =>
        Promise.reject(new Error("rpc failed: record_created_wallet: owner mismatch")),
      patchRows,
    });
    if (ctx.supabase) {
      ctx.supabase.upsertRows = upsertRows;
    }

    await expect(
      agentsRouter.createCaller(ctx).recordCreatedWallet(createdWalletInput),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(patchRows).not.toHaveBeenCalled();
    expect(upsertRows).not.toHaveBeenCalled();
  });

  it("rejects a reverted deployment receipt", async () => {
    const callFunction = vi.fn(() => Promise.resolve(null));
    await expect(
      agentsRouter
        .createCaller(context({ receipt: walletCreatedReceipt(FACTORY, "reverted"), callFunction }))
        .recordCreatedWallet(createdWalletInput),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(callFunction).not.toHaveBeenCalled();
  });

  it("rejects WalletCreated logs emitted by another factory", async () => {
    const callFunction = vi.fn(() => Promise.resolve(null));
    await expect(
      agentsRouter
        .createCaller(context({ receipt: walletCreatedReceipt(OTHER_OWNER), callFunction }))
        .recordCreatedWallet(createdWalletInput),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(callFunction).not.toHaveBeenCalled();
  });
});

describe("legacy wallet isolation", () => {
  it("does not return a foreign-factory wallet and reports it separately", async () => {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const currentWallet = {
      id: WALLET_ID,
      organization_id: ORG_ID,
      wallet_address: WALLET,
      owner_address: OWNER,
      wallet_factory_address: FACTORY,
      label: "Current agent",
      created_at: "2026-09-07T00:00:00.000Z",
    };
    const legacyWallet = {
      ...currentWallet,
      id: "50000000-0000-4000-8000-000000000005",
      wallet_address: "0x5555555555555555555555555555555555555555",
      wallet_factory_address: OTHER_OWNER,
      label: "Legacy agent",
    };
    const doctrine = {
      governed_wallet_id: WALLET_ID,
      version: 1,
      signers: [OWNER],
      escalation_council: [OWNER],
      quorum: 1,
      per_tx_cap_usdc: "100",
      daily_cap_usdc: "1000",
      monthly_cap_usdc: "30000",
      escalate_above_usdc: "50",
      require_vendor_allowlist: true,
    };
    const selectRows = (table: string, options?: SupabaseRequestOptions) => {
      if (table === "profiles") {
        return Promise.resolve([{ id: PROFILE_ID }]);
      }
      if (table === "organization_members") {
        return Promise.resolve([{ organization_id: ORG_ID, role: "owner" }]);
      }
      if (table === "doctrines") {
        return Promise.resolve([doctrine]);
      }
      if (table === "governed_wallets") {
        return Promise.resolve(
          options?.filters?.wallet_factory_address
            ? [currentWallet]
            : [currentWallet, legacyWallet],
        );
      }
      return Promise.resolve([]);
    };

    const result = await agentsRouter.createCaller(context({ selectRows })).list(undefined);
    expect(result.legacyWalletCount).toBe(1);
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0]?.walletAddress).toBe(WALLET);
  });
});

describe("public escalation lookup", () => {
  it("keeps rejected council votes distinct from policy denials", () => {
    expect(
      [
        "pending",
        "approved",
        "rejected",
        "denied",
        "expired",
        "released",
        "cancelled",
        "invalidated",
      ].map(escalationStatusFromString),
    ).toEqual([
      "PENDING",
      "EXECUTED",
      "REJECTED",
      "DENIED",
      "EXPIRED",
      "EXECUTED",
      "CANCELLED",
      "INVALIDATED",
    ]);
  });

  it("returns only the anonymous approval fields", async () => {
    const escalation = {
      escalation_key: ESCALATION_KEY,
      governed_wallet_id: WALLET_ID,
      amount_usdc: "12.5",
      counterparty_address: OTHER_OWNER,
      quorum_required: 2,
      approvals_count: 1,
      expires_at: "2026-09-08T00:00:00.000Z",
      status: "rejected",
      policy_version: 3,
    };
    const wallet = { id: WALLET_ID, wallet_address: WALLET, chain_id: 5_042_002 };
    const selectRows = (table: string) =>
      Promise.resolve(table === "escalations" ? [escalation] : [wallet]);
    const result = await escalationsRouter
      .createCaller(context({ owner: null, selectRows }))
      .publicByKey({ escalationKey: ESCALATION_KEY });

    expect(Object.keys(result).sort()).toEqual(
      [
        "amount",
        "chainId",
        "counterparty",
        "escalationKey",
        "expiresAt",
        "policyVersion",
        "signatureCount",
        "status",
        "threshold",
        "walletAddress",
      ].sort(),
    );
    expect(result).toMatchObject({
      escalationKey: ESCALATION_KEY,
      walletAddress: WALLET,
      status: "REJECTED",
    });
  });

  it("returns NOT_FOUND for an unknown key", async () => {
    await expect(
      escalationsRouter
        .createCaller(context({ owner: null }))
        .publicByKey({ escalationKey: ESCALATION_KEY }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("anomaly decision actor", () => {
  function anomalyContext(
    owner: string,
    role: string,
    patchRows = vi.fn(() => Promise.resolve([{}])),
  ) {
    vi.stubEnv("ARCANUM_DEMO_OWNER_WALLET", OWNER);
    const rows: Record<string, SupabaseRow[]> = {
      anomalies: [{ id: ANOMALY_ID, governed_wallet_id: WALLET_ID }],
      profiles: [{ id: PROFILE_ID }],
      organization_members: [{ organization_id: ORG_ID, role }],
      governed_wallets: [
        {
          id: WALLET_ID,
          organization_id: ORG_ID,
          wallet_address: WALLET,
          owner_address: OWNER,
          created_at: "2026-09-07T00:00:00.000Z",
        },
      ],
    };
    return {
      ctx: context({ owner, selectRows: (table) => Promise.resolve(rows[table] ?? []), patchRows }),
      patchRows,
    };
  }

  it("forbids a read-only member", async () => {
    const { ctx, patchRows } = anomalyContext(OTHER_OWNER, "viewer");
    await expect(
      anomaliesRouter.createCaller(ctx).decide({
        anomalyId: ANOMALY_ID,
        decision: "dismissed",
        decisionReason: "Reviewed and dismissed.",
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(patchRows).not.toHaveBeenCalled();
  });

  it("writes the owner actor, time, and reason", async () => {
    const { ctx, patchRows } = anomalyContext(OWNER, "owner");
    await anomaliesRouter.createCaller(ctx).decide({
      anomalyId: ANOMALY_ID,
      decision: "acknowledged",
      decisionReason: "Owner acknowledged the alert.",
    });
    expect(patchRows).toHaveBeenCalledWith(
      "anomalies",
      expect.objectContaining({
        decided_by: OWNER,
        decided_at: expect.any(String),
        decision_reason: "Owner acknowledged the alert.",
      }),
      { id: ANOMALY_ID, governed_wallet_id: WALLET_ID },
    );
  });
});
