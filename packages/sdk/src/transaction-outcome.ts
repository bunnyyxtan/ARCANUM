import { GuardedWalletAbi } from "@arcanum/contracts";
import { type Address, type Hex, decodeEventLog, encodeEventTopics, zeroHash } from "viem";

import { EscalationRequiredError, TransactionRecoveryError, WalletFrozenError } from "./errors";
import type { ExecuteUSDCResult, SubmittedUSDCTransaction } from "./types";

const outcomeTopics = new Set(
  (["TransferExecuted", "TransferEscalated", "Frozen"] as const).map((eventName) =>
    encodeEventTopics({ abi: GuardedWalletAbi, eventName })[0]?.toLowerCase(),
  ),
);
const reasons = [
  "NONE",
  "ALLOWLIST_REQUIRED",
  "PER_TX_CAP",
  "DAILY_CAP",
  "ESCALATION_THRESHOLD",
  "BLOCKED_VENDOR",
  "CATEGORY_DISABLED",
  "MONTHLY_CAP",
  "PER_VENDOR_CAP",
] as const;

/** Only the configured wallet's own logs can establish its execution outcome. */
export function transactionOutcome(
  submission: SubmittedUSDCTransaction,
  logs: readonly { address: Address; data: Hex; topics: readonly Hex[] }[],
  signer: Address,
): ExecuteUSDCResult {
  const { walletAddress, input, txHash } = submission;
  const candidates = logs.filter(
    (log) =>
      log.address.toLowerCase() === walletAddress.toLowerCase() &&
      outcomeTopics.has(log.topics[0]?.toLowerCase() ?? ""),
  );
  const log = candidates[0];
  if (candidates.length !== 1 || !log) {
    throw new TransactionRecoveryError(
      txHash,
      candidates.length === 0 ? "OUTCOME_MISSING" : "OUTCOME_AMBIGUOUS",
      `Expected one wallet outcome event, found ${candidates.length}.`,
      { submission },
    );
  }

  try {
    const event = decodeEventLog({
      abi: GuardedWalletAbi,
      data: log.data,
      topics: [...log.topics] as [Hex, ...Hex[]],
      strict: true,
    });
    if (
      event.eventName !== "TransferExecuted" &&
      event.eventName !== "TransferEscalated" &&
      event.eventName !== "Frozen"
    ) {
      throw new Error("Unexpected outcome event.");
    }
    if (event.args.wallet.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error("Outcome event names another wallet.");
    }
    if (event.eventName === "Frozen") {
      // Frozen carries no payment terms. The caller must also verify the
      // transaction's executeUSDC calldata against the original input.
      const reason = reasons[Number(event.args.reason)];
      if (Number(event.args.source) !== 0 || reason === undefined || reason === "NONE") {
        throw new Error("Expected a policy freeze with a recognized reason.");
      }
      return { verdict: "FREEZE", reason, txHash, error: new WalletFrozenError(reason) };
    }
    if (
      event.args.to.toLowerCase() !== input.to.toLowerCase() ||
      event.args.amount !== input.amount
    ) {
      throw new Error("Outcome recipient or amount differs from the submitted payment.");
    }
    if (event.eventName === "TransferExecuted") {
      if (
        event.args.signer.toLowerCase() !== signer.toLowerCase() ||
        event.args.escalationId !== zeroHash
      ) {
        throw new Error("Outcome does not describe a direct executeUSDC payment.");
      }
      return { verdict: "ALLOW", reason: "NONE", txHash };
    }
    if (event.args.escalationId === zeroHash) {
      throw new Error("Escalation outcome has no escalation id.");
    }
    // The event's `reason` is caller-supplied bytes, not a policy reason code.
    const reason = "ESCALATION_REQUIRED";
    return {
      verdict: "ESCALATE",
      reason,
      txHash,
      escalationId: event.args.escalationId,
      error: new EscalationRequiredError(reason, event.args.escalationId),
    };
  } catch (cause) {
    throw new TransactionRecoveryError(
      txHash,
      "OUTCOME_INCONSISTENT",
      "Wallet outcome event is malformed or inconsistent with the payment.",
      { cause, submission },
    );
  }
}
