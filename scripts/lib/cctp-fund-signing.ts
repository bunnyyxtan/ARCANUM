import {
  http,
  type Address,
  type Hash,
  type LocalAccount,
  type WalletClient,
  createPublicClient,
  createWalletClient,
  defineChain,
  getAddress,
  isAddress,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { CCTP_ROUTE } from "../../packages/sdk/src/cctp";
import { arcTestnet } from "../../packages/sdk/src/chains";
import { circleWalletAccount } from "../../packages/sdk/src/circle";

export const TRANSACTION_TIMEOUT_MS = 120_000;

export const sepolia = defineChain({
  id: CCTP_ROUTE.sourceChainId,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [CCTP_ROUTE.sourceRpcUrl] } },
  blockExplorers: {
    default: { name: "Etherscan", url: CCTP_ROUTE.sourceExplorerUrl },
  },
});

const OWNER_ABI = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
] as const;

const CIRCLE_ENV = [
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "CIRCLE_WALLET_ID",
  "CIRCLE_WALLET_ADDRESS",
] as const;

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name} before running this command.`);
  return value;
}

export function recipientFromEnv(): Address {
  const value = requireEnv("GUARDED_WALLET");
  if (!isAddress(value, { strict: false })) {
    throw new Error("GUARDED_WALLET must be a 20-byte address.");
  }
  return getAddress(value);
}

export function sourceRpcUrl(): string {
  return process.env.SEPOLIA_RPC?.trim() || CCTP_ROUTE.sourceRpcUrl;
}

export function destinationRpcUrl(): string {
  return process.env.ARC_TESTNET_RPC?.trim() || CCTP_ROUTE.destinationRpcUrl;
}

export function sourcePublicClient() {
  return createPublicClient({ chain: sepolia, transport: http(sourceRpcUrl()) });
}

export type SourcePublicClient = ReturnType<typeof sourcePublicClient>;

export function destinationPublicClient() {
  return createPublicClient({ chain: arcTestnet, transport: http(destinationRpcUrl()) });
}

export type DestinationPublicClient = ReturnType<typeof destinationPublicClient>;

export interface SourceBurnAnchor {
  sourceNonce: number;
  sourceBlockNumber: string;
}

export async function prepareSourceBurnAnchor(
  client: SourcePublicClient,
  sender: Address,
): Promise<SourceBurnAnchor> {
  const [sourceNonce, sourceBlockNumber] = await Promise.all([
    client.getTransactionCount({ address: sender, blockTag: "pending" }),
    client.getBlockNumber(),
  ]);
  if (!Number.isSafeInteger(sourceNonce) || sourceNonce < 0) {
    throw new Error("Sepolia returned an invalid pending transaction nonce.");
  }
  return { sourceNonce, sourceBlockNumber: sourceBlockNumber.toString() };
}

/**
 * There is deliberately no deployer/owner fallback here. A Circle
 * configuration is all-or-nothing; otherwise an operator could believe they
 * are using Circle while the command silently uses a different key.
 */
export function funderAccount(): LocalAccount {
  const privateKey = process.env.CCTP_PRIVATE_KEY?.trim();
  const configured = CIRCLE_ENV.filter((name) => process.env[name]?.trim());
  if (privateKey && configured.length > 0) {
    throw new Error(
      "Choose either CCTP_PRIVATE_KEY or the complete Circle signer configuration, not both.",
    );
  }
  if (privateKey) {
    if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
      throw new Error("CCTP_PRIVATE_KEY must be a 32-byte 0x-prefixed hex value.");
    }
    return privateKeyToAccount(privateKey as `0x${string}`);
  }
  if (configured.length !== 0 && configured.length !== CIRCLE_ENV.length) {
    const missing = CIRCLE_ENV.filter((name) => !configured.includes(name));
    throw new Error(`Circle signer is half configured; also set ${missing.join(", ")}.`);
  }
  if (configured.length === CIRCLE_ENV.length) {
    const address = requireEnv("CIRCLE_WALLET_ADDRESS");
    if (!isAddress(address, { strict: false })) {
      throw new Error("CIRCLE_WALLET_ADDRESS must be a 20-byte address.");
    }
    return circleWalletAccount({
      apiKey: requireEnv("CIRCLE_API_KEY"),
      entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
      walletId: requireEnv("CIRCLE_WALLET_ID"),
      address: getAddress(address),
    });
  }
  throw new Error(
    "Set CCTP_PRIVATE_KEY or all four Circle variables: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS.",
  );
}

export async function assertSourceSepolia(client: SourcePublicClient): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== CCTP_ROUTE.sourceChainId) {
    throw new Error(`Source RPC is chain ${chainId}, not Sepolia (${CCTP_ROUTE.sourceChainId}).`);
  }
}

export async function assertRecipientContract(
  client: DestinationPublicClient,
  recipient: Address,
): Promise<void> {
  const chainId = await client.getChainId();
  if (chainId !== CCTP_ROUTE.destinationChainId) {
    throw new Error(
      `Destination RPC is chain ${chainId}, not Arc Testnet (${CCTP_ROUTE.destinationChainId}).`,
    );
  }
  const bytecode = await client.getBytecode({ address: recipient });
  if (!bytecode || bytecode === "0x") {
    throw new Error(
      `GUARDED_WALLET ${recipient} has no deployed bytecode on Arc Testnet; refusing an EOA.`,
    );
  }
  let owner: unknown;
  try {
    owner = await client.readContract({
      address: recipient,
      abi: OWNER_ABI,
      functionName: "owner",
    });
  } catch {
    throw new Error(
      `GUARDED_WALLET ${recipient} is deployed but owner() could not be read; refusing it.`,
    );
  }
  if (typeof owner !== "string" || !isAddress(owner, { strict: false })) {
    throw new Error(`GUARDED_WALLET ${recipient} returned an invalid owner() value.`);
  }
}

export async function waitForReceipt(
  client: SourcePublicClient,
  hash: Hash,
): Promise<"success" | "reverted"> {
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: TRANSACTION_TIMEOUT_MS,
    pollingInterval: 1_000,
  });
  return receipt.status;
}

export async function simulateAndSend(
  publicClient: SourcePublicClient,
  walletClient: WalletClient,
  account: LocalAccount,
  tx: { to: Address; data: `0x${string}` },
  beforeBroadcast: () => void,
  nonce?: number,
): Promise<Hash> {
  await publicClient.call({
    account: account.address,
    to: tx.to,
    data: tx.data,
    value: 0n,
  });
  const request = await publicClient.prepareTransactionRequest({
    account: account.address,
    chain: sepolia,
    to: tx.to,
    data: tx.data,
    value: 0n,
    type: "eip1559",
    ...(nonce === undefined ? {} : { nonce }),
  });
  beforeBroadcast();
  // The prepared request is tied to our concrete Sepolia chain/account. The
  // unconstrained WalletClient type otherwise intersects its send parameters
  // with every possible chain and reduces them to `never`.
  // `prepareTransactionRequest` intentionally uses the address for the
  // simulation/RPC account. Passing that address back to a WalletClient makes
  // viem treat it as a JSON-RPC account and call eth_sendTransaction. Keep the
  // concrete LocalAccount here so Circle/private-key signers sign locally and
  // the transport receives only eth_sendRawTransaction.
  const sendPrepared = walletClient.sendTransaction as unknown as (
    prepared: Omit<typeof request, "account"> & { account: LocalAccount },
  ) => Promise<Hash>;
  return sendPrepared({ ...request, account });
}
