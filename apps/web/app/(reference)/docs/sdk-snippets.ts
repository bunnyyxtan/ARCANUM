import type { ArcNetwork } from "@arcanum/shared";

/**
 * The SDK quickstart snippets shown on the docs page, rendered for the
 * network the console runs on. Kept as pure functions so the test can render
 * both networks and parse the exact displayed text with Node.
 */
export type SdkSnippetInput = {
  network: ArcNetwork;
  /** WalletFactory address from the active deployment manifest. */
  walletFactory: string;
};

function chainBindings(network: ArcNetwork) {
  const upper = network.toUpperCase();
  return {
    chainExport: network === "mainnet" ? "arcMainnet" : "arcTestnet",
    rpcExport: `ARC_${upper}_RPC_URL`,
    rpcEnv: `ARC_${upper}_RPC`,
    label: network === "mainnet" ? "Mainnet" : "Testnet",
  };
}

export function sdkTestSnippet({ network }: SdkSnippetInput): string {
  const { chainExport, rpcExport, rpcEnv, label } = chainBindings(network);
  return `import { ArcanumClient } from "arcanum-sdk";
import { ${rpcExport}, ${chainExport}, usdcErc20 } from "arcanum-sdk/chains";
import { formatUnits } from "viem";

const walletAddress = process.env.GUARDED_WALLET;
const vendorAddress = process.env.VENDOR_ADDRESS;
if (!walletAddress || !vendorAddress) {
  throw new Error("Set GUARDED_WALLET and VENDOR_ADDRESS first.");
}

// The SDK chain definition is sourced from Arc's current ${label} config.
// Arc's native USDC gas balance uses 18 decimals.
const client = new ArcanumClient({
  walletAddress,
  chain: ${chainExport},
  rpcUrl: process.env.${rpcEnv} ?? ${rpcExport},
});

const policy = await client.getPolicy();
// GuardedWallet policy and ERC20 USDC amounts use six-decimal token units.
console.log("Per-tx cap:", formatUnits(policy.perTxCap, 6), "USDC");

const allowed = await client.simulate({
  to: vendorAddress,
  amount: usdcErc20(1),
});
console.log("Vendor verdict:", allowed.verdict, allowed.reason);

const denied = await client.simulate({
  to: vendorAddress,
  amount: usdcErc20(1000000),
});
console.log("Large payment verdict:", denied.verdict, denied.reason);`;
}

export function sdkDeploySnippet({ network, walletFactory }: SdkSnippetInput): string {
  const { chainExport, rpcExport, rpcEnv } = chainBindings(network);
  const networkName = network === "mainnet" ? "Arc Mainnet" : "Arc Testnet";
  return `import { WalletFactoryAbi } from "arcanum-sdk";
import { ${rpcExport}, ${chainExport} } from "arcanum-sdk/chains";
import { createWalletClient, http, parseUnits } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const operatorKey = process.env.OPERATOR_KEY;
const agentSigner = process.env.AGENT_SIGNER_ADDRESS;
if (!operatorKey || !agentSigner) {
  throw new Error("Set OPERATOR_KEY and AGENT_SIGNER_ADDRESS first.");
}

// The operator account owns the Doctrine. Arc native USDC gas uses 18 decimals;
// GuardedWallet policy values below are ERC20 USDC base units (6 decimals).
const account = privateKeyToAccount(operatorKey);
const walletClient = createWalletClient({
  account,
  chain: ${chainExport},
  transport: http(process.env.${rpcEnv} ?? ${rpcExport}),
});

// Current ${networkName} deployment manifest:
// packages/contracts/deployments/arc-${network}.json
const WALLET_FACTORY = "${walletFactory}";

const policy = {
  perTxCap: parseUnits("50", 6),
  daily24hCap: parseUnits("500", 6),
  monthlyCap: parseUnits("5000", 6), // wallet-wide monthly cap
  allowedCategories: 0b11111n,
  escalationThreshold: parseUnits("25", 6),
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
};

const council = [account.address]; // use additional approvers for a real quorum

const txHash = await walletClient.writeContract({
  address: WALLET_FACTORY,
  abi: WalletFactoryAbi,
  functionName: "createWallet",
  args: [account.address, "ResearchAgent", policy, [agentSigner], council, 1, 3600],
});
console.log("Deployed:", txHash);`;
}
