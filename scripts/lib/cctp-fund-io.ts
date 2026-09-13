import { type Address, type Hash, formatUnits, parseUnits } from "viem";

import { type CctpQuote, type CctpStatus, getCctpStatus } from "../../packages/sdk/src/cctp";
import {
  CCTP_STATE_DIR,
  type CctpFundingState,
  type CctpPendingMarker,
  type CctpRunPhase,
  type CctpStateIdentity,
  readCctpPendingMarker,
  readCctpState,
  updateCctpState,
} from "./cctp-state";

export const USDC_DECIMALS = 6;
export const WATCH_ATTEMPTS = 12;
export const WATCH_INTERVAL_MS = 5_000;

export function safeError(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  // Circle's adapter already redacts credentials in its own errors. Do not
  // read secret environment variables here: quote/status/watch remain usable
  // without secret handling at all.
  // Do not persist or print calldata/signature-sized hex from viem errors.
  message = message.replace(/0x[0-9a-fA-F]{40,}/g, "[redacted hex]");
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

export function parseAmount(value: string | undefined): string {
  if (!value || value.startsWith("-") || value.startsWith("+") || value.trim() !== value) {
    throw new Error("USDC total must be a positive decimal amount with no sign or whitespace.");
  }
  let units: bigint;
  try {
    units = parseUnits(value, USDC_DECIMALS);
  } catch {
    throw new Error("USDC total must be an exact decimal amount with at most 6 decimals.");
  }
  if (units <= 0n) throw new Error("USDC total must be greater than zero.");
  return value;
}

export function parseHash(value: string | undefined): Hash {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("burnTxHash must be a 32-byte 0x-prefixed transaction hash.");
  }
  return value as Hash;
}

export function printQuote(quote: CctpQuote): void {
  console.log(
    `total       ${formatUnits(BigInt(quote.amountBaseUnits), USDC_DECIMALS)} USDC (${quote.amountBaseUnits} base units)`,
  );
  console.log(
    `max fee     ${formatUnits(BigInt(quote.maxFeeBaseUnits), USDC_DECIMALS)} USDC (${quote.maxFeeBaseUnits} base units)`,
  );
  console.log(
    `minimum     ${formatUnits(BigInt(quote.minimumReceivedBaseUnits), USDC_DECIMALS)} USDC (${quote.minimumReceivedBaseUnits} base units)`,
  );
  console.log(`expires     ${formatQuoteExpiry(quote.expiresAt)}`);
}

/** CCTP quote expiry is a Unix timestamp in milliseconds. */
export function formatQuoteExpiry(expiresAt: number): string {
  return new Date(expiresAt).toISOString();
}

export function isQuoteExpired(expiresAt: number, now = Date.now()): boolean {
  return now >= expiresAt;
}

export function printStatus(status: CctpStatus): void {
  console.log(`stage       ${status.stage}`);
  console.log(`burn        ${status.burnTxHash}`);
  if (status.mintTxHash) console.log(`mint        ${status.mintTxHash}`);
  if (status.forwardState) console.log(`forward     ${safeError(status.forwardState)}`);
  if (status.forwardState)
    console.log(
      "forward note Circle metadata only; COMPLETE is not proof of automatic broadcast (manual relay can also report COMPLETE)",
    );
  if (status.sender) console.log(`sender      ${status.sender}`);
  if (status.amountBaseUnits) console.log(`burn amount ${status.amountBaseUnits} base units`);
  if (status.feeBaseUnits) console.log(`fee         ${status.feeBaseUnits} base units`);
  if (status.receivedBaseUnits) console.log(`received    ${status.receivedBaseUnits} base units`);
  if (status.balanceBaseUnits) console.log(`balance     ${status.balanceBaseUnits} base units`);
  const identity = statusIdentity(status);
  if (identity?.sourceNonce !== undefined) console.log(`source nonce ${identity.sourceNonce}`);
  if (identity?.sourceBlockNumber) console.log(`source block ${identity.sourceBlockNumber}`);
  if (identity?.maxFeeBaseUnits) console.log(`max fee     ${identity.maxFeeBaseUnits} base units`);
  if (identity?.recipient) console.log(`recipient   ${identity.recipient}`);
  if (status.detail) console.log(`detail      ${safeError(status.detail)}`);
}

