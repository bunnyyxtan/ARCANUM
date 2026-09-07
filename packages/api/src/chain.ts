import {
  EscalationManagerAbi,
  GuardedWalletAbi,
  VendorRegistryAbi,
  WalletFactoryAbi,
} from "@arcanum/contracts";
import {
  ARC_CHAIN_ID,
  ARC_NETWORK,
  type DeploymentManifest,
  type ESCALATION_STATUSES,
  arcChain,
  deploymentManifestFor,
  escalationStatusFromIndex,
} from "@arcanum/shared";
import {
  http,
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  decodeEventLog,
} from "viem";

if (ARC_NETWORK === "mainnet") {
  deploymentManifestFor(ARC_NETWORK);
}

export function readDeploymentManifest(): DeploymentManifest {
  const deployment = deploymentManifestFor(ARC_NETWORK);
  if (deployment.chainId !== ARC_CHAIN_ID) {
    throw new Error(
      `The ${ARC_NETWORK} deployment manifest chainId ${deployment.chainId} does not match ${ARC_CHAIN_ID}.`,
    );
  }
  return deployment;
}

function publicClient() {
  return createPublicClient({
    chain: arcChain,
    transport: http(process.env.ARC_RPC_URL ?? arcChain.rpcUrls.default.http[0]),
  });
}

export type EscalationChainStatus = Lowercase<(typeof ESCALATION_STATUSES)[number]>;

export type EscalationChainState = {
  wallet: Address;
  toAddress: Address;
  amount: bigint;
  expiresAt: number;
  threshold: number;
  signatures: number;
  status: EscalationChainStatus;
  policyVersion: bigint;
  heldCouncilVersion: bigint;
};

export async function readEscalationChainState(
  escalationKey: Hex,
): Promise<EscalationChainState | null> {
  const detail = await publicClient().readContract({
    address: readDeploymentManifest().escalationManager,
    abi: EscalationManagerAbi,
    functionName: "getEscalation",
    args: [escalationKey],
  });

  const wallet = detail[0];
  if (/^0x0{40}$/i.test(wallet)) {
    return null;
  }

  const status = escalationStatusFromIndex(Number(detail[8]));
  if (!status) {
    throw new Error(`Escalation ${escalationKey} returned an unknown status ${String(detail[8])}.`);
  }

  return {
    wallet,
    toAddress: detail[1],
    amount: detail[2],
    expiresAt: Number(detail[5]),
    threshold: Number(detail[6]),
    signatures: Number(detail[7]),
    status: status.toLowerCase() as EscalationChainStatus,
    policyVersion: detail[9],
    heldCouncilVersion: detail[10],
  };
}

export type WalletPolicyChainState = {
  perTxCap: bigint;
  daily24hCap: bigint;
  monthlyCap: bigint;
  allowedCategories: bigint;
  escalationThreshold: bigint;
  requireAllowlist: boolean;
  freezeOnBlockedVendor: boolean;
};

export async function readWalletPolicyChainState(
  wallet: Address,
): Promise<WalletPolicyChainState | null> {
  try {
    const policy = await publicClient().readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "policy",
    });

    return {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
      freezeOnBlockedVendor: policy[6],
    };
  } catch (error) {
    if (error instanceof Error) {
      return null;
    }
    throw error;
  }
}

export async function verifyCreatedWalletReceipt(
  client: PublicClient,
  input: {
    deployTxHash: Hex;
    ownerAddress: Address;
    walletAddress: Address;
    chainId: number;
  },
) {
  const deployment = readDeploymentManifest();
  if (input.chainId !== deployment.chainId) {
    throw new Error(
      `Wallet deployment chain ${input.chainId} does not match ${deployment.chainId}.`,
    );
  }

  const receipt = await client.getTransactionReceipt({ hash: input.deployTxHash });
  if (receipt.status !== "success") {
    throw new Error("Wallet deployment transaction reverted.");
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== deployment.walletFactory.toLowerCase()) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: WalletFactoryAbi,
        eventName: "WalletCreated",
        data: log.data,
        topics: log.topics,
      });
      if (
        decoded.args.owner.toLowerCase() === input.ownerAddress.toLowerCase() &&
        decoded.args.wallet.toLowerCase() === input.walletAddress.toLowerCase()
      ) {
        return decoded.args;
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
    }
  }

  throw new Error("Transaction has no matching WalletCreated event from the configured factory.");
}

export async function verifyPolicyUpdatedReceipt(
  client: PublicClient,
  txHash: Hex,
  walletAddress: Address,
) {
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Policy deployment transaction reverted.");
  }

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== walletAddress.toLowerCase()) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: GuardedWalletAbi,
        eventName: "PolicyUpdated",
        data: log.data,
        topics: log.topics,
      });
      if (decoded.args.wallet.toLowerCase() === walletAddress.toLowerCase()) {
        return decoded.args;
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
    }
  }

  throw new Error("Transaction has no matching PolicyUpdated event from the governed wallet.");
}

const decisionEventByStatus = {
  executed: "EscalationExecuted",
  rejected: "EscalationRejected",
  expired: "EscalationExpired",
  denied: "EscalationDenied",
  cancelled: "EscalationCancelled",
  invalidated: "EscalationInvalidated",
} as const;

export async function verifyEscalationDecisionReceipt(
  client: PublicClient,
  txHash: Hex,
  escalationKey: Hex,
  status: Exclude<EscalationChainStatus, "pending">,
) {
  const deployment = readDeploymentManifest();
  const receipt = await client.getTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new Error("Escalation decision transaction reverted.");
  }

  const eventName = decisionEventByStatus[status];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== deployment.escalationManager.toLowerCase()) {
      continue;
    }
    try {
      const decoded = decodeEventLog({
        abi: EscalationManagerAbi,
        eventName,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.args.escalationId.toLowerCase() === escalationKey.toLowerCase()) {
        return;
      }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }
    }
  }

  throw new Error(`Transaction has no matching ${eventName} event from the escalation manager.`);
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
  const record = await publicClient().readContract({
    address: readDeploymentManifest().vendorRegistry,
    abi: VendorRegistryAbi,
    functionName: "getVendorFor",
    args: [wallet, vendor],
  });

  return {
    allowed: record.allowed,
    blocked: record.blocked,
    category: Number(record.category),
    perVendorCap: record.perVendorCap,
  };
}

export async function isEscalationSigner(wallet: Address, signer: Address): Promise<boolean> {
  return publicClient().readContract({
    address: readDeploymentManifest().escalationManager,
    abi: EscalationManagerAbi,
    functionName: "isRequiredSigner",
    args: [wallet, signer],
  });
}
