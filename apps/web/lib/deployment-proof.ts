import { parseEventLogs } from "viem";
import type { Address, Hash } from "viem";

import { walletFactoryAbi } from "@/lib/contracts";
import { isConfiguredAddress, isSameAddress } from "@/lib/format/address";

type WalletCreationLog = {
  address?: string;
  data?: string;
  topics?: readonly string[];
};

export type WalletCreationReceipt = {
  status: string;
  logs: readonly WalletCreationLog[];
};

/**
 * A predicted CREATE2 address is useful before signing but is never proof of
 * deployment. Only a successful receipt containing WalletCreated from the
 * configured factory, for the connected owner, is an authoritative result.
 */
export function walletCreatedFromVerifiedReceipt(
  receipt: WalletCreationReceipt,
  input: {
    factoryAddress: string;
    ownerAddress: string;
    predictedWallet?: string | null;
  },
): Address {
  if (receipt.status !== "success") {
    throw new Error("Wallet deployment transaction reverted.");
  }
  if (!isConfiguredAddress(input.factoryAddress)) {
    throw new Error("Wallet factory address is not configured.");
  }

  for (const log of receipt.logs) {
    if (!log.address || !isSameAddress(log.address, input.factoryAddress)) continue;
    if (!log.data || !log.topics) continue;
    try {
      const [parsed] = parseEventLogs({
        abi: walletFactoryAbi,
        eventName: "WalletCreated",
        logs: [log] as unknown as Parameters<typeof parseEventLogs>[0]["logs"],
      });
      const wallet = parsed?.args.wallet;
      const owner = parsed?.args.owner;
      if (
        wallet &&
        owner &&
        isSameAddress(owner, input.ownerAddress) &&
        (!input.predictedWallet || isSameAddress(wallet, input.predictedWallet))
      ) {
        return wallet;
      }
    } catch {
      // A log from the configured address with another event signature is not
      // creation proof. Continue searching for the one matching event.
    }
  }

  throw new Error(
    "Successful deployment did not emit a matching WalletCreated event from the configured factory and owner.",
  );
}

export function walletCreationProofInput(
  factoryAddress: Address,
  ownerAddress: Address,
  predictedWallet: Address | null | undefined,
  txHash: Hash,
) {
  return { factoryAddress, ownerAddress, predictedWallet, txHash };
}