export function phaseForStatus(stage: CctpStatus["stage"]): CctpRunPhase {
  return stage;
}

function sameHash(left: string | undefined, right: Hash): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

export interface CctpSourceIdentity {
  sender: Address;
  recipient: Address;
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  sourceNonce: number;
  sourceBlockNumber: string;
}

type CctpStatusWithIdentity = CctpStatus & {
  sourceNonce?: number;
  sourceBlockNumber?: string;
  maxFeeBaseUnits?: string;
  recipient?: Address;
};

export interface CctpRecoveryCheck {
  linked: boolean;
  terminalVerified: boolean;
  pendingWithoutProof: boolean;
  reason?: string;
}

function isTerminalStatus(stage: CctpStatus["stage"]): boolean {
  return stage === "source_failed" || stage === "completed";
}

function statusIdentity(status: CctpStatus): Partial<CctpSourceIdentity> | undefined {
  const value = status as CctpStatusWithIdentity;
  if (
    value.sender === undefined &&
    value.recipient === undefined &&
    value.amountBaseUnits === undefined &&
    value.maxFeeBaseUnits === undefined &&
    value.sourceNonce === undefined &&
    value.sourceBlockNumber === undefined
  ) {
    return undefined;
  }
  if (
    typeof value.sender !== "string" ||
    typeof value.recipient !== "string" ||
    typeof value.amountBaseUnits !== "string" ||
    typeof value.maxFeeBaseUnits !== "string" ||
    !Number.isSafeInteger(value.sourceNonce) ||
    (value.sourceNonce as number) < 0 ||
    typeof value.sourceBlockNumber !== "string" ||
    !/^(0|[1-9][0-9]*)$/.test(value.sourceBlockNumber)
  ) {
    return {};
  }
  return {
    sender: value.sender,
    recipient: value.recipient,
    amountBaseUnits: value.amountBaseUnits,
    maxFeeBaseUnits: value.maxFeeBaseUnits,
    sourceNonce: value.sourceNonce,
    sourceBlockNumber: value.sourceBlockNumber,
  };
}

function stateIdentity(state: CctpFundingState): CctpSourceIdentity | undefined {
  if (!state.sender || state.sourceNonce === undefined || state.sourceBlockNumber === undefined) {
    return undefined;
  }
  return {
    sender: state.sender,
    recipient: state.recipient,
    amountBaseUnits: state.amountBaseUnits,
    maxFeeBaseUnits: state.maxFeeBaseUnits,
    sourceNonce: state.sourceNonce,
    sourceBlockNumber: state.sourceBlockNumber,
  };
}

function markerIdentity(marker: CctpPendingMarker | undefined): CctpSourceIdentity | undefined {
  const intent = marker?.intent;
  if (!intent || intent.sourceNonce === undefined || intent.sourceBlockNumber === undefined) {
    return undefined;
  }
  return {
    sender: intent.sender,
    recipient: intent.recipient,
    amountBaseUnits: intent.amountBaseUnits,
    maxFeeBaseUnits: intent.maxFeeBaseUnits,
    sourceNonce: intent.sourceNonce,
    sourceBlockNumber: intent.sourceBlockNumber,
  };
}

function sameIdentity(left: CctpSourceIdentity, right: CctpSourceIdentity): boolean {
  return samePreparedIdentity(left, right) && left.sourceBlockNumber === right.sourceBlockNumber;
}

function samePreparedIdentity(left: CctpSourceIdentity, right: CctpSourceIdentity): boolean {
  return (
    left.sender.toLowerCase() === right.sender.toLowerCase() &&
    left.recipient.toLowerCase() === right.recipient.toLowerCase() &&
    left.amountBaseUnits === right.amountBaseUnits &&
    left.maxFeeBaseUnits === right.maxFeeBaseUnits &&
    left.sourceNonce === right.sourceNonce
  );
}

/**
 * Recovery is intentionally a proof check, not a transaction lookup
 * convenience. A hash alone, or matching sender/recipient/amount, cannot
 * adopt a historical burn into an unresolved local run.
 */
