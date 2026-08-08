import { EscalationManagerAbi, GuardedWalletAbi, VendorRegistryAbi } from "@arcanum/contracts";
import { arcChain } from "@arcanum/shared";
import { http, type Address, type Hex, createPublicClient } from "viem";

/**
 * Server-side chain reads. The read model must never take a client's word for
 * what happened on-chain, so decisions are verified here before they are
 * mirrored into Supabase.
 */
const escalationStatusByIndex = ["pending", "released", "denied", "expired"] as const;

export type EscalationChainStatus = (typeof escalationStatusByIndex)[number];

export type EscalationChainState = {
  wallet: Address;
  toAddress: Address;
  amount: bigint;
  expiresAt: number;
  threshold: number;
  signatures: number;
  status: EscalationChainStatus;
};

function escalationManagerAddress(): Address | null {
  const address = process.env.NEXT_PUBLIC_ESCALATION_MANAGER;
  return address?.startsWith("0x") ? (address as Address) : null;
}

function publicClient() {
  return createPublicClient({
    chain: arcChain,
    transport: http(process.env.ARC_RPC_URL ?? arcChain.rpcUrls.default.http[0]),
  });
}

export async function readEscalationChainState(
  escalationKey: Hex,
): Promise<EscalationChainState | null> {
  const manager = escalationManagerAddress();
  if (!manager) {
    return null;
  }

  const detail = (await publicClient().readContract({
    address: manager,
    abi: EscalationManagerAbi,
    functionName: "getEscalation",
    args: [escalationKey],
  })) as readonly unknown[];

  const wallet = detail[0] as Address;
  if (!wallet || /^0x0{40}$/i.test(wallet)) {
    return null;
  }

  return {
    wallet,
    toAddress: detail[1] as Address,
    amount: detail[2] as bigint,
    expiresAt: Number(detail[5]),
    threshold: Number(detail[6]),
    signatures: Number(detail[7]),
    status: escalationStatusByIndex[Number(detail[8])] ?? "pending",
  };
}

export type WalletPolicyChainState = {
  perTxCap: bigint;
  daily24hCap: bigint;
  monthlyRollingCap: bigint;
  allowedCategories: bigint;
  escalationThreshold: bigint;
  requireAllowlist: boolean;
};

/**
 * Read the policy the wallet actually enforces. The read model must never
 * record caps the client claims to have deployed, only what the wallet returns.
 */
export async function readWalletPolicyChainState(
  wallet: Address,
): Promise<WalletPolicyChainState | null> {
  try {
    const policy = (await publicClient().readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "policy",
    })) as readonly [bigint, bigint, bigint, bigint, bigint, boolean];

    return {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyRollingCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: Boolean(policy[5]),
    };
  } catch {
    return null;
  }
}

export type VendorChainState = {
  allowed: boolean;
  blocked: boolean;
  category: number;
  perVendorCap: bigint;
};

export async function readVendorChainState(
  wallet: Address,
  vendor: Address,
): Promise<VendorChainState | null> {
  const registry = process.env.NEXT_PUBLIC_VENDOR_REGISTRY;
  if (!registry || !registry.startsWith("0x")) {
    return null;
  }

  const record = (await publicClient().readContract({
    address: registry as Address,
    abi: VendorRegistryAbi,
    functionName: "getVendorFor",
    args: [wallet, vendor],
  })) as {
    allowed: boolean;
    blocked: boolean;
    category: number;
    perVendorCap: bigint;
  };

  return {
    allowed: Boolean(record.allowed),
    blocked: Boolean(record.blocked),
    category: Number(record.category),
    perVendorCap: record.perVendorCap ?? 0n,
  };
}

export async function isEscalationSigner(wallet: Address, signer: Address): Promise<boolean> {
  const manager = escalationManagerAddress();
  if (!manager) {
    return false;
  }

  return (await publicClient().readContract({
    address: manager,
    abi: EscalationManagerAbi,
    functionName: "isRequiredSigner",
    args: [wallet, signer],
  })) as boolean;
}
