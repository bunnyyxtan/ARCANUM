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
  decodeFunctionData,
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

export async function readWalletPolicySnapshot(client: PublicClient, wallet: Address) {
  const blockNumber = await client.getBlockNumber();
  const [policyVersion, policy] = await Promise.all([
    client.readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "policyVersion",
      blockNumber,
    }),
    client.readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "policy",
      blockNumber,
    }),
  ]);
  return {
    policyVersion: policyVersion as bigint,
    policy: {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
      freezeOnBlockedVendor: policy[6],
    } satisfies WalletPolicyChainState,
  };
}

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

/**
 * Read the authority that is true for the wallet at the time of this request.
 *
 * The Supabase owner and signer columns are an eventually-consistent read
 * model. Sensitive writes must not use either column as proof of authority, in
 * particular while an OwnershipTransferred or SignerAdded/Removed event is
 * waiting to be indexed.
 */
export async function readWalletAuthorityState(
  client: PublicClient,
  wallet: Address,
  signer: Address,
): Promise<{ owner: Address; signerAuthorized: boolean }> {
  const [owner, signerAuthorized] = await Promise.all([
    client.readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "owner",
    }),
    client.readContract({
      address: wallet,
      abi: GuardedWalletAbi,
      functionName: "agentSigners",
      args: [signer],
    }),
  ]);

  return {
    owner: owner as Address,
    signerAuthorized: Boolean(signerAuthorized),
  };
}

export async function readWalletOwner(client: PublicClient, wallet: Address): Promise<Address> {
  const owner = await client.readContract({
    address: wallet,
    abi: GuardedWalletAbi,
    functionName: "owner",
  });
  return owner as Address;
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

export async function verifyCreatedWalletDeployment(
  client: PublicClient,
  input: {
    deployTxHash: Hex;
    ownerAddress: Address;
    walletAddress: Address;
    chainId: number;
  },
) {
  const event = await verifyCreatedWalletReceipt(client, input);
  const deployment = readDeploymentManifest();
  const transaction = await client.getTransaction({ hash: input.deployTxHash });
  if (!transaction.to || transaction.to.toLowerCase() !== deployment.walletFactory.toLowerCase()) {
    throw new Error("Wallet creation transaction was not sent directly to the configured factory.");
  }

  let decoded: ReturnType<typeof decodeFunctionData<typeof WalletFactoryAbi>>;
  try {
    decoded = decodeFunctionData({ abi: WalletFactoryAbi, data: transaction.input });
  } catch (error) {
    throw new Error("Wallet creation transaction calldata could not be decoded.", { cause: error });
  }
  if (decoded.functionName !== "createWallet") {
    throw new Error("Wallet creation transaction did not call createWallet.");
  }
  const [owner, label, initialPolicy, initialSigners, escalationCouncil, quorum, expirySeconds] =
    decoded.args;
  if (owner.toLowerCase() !== event.owner.toLowerCase()) {
    throw new Error("Wallet creation calldata owner does not match its WalletCreated event.");
  }
  return {
    event,
    owner,
    label,
    initialPolicy: {
      perTxCap: initialPolicy.perTxCap,
      daily24hCap: initialPolicy.daily24hCap,
      monthlyCap: initialPolicy.monthlyCap,
      allowedCategories: initialPolicy.allowedCategories,
      escalationThreshold: initialPolicy.escalationThreshold,
      requireAllowlist: initialPolicy.requireAllowlist,
      freezeOnBlockedVendor: initialPolicy.freezeOnBlockedVendor,
    },
    initialSigners,
    escalationCouncil,
    quorum: Number(quorum),
    expirySeconds,
  };
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

/**
 * Council membership as the wallet itself defines it: the check goes through
 * the manager the wallet currently points at, so a rotated module neither
 * keeps the old council authorized nor locks the new one out.
 */
export async function isWalletCouncilMember(wallet: Address, signer: Address): Promise<boolean> {
  const client = publicClient();
  const manager = await client.readContract({
    address: wallet,
    abi: GuardedWalletAbi,
    functionName: "escalationManager",
  });
  return client.readContract({
    address: manager,
    abi: EscalationManagerAbi,
    functionName: "isRequiredSigner",
    args: [wallet, signer],
  });
}
