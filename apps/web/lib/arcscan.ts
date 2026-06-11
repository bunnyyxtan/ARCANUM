import { ARC_TESTNET_EXPLORER_URL } from "@arcanum/shared";

import { isEvmAddress } from "@/lib/format/address";

export function getArcscanBaseUrl() {
  return process.env.NEXT_PUBLIC_ARCSCAN_URL ?? ARC_TESTNET_EXPLORER_URL;
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
