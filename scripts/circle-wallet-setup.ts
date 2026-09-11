/**
 * Sets up a Circle developer-controlled wallet as the agent signer of a
 * governed wallet. Two steps, run by two different roles:
 *
 *   npx tsx scripts/circle-wallet-setup.ts create
 *       Circle account: creates a wallet set and one EVM-TESTNET EOA in it,
 *       and prints the CIRCLE_WALLET_ID / CIRCLE_WALLET_ADDRESS to export.
 *       Every run creates new objects; after an ambiguous failure check the
 *       Circle console instead of rerunning, or reuse CIRCLE_WALLET_SET_ID.
 *
 *   npx tsx scripts/circle-wallet-setup.ts authorize
 *       Governed wallet owner: calls GuardedWallet.addSigner for the Circle
 *       wallet address and sends it a little native USDC for gas. Skips each
 *       part that is already done, so it can be rerun.
 *
 * Environment:
 *   create
 *     CIRCLE_API_KEY          Circle developer API key (a testnet key for EVM-TESTNET)
 *     CIRCLE_ENTITY_SECRET    the entity secret registered in the Circle console
 *     CIRCLE_WALLET_SET_ID    optional: reuse an existing wallet set instead of creating one
 *     CIRCLE_WALLET_SET_NAME  name for a new wallet set (default "arcanum-agents")
 *     CIRCLE_BLOCKCHAIN       Circle blockchain id for the wallet (default "EVM-TESTNET";
 *                             "EVM" for mainnet). Circle's sign/transaction endpoint
 *                             is only available for the generic EVM ids, so a wallet
 *                             created on ARC-TESTNET can sign messages but not
 *                             transactions.
 *   authorize
 *     CIRCLE_WALLET_ADDRESS   the address printed by create
 *     GUARDED_WALLET          the governed wallet
 *     OWNER_PRIVATE_KEY       the governed wallet's owner key (never commit it)
 *     GAS_USDC                native USDC to send the signer for gas (default "0.5")
 *     ARC_TESTNET_RPC         optional RPC override
 *
 * The dashboard keeps its own list of signers for the wallet page; a signer
 * added here is authorized onchain (policy, receipts and evidence all read
 * the chain) and appears in the dashboard once its signer state is synced
 * from an owner session. See docs/CIRCLE-WALLETS.md.
 */

import { randomUUID } from "node:crypto";

import {
  http,
  createPublicClient,
  createWalletClient,
  formatUnits,
  isAddress,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { GuardedWalletAbi } from "../packages/contracts/index";
import { ARC_TESTNET_RPC_URL, arcTestnet } from "../packages/sdk/src/chains";
import { CircleWalletsApi } from "../packages/sdk/src/circle-api";

const CIRCLE_BLOCKCHAIN = process.env.CIRCLE_BLOCKCHAIN?.trim() || "EVM-TESTNET";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} before running this step.`);
  }
  return value;
}

function hexEnv(name: string): `0x${string}` {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed hex value.`);
  }
  return value as `0x${string}`;
}

function addressEnv(name: string): `0x${string}` {
  const value = hexEnv(name);
  if (!isAddress(value)) {
    throw new Error(`${name} must be a 20-byte address.`);
  }
  return value;
}

interface CircleWallet {
  id: string;
  address: string;
  blockchain: string;
  state: string;
  accountType?: string;
}

