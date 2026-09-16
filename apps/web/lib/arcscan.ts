import { ARC_EXPLORER_URL, IS_ARC_MAINNET } from "@arcanum/shared";

import { isEvmAddress } from "@/lib/format/address";

/**
 * NEXT_PUBLIC_ARCSCAN_URL is the legacy testnet-only explorer override. On
 * mainnet the explorer comes from the shared network module (which has its
 * own NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL override), so an env file copied
 * from a testnet deployment cannot point mainnet links at the testnet explorer.
 */
export function getArcscanBaseUrl() {
  if (IS_ARC_MAINNET) {
    return ARC_EXPLORER_URL;
  }
  return process.env.NEXT_PUBLIC_ARCSCAN_URL ?? ARC_EXPLORER_URL;
}

export function isValidTxHash(value: string | null | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^0x[a-fA-F0-9]{64}$/.test(trimmed));
}

export function getArcscanAddressUrl(address: string | null | undefined) {
  if (!isEvmAddress(address)) {
    return null;
  }

  return `${getArcscanBaseUrl()}/address/${address}`;
}

export function getArcscanTxUrl(txHash: string | null | undefined) {
  if (!isValidTxHash(txHash)) {
    return null;
  }

  return `${getArcscanBaseUrl()}/tx/${txHash}`;
}
