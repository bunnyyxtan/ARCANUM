import {
  type Address,
  type EIP1193Provider,
  createWalletClient,
  custom,
  isAddress,
  isAddressEqual,
  parseUnits,
  publicActions,
} from "viem";
import { sepolia } from "viem/chains";

import type { CctpQuote, CctpStatus } from "@/lib/cctp";

import { type FundingIntent, isStrictTransactionHash } from "./cctp-funding-storage";

export type FundingStage = "COMPLETED" | "POLLING_STATUS" | "SOURCE_FAILED";

export function createFundingWalletClient(provider: EIP1193Provider) {
  return createWalletClient({ chain: sepolia, transport: custom(provider) }).extend(publicActions);
}

const statusStages = new Set([
  "source_pending",
  "attestation_pending",
  "forwarding",
  "completed",
  "source_failed",
]);

function isBaseUnitString(value: unknown): value is string {
  return typeof value === "string" && /^\d+$/.test(value);
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Malformed CCTP ${label} response.`);
  }
  return value as Record<string, unknown>;
}

export function assertValidCctpQuote(value: unknown, amountUsdc: string): CctpQuote {
  const quote = asRecord(value, "quote");
  if (
    !isBaseUnitString(quote.amountBaseUnits) ||
    !isBaseUnitString(quote.maxFeeBaseUnits) ||
    !isBaseUnitString(quote.minimumReceivedBaseUnits) ||
    typeof quote.expiresAt !== "number" ||
    !Number.isFinite(quote.expiresAt) ||
    quote.expiresAt <= Date.now()
  ) {
    throw new Error("Malformed or expired CCTP quote.");
  }
  let requestedAmount: bigint;
  try {
    requestedAmount = parseUnits(amountUsdc, 6);
  } catch {
    throw new Error("Enter a USDC amount with at most 6 decimal places.");
  }
  const amount = BigInt(quote.amountBaseUnits);
  const fee = BigInt(quote.maxFeeBaseUnits);
  const minimumReceived = BigInt(quote.minimumReceivedBaseUnits);
  if (
    requestedAmount <= 0n ||
    amount !== requestedAmount ||
    fee >= amount ||
    minimumReceived !== amount - fee
  ) {
    throw new Error("Malformed CCTP quote amounts.");
  }
  return quote as unknown as CctpQuote;
}

export function quoteTermsChanged(previous: CctpQuote, refreshed: CctpQuote): boolean {
  return (
    previous.amountBaseUnits !== refreshed.amountBaseUnits ||
    previous.maxFeeBaseUnits !== refreshed.maxFeeBaseUnits ||
    previous.minimumReceivedBaseUnits !== refreshed.minimumReceivedBaseUnits
  );
}

/**
 * Circle's current forwarding fee can move by minor units while approval confirms.
 * The original quote is the user's maximum fee and minimum-received commitment; it
 * remains safe to use only while it is fresh and the newly required cap did not rise.
 */
export function canUseOriginalQuoteForBurn(original: CctpQuote, refreshed: CctpQuote): boolean {
  if (original.expiresAt <= Date.now() || original.amountBaseUnits !== refreshed.amountBaseUnits) {
    return false;
  }
  try {
    return BigInt(refreshed.maxFeeBaseUnits) <= BigInt(original.maxFeeBaseUnits);
  } catch {
    return false;
  }
}

export function burnNonceForIntent(intent: FundingIntent): number {
  return intent.sourceNonce;
}

export function assertSelectedFundingAccount(
  accounts: readonly Address[],
  expectedAccount: Address,
): void {
  if (!accounts.some((account) => isAddressEqual(account, expectedAccount))) {
    throw new Error("The selected connector is not signed in as the connected wallet.");
  }
}

export function assertSuccessfulApprovalReceipt(receipt: { status: unknown }): void {
  if (receipt.status !== "success") {
    throw new Error("USDC approval reverted; no burn was sent.");
  }
}

export function fundingStateForStage(stage: CctpStatus["stage"]): FundingStage {
  if (stage === "completed") return "COMPLETED";
  if (stage === "source_failed") return "SOURCE_FAILED";
  return "POLLING_STATUS";
}

function statusMetadata(status: CctpStatus): Record<string, unknown> {
  return status as unknown as Record<string, unknown>;
}

export function fundingIntentFromStatus(status: CctpStatus): FundingIntent {
  const metadata = statusMetadata(status);
  if (
    typeof metadata.sourceNonce !== "number" ||
    !Number.isSafeInteger(metadata.sourceNonce) ||
    metadata.sourceNonce < 0 ||
    !isBaseUnitString(metadata.sourceBlockNumber) ||
    !isBaseUnitString(status.amountBaseUnits) ||
    !isBaseUnitString(metadata.maxFeeBaseUnits)
  ) {
    throw new Error("The confirmed CCTP burn is missing its source identity.");
  }
  return {
    amountBaseUnits: status.amountBaseUnits,
    maxFeeBaseUnits: metadata.maxFeeBaseUnits,
    sourceBlockNumber: metadata.sourceBlockNumber,
    sourceNonce: metadata.sourceNonce,
  };
}

export function assertStatusMatchesFundingIntent(
  status: CctpStatus,
  intent: FundingIntent,
  recipient: Address,
  sender: Address,
): void {
  const metadata = statusMetadata(status);
  const confirmed = fundingIntentFromStatus(status);
  if (
    !status.sender ||
    !isAddressEqual(status.sender, sender) ||
    typeof metadata.recipient !== "string" ||
    !isAddress(metadata.recipient, { strict: false }) ||
    !isAddressEqual(metadata.recipient, recipient) ||
    confirmed.sourceNonce !== intent.sourceNonce ||
    confirmed.amountBaseUnits !== intent.amountBaseUnits ||
    confirmed.maxFeeBaseUnits !== intent.maxFeeBaseUnits ||
    BigInt(confirmed.sourceBlockNumber) < BigInt(intent.sourceBlockNumber)
  ) {
    throw new Error("The confirmed CCTP burn does not match the saved wallet request.");
  }
}

export function assertImportableCctpStatus(status: CctpStatus): void {
  if (!status.sender || status.stage === "source_pending") {
    throw new Error(
      "The imported burn is not yet a confirmed CCTP transfer from the connected wallet.",
    );
  }
}

export function assertValidCctpStatus(
  value: unknown,
  expectedBurnTxHash: string,
  expectedRecipient: Address,
  expectedSender?: Address,
): CctpStatus {
  const status = asRecord(value, "status");
  const sourceNonce = status.sourceNonce;
  const sourceBlockNumber = status.sourceBlockNumber;
  const maxFeeBaseUnits = status.maxFeeBaseUnits;
  const burnTxHash = typeof status.burnTxHash === "string" ? status.burnTxHash : "";
  if (
    typeof status.stage !== "string" ||
    !statusStages.has(status.stage) ||
    !isStrictTransactionHash(burnTxHash) ||
    !isStrictTransactionHash(expectedBurnTxHash) ||
    burnTxHash.toLowerCase() !== expectedBurnTxHash.toLowerCase()
  ) {
    throw new Error("Malformed CCTP status response.");
  }
  for (const field of [
    "amountBaseUnits",
    "receivedBaseUnits",
    "feeBaseUnits",
    "balanceBaseUnits",
  ]) {
    if (status[field] !== undefined && !isBaseUnitString(status[field])) {
      throw new Error("Malformed CCTP status amount.");
    }
  }
  if (status.mintTxHash !== undefined && !isStrictTransactionHash(String(status.mintTxHash))) {
    throw new Error("Malformed CCTP mint transaction hash.");
  }
  if (status.sender !== undefined) {
    if (typeof status.sender !== "string" || !isAddress(status.sender, { strict: false })) {
      throw new Error("Malformed CCTP source sender.");
    }
    if (expectedSender && !isAddressEqual(status.sender, expectedSender)) {
      throw new Error("This burn transaction belongs to a different connected wallet.");
    }
  }
  // The API request itself binds the server-side status lookup to this recipient. If an
  // implementation also returns it, reject a contradictory response rather than ignoring it.
  if (
    status.recipient !== undefined &&
    (typeof status.recipient !== "string" ||
      !isAddress(status.recipient, { strict: false }) ||
      !isAddressEqual(status.recipient, expectedRecipient))
  ) {
    throw new Error("This burn transaction is for a different recipient.");
  }
  if (status.detail !== undefined && typeof status.detail !== "string") {
    throw new Error("Malformed CCTP status detail.");
  }
  if (status.forwardState !== undefined && typeof status.forwardState !== "string") {
    throw new Error("Malformed CCTP forwarding state.");
  }
  if (
    sourceNonce !== undefined &&
    (typeof sourceNonce !== "number" || !Number.isSafeInteger(sourceNonce) || sourceNonce < 0)
  ) {
    throw new Error("Malformed CCTP source nonce.");
  }
  if (sourceBlockNumber !== undefined && !isBaseUnitString(sourceBlockNumber)) {
    throw new Error("Malformed CCTP source block number.");
  }
  if (maxFeeBaseUnits !== undefined && !isBaseUnitString(maxFeeBaseUnits)) {
    throw new Error("Malformed CCTP maximum fee.");
  }
  return status as unknown as CctpStatus;
}

export function isKnownUserRejection(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === 4001 || code === "ACTION_REJECTED") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /user rejected|user denied|request rejected|action_rejected/i.test(message);
}
