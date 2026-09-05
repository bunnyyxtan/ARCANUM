/**
 * One place that turns a chain or wallet error into text an operator can act on.
 *
 * Node error strings are not a stable API contract and Arc has already moved
 * them once: arc-node v0.8.0 (reth 2.2 / revm 38) replaced
 * `insufficient funds for gas * price + value` with revm's `OutOfFunds` text on
 * `eth_call` / `eth_estimateGas`, and a plain transfer with an empty balance
 * now surfaces `gas required exceeds allowance` instead of
 * `Missing or invalid parameters`. Matching every known variant here keeps raw
 * node wording out of the UI and means the next rename is a one-line change.
 */

const DEFAULT_MESSAGE = "Transaction failed. Please retry.";

/** Insufficient balance, across pre- and post-v0.8.0 node wording. */
const NO_FUNDS_PATTERNS = [
  /out\s*of\s*funds/i,
  /insufficient funds/i,
  /gas required exceeds allowance/i,
];

const REJECTED_PATTERN = /user rejected|user denied|request rejected/i;

function rawMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    const short = (error as { shortMessage?: unknown }).shortMessage;
    if (typeof short === "string" && short.length > 0) {
      return short;
    }
  }

  return error instanceof Error ? error.message : "";
}

/**
 * Raw text for an error that did not come from the chain, such as a failed
 * read-model sync. These must not be rewritten as wallet failures: a server
 * message that happens to contain "out of funds" is a different problem.
 */
export function errorText(error: unknown, fallback = DEFAULT_MESSAGE) {
  const raw = rawMessage(error);
  return raw.length > 0 ? raw : fallback;
}

/**
 * Returns the message to show for a failed chain read or write. Unknown errors
 * keep their original text, so nothing is swallowed - only the known node
 * wording is replaced with something a person can act on.
 */
export function describeChainError(error: unknown, fallback = DEFAULT_MESSAGE) {
  const raw = rawMessage(error);

  if (raw.length === 0) {
    return fallback;
  }

  if (REJECTED_PATTERN.test(raw)) {
    return "Request rejected in your wallet.";
  }

  if (NO_FUNDS_PATTERNS.some((pattern) => pattern.test(raw))) {
    return "Not enough USDC in this wallet to cover the transaction and its gas.";
  }

  return raw;
}
