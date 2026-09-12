import type { Address } from "viem";

export const ESCALATION_TERMINAL_STATUSES = [
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
  "DENIED",
  "CANCELLED",
  "INVALIDATED",
] as const;

export type EscalationTerminalStatus = (typeof ESCALATION_TERMINAL_STATUSES)[number];
export type EscalationChainStatus = "PENDING" | EscalationTerminalStatus;

export type EscalationExpiryState = "ACTIVE" | "UNSWEPT" | "SETTLED";
export type EscalationVoteAction = "approve" | "reject";

export type EscalationChainTerms = {
  walletAddress: Address;
  counterpartyAddress: Address;
  amountBaseUnits: string;
  signaturesCount: number;
  threshold: number;
  status: EscalationChainStatus;
  expiresAt: bigint;
  policyVersion?: bigint;
};

export type EscalationDisplayedTerms = {
  walletAddress: string | null | undefined;
  counterpartyAddress: string | null | undefined;
  amountBaseUnits: string | bigint | number | null | undefined;
};

/**
 * Keep amounts as decimal base-unit strings at the UI boundary. In particular,
 * do not round-trip a uint256 through Number before comparing it with chain
 * calldata.
 */
export function normalizeBaseUnits(value: string | bigint | number | null | undefined) {
  if (typeof value === "bigint") return value >= 0n ? value.toString() : null;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) return null;
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim().replace(/^0+(?=\d)/, "");
  }
  return null;
}

export function normalizeAddress(value: string | null | undefined) {
  return /^0x[0-9a-fA-F]{40}$/.test(value ?? "") ? value?.toLowerCase() : null;
}

export function compareEscalationTerms(
  displayed: EscalationDisplayedTerms,
  chain: Pick<EscalationChainTerms, "walletAddress" | "counterpartyAddress" | "amountBaseUnits">,
) {
  const displayedWallet = normalizeAddress(displayed.walletAddress);
  const displayedCounterparty = normalizeAddress(displayed.counterpartyAddress);
  const displayedAmount = normalizeBaseUnits(displayed.amountBaseUnits);
  const chainWallet = normalizeAddress(chain.walletAddress);
  const chainCounterparty = normalizeAddress(chain.counterpartyAddress);
  const chainAmount = normalizeBaseUnits(chain.amountBaseUnits);

  if (!displayedWallet || !chainWallet || displayedWallet !== chainWallet) {
    return { ok: false as const, reason: "wallet" as const };
  }
  if (!displayedCounterparty || !chainCounterparty || displayedCounterparty !== chainCounterparty) {
    return { ok: false as const, reason: "counterparty" as const };
  }
  if (!displayedAmount || !chainAmount || displayedAmount !== chainAmount) {
    return { ok: false as const, reason: "amount" as const };
  }
  return { ok: true as const };
}

export function isEscalationTerminalStatus(status: EscalationChainStatus) {
  return status !== "PENDING";
}

export function escalationVotePreflightError(input: {
  action: EscalationVoteAction;
  status: EscalationChainStatus;
  alreadySigned: boolean;
}): string | null {
  if (input.status !== "PENDING") {
    return `Escalation is already ${input.status.toLowerCase()}.`;
  }
  if (input.action === "approve" && input.alreadySigned) {
    return "This approver has already voted on this escalation.";
  }
  return null;
}

/**
 * Expiry is not a terminal decision until the EscalationManager writes
 * EXPIRED. A pending request at (or after) its expiry is therefore actionable
 * only through the permissionless sweepExpired call.
 */
export function escalationExpiryState(input: {
  status: EscalationChainStatus;
  expiresAt: bigint;
  nowSeconds: bigint;
}): EscalationExpiryState {
  if (input.status !== "PENDING") return "SETTLED";
  return input.nowSeconds >= input.expiresAt ? "UNSWEPT" : "ACTIVE";
}

/**
 * Resolve cancellation to the actual governed-wallet contract address only
 * after both the read-model binding and current onchain owner check pass.
 * A database wallet id is intentionally not accepted by this helper.
 */