export function validateCctpRecovery(
  state: CctpFundingState | undefined,
  marker: CctpPendingMarker | undefined,
  burnTxHash: Hash,
  status: CctpStatus,
): CctpRecoveryCheck {
  if (!state?.burnTxHash) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: !isTerminalStatus(status.stage),
      reason: "No durable burn hash is recorded; refusing to adopt a historical hash.",
    };
  }
  if (!sameHash(state.burnTxHash, burnTxHash)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "Recovery hash does not match the durable burn hash.",
    };
  }
  const expected = stateIdentity(state);
  if (!expected) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "Durable burn intent has no complete source nonce/block identity.",
    };
  }
  if (marker && !markerIdentity(marker)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "Pending marker has no complete identity; refusing to unlock a legacy marker.",
    };
  }
  const markerProof = markerIdentity(marker);
  if (markerProof && !sameIdentity(expected, markerProof)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "Pending marker identity does not match the durable burn intent.",
    };
  }
  const observed = statusIdentity(status);
  if (!observed || !("sourceNonce" in observed)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: !isTerminalStatus(status.stage),
      reason: "CCTP status has no complete confirmed-source identity proof.",
    };
  }
  if (
    !observed.sender ||
    !observed.recipient ||
    !observed.amountBaseUnits ||
    !observed.maxFeeBaseUnits ||
    observed.sourceNonce === undefined ||
    !observed.sourceBlockNumber
  ) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: !isTerminalStatus(status.stage),
      reason: "CCTP status identity proof is incomplete.",
    };
  }
  const observedIdentity = observed as CctpSourceIdentity;
  if (!samePreparedIdentity(expected, observedIdentity)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "CCTP status identity does not match the prepared burn intent.",
    };
  }
  if (BigInt(observedIdentity.sourceBlockNumber) < BigInt(expected.sourceBlockNumber)) {
    return {
      linked: false,
      terminalVerified: false,
      pendingWithoutProof: false,
      reason: "CCTP status source block precedes the prepared burn anchor.",
    };
  }
  return {
    linked: true,
    terminalVerified: status.stage === "source_failed" || status.stage === "completed",
    pendingWithoutProof: false,
  };
}

export function identityFor(recipient: Address, sourceChainId: number): CctpStateIdentity {
  return { recipient, sourceChainId };
}

export function saveObservedStatus(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
  status: CctpStatus,
  directory = CCTP_STATE_DIR,
): CctpFundingState | undefined {
  const local = readCctpState(identity, directory);
  const marker = readCctpPendingMarker(identity, directory);
  const check = validateCctpRecovery(local, marker, burnTxHash, status);
  if (!local || !check.linked) return local;
  return updateCctpState(
    identity,
    {
      phase: phaseForStatus(status.stage),
      lastStage: phaseForStatus(status.stage),
      sourceError:
        status.stage === "source_failed"
          ? safeError(status.detail || "Source burn failed.")
          : local.sourceError,
      lastError: undefined,
      pollCount: local.pollCount + 1,
      lastCheckedAt: Date.now(),
      burnTxHash: status.burnTxHash,
      sourceProofVerified: true,
    },
    directory,
  );
}

export function saveObservedError(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
  error: unknown,
): void {
  const local = readCctpState(identity);
  if (!local || !sameHash(local.burnTxHash, burnTxHash)) return;
  updateCctpState(identity, {
    // A failed RPC call is not a CCTP stage. Preserve the last verified
    // stage/source hash and only record the transport error.
    lastError: safeError(error),
    lastCheckedAt: Date.now(),
    pollCount: local.pollCount + 1,
  });
}

export async function fetchStatus(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
): Promise<{ status: CctpStatus; recovery: CctpRecoveryCheck }> {
  const local = readCctpState(identity);
  const persistedMintTxHash =
    local?.burnTxHash && sameHash(local.burnTxHash, burnTxHash) ? local.mintTxHash : undefined;
  const status = await getCctpStatus({
    burnTxHash,
    recipient: identity.recipient,
    ...(persistedMintTxHash ? { mintTxHash: persistedMintTxHash } : {}),
  });
  const marker = readCctpPendingMarker(identity);
  const recovery = validateCctpRecovery(local, marker, burnTxHash, status);
  if (recovery.linked) saveObservedStatus(identity, burnTxHash, status);
  return { status, recovery };
}

export function resumeCommand(hash: Hash): string {
  return `npx tsx scripts/cctp-fund.ts watch ${hash}`;
}