async function create(): Promise<void> {
  const api = new CircleWalletsApi({
    apiKey: requireEnv("CIRCLE_API_KEY"),
    entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
  });

  let walletSetId = process.env.CIRCLE_WALLET_SET_ID?.trim();
  if (walletSetId) {
    console.log(`wallet set  ${walletSetId} (reused)`);
  } else {
    const created = await api.post<{ walletSet?: { id?: string } }>(
      "/v1/w3s/developer/walletSets",
      {
        idempotencyKey: randomUUID(),
        name: process.env.CIRCLE_WALLET_SET_NAME?.trim() || "arcanum-agents",
      },
    );
    walletSetId = created.walletSet?.id;
    if (!walletSetId) {
      throw new Error("Circle did not return a wallet set id.");
    }
    console.log(`wallet set  ${walletSetId}`);
  }

  const created = await api.post<{ wallets?: CircleWallet[] }>("/v1/w3s/developer/wallets", {
    idempotencyKey: randomUUID(),
    blockchains: [CIRCLE_BLOCKCHAIN],
    accountType: "EOA",
    count: 1,
    walletSetId,
  });
  const wallet = created.wallets?.[0];
  if (!wallet?.id || !isAddress(wallet.address ?? "")) {
    throw new Error("Circle did not return a wallet with an id and an address.");
  }
  if (wallet.blockchain !== CIRCLE_BLOCKCHAIN) {
    throw new Error(`Circle created the wallet on ${wallet.blockchain}, not ${CIRCLE_BLOCKCHAIN}.`);
  }

  console.log(`wallet      ${wallet.id} ${wallet.state}`);
  console.log(`address     ${wallet.address}`);
  console.log("\nexport these for the agent runtime and for the authorize step:");
  console.log(`  CIRCLE_WALLET_ID=${wallet.id}`);
  console.log(`  CIRCLE_WALLET_ADDRESS=${wallet.address}`);
  console.log(
    "\nnext: as the governed wallet owner, run `circle-wallet-setup.ts authorize` to add the",
  );
  console.log("signer onchain and fund its gas.");
}

async function authorize(): Promise<void> {
  const signer = addressEnv("CIRCLE_WALLET_ADDRESS");
  const guardedWallet = addressEnv("GUARDED_WALLET");
  const owner = privateKeyToAccount(hexEnv("OWNER_PRIVATE_KEY"));
  const gasUsdc = process.env.GAS_USDC?.trim() || "0.5";
  const transport = http(process.env.ARC_TESTNET_RPC?.trim() || ARC_TESTNET_RPC_URL);
  const publicClient = createPublicClient({ chain: arcTestnet, transport });
  const walletClient = createWalletClient({ account: owner, chain: arcTestnet, transport });

  const onchainOwner = await publicClient.readContract({
    address: guardedWallet,
    abi: GuardedWalletAbi,
    functionName: "owner",
  });
  if (onchainOwner.toLowerCase() !== owner.address.toLowerCase()) {
    throw new Error(
      `OWNER_PRIVATE_KEY is ${owner.address}, but ${guardedWallet} is owned by ${onchainOwner}.`,
    );
  }
  console.log(`owner       ${owner.address}`);
  console.log(`wallet      ${guardedWallet}`);
  console.log(`signer      ${signer}`);

  const alreadySigner = await publicClient.readContract({
    address: guardedWallet,
    abi: GuardedWalletAbi,
    functionName: "agentSigners",
    args: [signer],
  });
  if (alreadySigner) {
    console.log("addSigner   already authorized, skipped");
  } else {
    const hash = await walletClient.writeContract({
      address: guardedWallet,
      abi: GuardedWalletAbi,
      functionName: "addSigner",
      args: [signer],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`addSigner reverted in ${hash}.`);
    }
    console.log(`addSigner   ${hash} (block ${receipt.blockNumber})`);
  }

  const wanted = parseUnits(gasUsdc, arcTestnet.nativeCurrency.decimals);
  const balance = await publicClient.getBalance({ address: signer });
  if (balance >= wanted) {
    console.log(
      `gas         signer already holds ${formatUnits(balance, arcTestnet.nativeCurrency.decimals)} USDC, skipped`,
    );
  } else {
    const hash = await walletClient.sendTransaction({ to: signer, value: wanted - balance });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new Error(`gas transfer reverted in ${hash}.`);
    }
    console.log(
      `gas         sent ${formatUnits(wanted - balance, arcTestnet.nativeCurrency.decimals)} USDC in ${hash}`,
    );
  }
  console.log(
    "\nnext: run `receipts-demo.ts allow --execute` with the four CIRCLE_* variables set.",
  );
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command === "create") {
    await create();
    return;
  }
  if (command === "authorize") {
    await authorize();
    return;
  }
  throw new Error("Usage: circle-wallet-setup.ts <create|authorize>");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? `${error.code}: `
      : "";
  console.error(`\nsetup failed: ${code}${message}`);
  process.exitCode = 1;
});