export function cancellationTargetFromChain(input: {
  displayedWalletAddress: string | null | undefined;
  chainWalletAddress: string | null | undefined;
  chainOwnerAddress: string | null | undefined;
  connectedAddress: string | null | undefined;
}) {
  const displayed = normalizeAddress(input.displayedWalletAddress);
  const chainWallet = normalizeAddress(input.chainWalletAddress);
  const chainOwner = normalizeAddress(input.chainOwnerAddress);
  const connected = normalizeAddress(input.connectedAddress);
  if (!displayed || !chainWallet || displayed !== chainWallet) return null;
  if (!chainOwner || !connected || chainOwner !== connected) return null;
  return input.chainWalletAddress as Address;
}

export function escalationStatusLabel(status: EscalationChainStatus) {
  switch (status) {
    case "EXECUTED":
      return "ESCALATION EXECUTED";
    case "REJECTED":
      return "ESCALATION REJECTED";
    case "DENIED":
      return "RELEASE DENIED BY CURRENT POLICY";
    case "EXPIRED":
      return "ESCALATION EXPIRED";
    case "CANCELLED":
      return "ESCALATION CANCELLED";
    case "INVALIDATED":
      return "ESCALATION INVALIDATED";
    default:
      return "VOTE RECORDED / QUORUM PENDING";
  }
}

/**
 * Format USDC without converting uint256 values to Number. Six decimals are
 * preserved when present so what is shown remains the exact value that was
 * compared with the chain request.
 */
export function formatBaseUnits(value: string | bigint | number | null | undefined) {
  const normalized = normalizeBaseUnits(value);
  if (normalized === null) return "UNAVAILABLE";
  const padded = normalized.padStart(7, "0");
  const whole = padded.slice(0, -6).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = padded.slice(-6).replace(/0+$/, "");
  return `$${whole}.${fraction ? fraction.padEnd(2, "0") : "00"}`;
}

/**
 * The EscalationManager tuple has deliberately small counters but uint256
 * amount/timestamps. Convert only the bounded enum/counters to Number and
 * retain amount/timestamp as bigint-derived values.
 */
export function escalationChainTermsFromDetail(detail: readonly unknown[]): EscalationChainTerms {
  const walletAddress = detail[0];
  const counterpartyAddress = detail[1];
  const amount = detail[2];
  const threshold = detail[6];
  const signaturesCount = detail[7];
  const statusIndex = detail[8];
  const expiresAt = detail[5];

  if (
    typeof walletAddress !== "string" ||
    !normalizeAddress(walletAddress) ||
    typeof counterpartyAddress !== "string" ||
    !normalizeAddress(counterpartyAddress) ||
    (typeof amount !== "bigint" && typeof amount !== "string" && typeof amount !== "number") ||
    (typeof expiresAt !== "bigint" &&
      typeof expiresAt !== "string" &&
      typeof expiresAt !== "number")
  ) {
    throw new Error("Escalation chain response is malformed.");
  }

  const amountBaseUnits = normalizeBaseUnits(amount);
  const expiryBaseUnits = normalizeBaseUnits(expiresAt);
  if (!amountBaseUnits || !expiryBaseUnits) {
    throw new Error("Escalation chain amount or expiry is malformed.");
  }

  const boundedNumber = (value: unknown, label: string) => {
    const parsed =
      typeof value === "bigint"
        ? Number(value)
        : typeof value === "number"
          ? value
          : typeof value === "string" && /^\d+$/.test(value)
            ? Number(value)
            : Number.NaN;
    if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 255) {
      throw new Error(`Escalation chain ${label} is malformed.`);
    }
    return parsed;
  };
  const statuses: EscalationChainStatus[] = [
    "PENDING",
    "EXECUTED",
    "REJECTED",
    "EXPIRED",
    "DENIED",
    "CANCELLED",
    "INVALIDATED",
  ];
  const status = statuses[boundedNumber(statusIndex, "status")];
  if (!status) throw new Error("Escalation chain returned an unknown status.");

  const thresholdNumber = boundedNumber(threshold, "threshold");
  const signaturesNumber = boundedNumber(signaturesCount, "signature count");
  const policyVersion = detail[9];
  return {
    walletAddress: walletAddress as Address,
    counterpartyAddress: counterpartyAddress as Address,
    amountBaseUnits,
    signaturesCount: signaturesNumber,
    threshold: thresholdNumber,
    status,
    expiresAt: BigInt(expiryBaseUnits),
    ...(typeof policyVersion === "bigint" ? { policyVersion } : {}),
  };
}
