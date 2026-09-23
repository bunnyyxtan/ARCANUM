/**
 * Run with `npx tsx scripts/reconcile-doctrines.ts` for a dry run, or add
 * `--apply` to repair doctrine mirrors from a consistent chain snapshot.
 */
import { ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import { http, createPublicClient, formatUnits } from "viem";

import { readWalletPolicySnapshot } from "../src/chain";
import type { ApiContext } from "../src/context";
import {
  categoryNamesFromMask,
  createSupabaseServiceRoleClient,
  recordSupabaseDeployedPolicy,
  walletFromGovernedWalletRow,
} from "../src/supabase";

const deployment = deploymentManifestFor(ARC_NETWORK);
const supabase = createSupabaseServiceRoleClient();
if (!supabase) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}
const rpcUrl = process.env.ARC_RPC_URL ?? process.env.ARC_TESTNET_RPC;
if (!rpcUrl) {
  throw new Error("ARC_RPC_URL (or ARC_TESTNET_RPC) is required.");
}
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const apply = process.argv.includes("--apply");
const walletRows = await supabase.selectRows("governed_wallets", {
  filters: { wallet_factory_address: deployment.walletFactory.toLowerCase() },
  order: "created_at.asc",
});

const report: Record<string, unknown>[] = [];
for (const walletRow of walletRows) {
  const wallet = walletFromGovernedWalletRow(walletRow);
  const [mirror] = await supabase.selectRows("doctrines", {
    filters: { governed_wallet_id: wallet.id },
    order: "version.desc",
    limit: 1,
  });
  const snapshot = await readWalletPolicySnapshot(publicClient, wallet.address as `0x${string}`);
  const policy = snapshot.policy;
  const input = {
    walletAddress: wallet.address as `0x${string}`,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000000" as const,
    version: Number(snapshot.policyVersion),
    perTxCap: formatUnits(policy.perTxCap, 6),
    dailyCap: formatUnits(policy.daily24hCap, 6),
    monthlyCap: formatUnits(policy.monthlyCap, 6),
    escalationThreshold: formatUnits(policy.escalationThreshold, 6),
    allowedCategories: categoryNamesFromMask(Number(policy.allowedCategories)),
    requireAllowlist: policy.requireAllowlist,
    freezeOnBlockedVendor: policy.freezeOnBlockedVendor,
  };
  report.push({
    wallet: wallet.address,
    mirrorVersion: mirror?.version ?? null,
    chainVersion: input.version,
    perTxDrift: String(mirror?.per_tx_cap_usdc ?? "") !== input.perTxCap,
    dailyDrift: String(mirror?.daily_cap_usdc ?? "") !== input.dailyCap,
    monthlyDrift: String(mirror?.monthly_cap_usdc ?? "") !== input.monthlyCap,
    categoryDrift:
      JSON.stringify(mirror?.allowed_categories ?? []) !== JSON.stringify(input.allowedCategories),
  });
  if (apply) {
    const result = await recordSupabaseDeployedPolicy({ supabase } as ApiContext, wallet, input);
    if (!result.ok) {
      throw new Error(`${wallet.address}: ${result.message}`);
    }
  }
}

console.table(report);
console.log(apply ? "Doctrine reconciliation applied." : "Dry run only; pass --apply to write.");
