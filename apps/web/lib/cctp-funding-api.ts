import type { Address, Hash } from "viem";

import type { CctpQuote, CctpStatus } from "@/lib/cctp";

import {
  assertStatusMatchesFundingIntent,
  assertValidCctpQuote,
  assertValidCctpStatus,
  canUseOriginalQuoteForBurn,
} from "./cctp-funding-flow";
import {
  type FundingStorage,
  type StoredFundingTransfer,
  cctpFundingPendingKey,
  linkPendingFundingMarker,
  pendingFundingIntent,
  removeFundingStorageIfMatches,
} from "./cctp-funding-storage";

export class CctpFundingApiError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean, options?: ErrorOptions) {
    super(message, options);
    this.name = "CctpFundingApiError";
    this.retryable = retryable;
  }
}

async function responseBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function apiError(body: unknown, fallback: string): string {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string"
    ? body.error
    : fallback;
}

export async function requestCctpQuote(
  amountUsdc: string,
  signal?: AbortSignal,
): Promise<CctpQuote> {
  const response = await fetch(`/api/cctp/quote?amount=${encodeURIComponent(amountUsdc)}`, {
    signal,
  });
  const body = await responseBody(response);
  if (!response.ok) {
    throw new Error(apiError(body, "Failed to fetch CCTP quote."));
  }
  if (!body || typeof body !== "object" || !("quote" in body)) {
    throw new Error("Malformed CCTP quote response.");
  }
  return assertValidCctpQuote(body.quote, amountUsdc);
}

export async function revalidateCctpQuoteForBurn(
  reviewedQuote: CctpQuote,
  amountUsdc: string,
): Promise<void> {
  let refreshedQuote: CctpQuote;
  try {
    refreshedQuote = await requestCctpQuote(amountUsdc);
  } catch {
    throw new Error("Could not revalidate the CCTP quote before burning. No burn was sent.");
  }
  if (!canUseOriginalQuoteForBurn(reviewedQuote, refreshedQuote)) {
    throw new Error(
      "CCTP requires a higher fee or the approved quote expired. Review a new quote; no burn was sent.",
    );
  }
}

export async function requestCctpStatus(
  hash: Hash,
  recipient: Address,
  sender: Address,
  signal?: AbortSignal,
): Promise<CctpStatus> {
  let response: Response;
  try {
    response = await fetch(
      `/api/cctp/status?burnTxHash=${encodeURIComponent(hash)}&recipient=${encodeURIComponent(recipient)}`,
      { signal },
    );
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new CctpFundingApiError("Status fetch failed", true, { cause: error });
  }
  const body = await responseBody(response);
  if (!response.ok) {
    throw new CctpFundingApiError(
      apiError(body, "Status fetch failed"),
      response.status === 408 || response.status === 429 || response.status >= 500,
    );
  }
  if (!body || typeof body !== "object" || !("transfer" in body)) {
    throw new CctpFundingApiError("Malformed CCTP status response.", false);
  }
  try {
    return assertValidCctpStatus(body.transfer, hash, recipient, sender);
  } catch (error) {
    throw new CctpFundingApiError(
      error instanceof Error ? error.message : "Malformed CCTP status response.",
      false,
      { cause: error },
    );
  }
}

/**
 * Repairs the narrow state left when the burn hash was saved but its ambiguity
 * marker could not be linked/removed. This is storage-only recovery: it never
 * requests a wallet action or submits another burn.
 */
export function clearMatchingActiveFundingMarker(
  storage: FundingStorage,
  transfer: StoredFundingTransfer,
  pendingMarker: string,
  status: CctpStatus,
  burnTxHash: Hash,
  recipient: Address,
  sender: Address,
): void {
  if (
    transfer.burnTxHash.toLowerCase() !== burnTxHash.toLowerCase() ||
    status.burnTxHash.toLowerCase() !== burnTxHash.toLowerCase()
  ) {
    throw new Error("The confirmed CCTP burn does not match the saved transfer hash.");
  }
  assertStatusMatchesFundingIntent(status, transfer, recipient, sender);
  const intent = pendingFundingIntent(pendingMarker, recipient, sender);
  if (!intent) {
    throw new Error(
      "This legacy ambiguous wallet request has no burn identity and cannot be cleared automatically.",
    );
  }
  assertStatusMatchesFundingIntent(status, intent, recipient, sender);
  const linkedMarker = linkPendingFundingMarker(
    storage,
    recipient,
    sender,
    pendingMarker,
    burnTxHash,
  );
  if (
    !removeFundingStorageIfMatches(storage, cctpFundingPendingKey(recipient, sender), linkedMarker)
  ) {
    throw new Error("CCTP pending recovery data changed in another tab.");
  }
}
