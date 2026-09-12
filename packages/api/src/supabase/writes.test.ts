import { afterEach, describe, expect, it } from "vitest";

import type { Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import { ensureOwnerWorkspaceForWallet, recordSupabaseDeployedPolicy } from "./writes";

const wallet = {
  id: "wallet-1",
  orgId: "org-1",
  address: "0x1111111111111111111111111111111111111111",
  label: "Wallet",
} as unknown as Wallet;

const policy = (version: number, dailyCap = "2") => ({
  walletAddress: wallet.address as `0x${string}`,
  txHash: `0x${"a".repeat(64)}` as `0x${string}`,
  version,
  perTxCap: "1",
  dailyCap,
  monthlyCap: "3",
  escalationThreshold: "4",
  allowedCategories: ["api"],
  requireAllowlist: true,
  freezeOnBlockedVendor: false,
});

describe("doctrine chain version authority", () => {
  afterEach(() => {
    Reflect.deleteProperty(process.env, "ARCANUM_DEPLOYMENT_MODE");
  });

  it("ignores lower versions and upserts greater versions on the wallet/version key", async () => {
    const current = {
      governed_wallet_id: wallet.id,
      organization_id: wallet.orgId,
      name: "Wallet Doctrine",
      version: 2,
      per_tx_cap_usdc: "1",
      daily_cap_usdc: "2",
      monthly_cap_usdc: "3",
      escalate_above_usdc: "4",
      allowed_categories: ["api"],
      require_vendor_allowlist: true,
      freeze_on_blocked_vendor: false,
    };
    const upserts: { row: Record<string, unknown>; conflict?: string }[] = [];
    const client = {
      configured: true,
      selectRows: async () => [current],
      insertRows: async () => [],
      patchRows: async () => [],
      upsertRows: async (_table: string, rows: Record<string, unknown>[], conflict?: string) => {
        upserts.push({ row: rows[0] ?? {}, conflict });
        return rows;
      },
      callFunction: async () => null,
    };
    const ctx = { supabase: client } as unknown as ApiContext;
    expect(await recordSupabaseDeployedPolicy(ctx, wallet, policy(1))).toMatchObject({
      ok: true,
      data: { version: 2 },
    });
    expect(upserts).toHaveLength(0);
    await recordSupabaseDeployedPolicy(ctx, wallet, policy(3, "9"));
    expect(upserts[0]).toMatchObject({
      row: { version: 3, daily_cap_usdc: "9" },
      conflict: "governed_wallet_id,version",
    });
  });

  it("fails closed before provisioning shared identity in multi-tenant mode", async () => {
    process.env.ARCANUM_DEPLOYMENT_MODE = "multi-tenant";
    const client = {
      selectRows: async () => {
        throw new Error("must not query");
      },
    };
    await expect(ensureOwnerWorkspaceForWallet(client as never, wallet.address)).rejects.toThrow(
      "multi-tenant mode requires tenant-scoped Supabase identity",
    );
  });
});
