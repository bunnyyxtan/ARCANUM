import {
  CCTP_FINALITY_STANDARD,
  CCTP_IRIS_URL,
  CCTP_QUOTE_TTL_MS,
  CCTP_ROUTE,
} from "../cctp/constants";

export interface CctpQuote {
  /** Total USDC burned on Sepolia, in six-decimal base units. */
  amountBaseUnits: string;
  /** The maximum forwarding fee, deducted from the total burn. */
  maxFeeBaseUnits: string;
  /** amountBaseUnits minus maxFeeBaseUnits. */
  minimumReceivedBaseUnits: string;
  /** Unix timestamp in milliseconds. Quotes deliberately have a short lifetime. */
  /** Unix timestamp in milliseconds, in the same units as Date.now(). */
  expiresAt: number;
}

export interface CctpQuoteOptions {
  fetchFn?: typeof fetch;
}

interface FeeResponse {
  finalityThreshold?: unknown;
  minimumFee?: unknown;
  forwardFee?: { high?: unknown };
}

const UINT256_MAX = (1n << 256n) - 1n;

/** Parse a human USDC amount exactly; values with more than six decimals are rejected, never rounded. */
export function parseUsdcAmount(amount: string): bigint {
  if (typeof amount !== "string" || !/^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/.test(amount)) {
    throw new Error("USDC amount must be a non-negative decimal with at most 6 decimal places.");
  }
  const [whole = "", fraction = ""] = amount.split(".");
  const result = BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
  if (result > UINT256_MAX) throw new Error("USDC amount exceeds uint256.");
  return result;
}

export function parseUint256(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value)) {
    throw new Error(`${label} must be a canonical unsigned decimal string.`);
  }
  const parsed = BigInt(value);
  if (parsed > UINT256_MAX) throw new Error(`${label} exceeds uint256.`);
  return parsed;
}

/**
 * Gets a fresh Standard-finality forwarding quote. Circle currently reports a
 * zero Standard protocol fee. A non-zero/otherwise changed protocol fee is
 * rejected rather than guessed, because this lightweight API cannot safely
 * derive a percentage fee from a changed response format.
 */
export async function getCctpQuote(
  amountUsdc: string,
  options: CctpQuoteOptions = {},
): Promise<CctpQuote> {
  const amount = parseUsdcAmount(amountUsdc);
  if (amount === 0n) throw new Error("USDC amount must be greater than zero.");
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== "function")
    throw new Error("No fetch implementation is available for the CCTP fee quote.");

  let response: Response;
  try {
    response = await fetchFn(
      `${CCTP_IRIS_URL}/v2/burn/USDC/fees/${CCTP_ROUTE.sourceDomain}/${CCTP_ROUTE.destinationDomain}?forward=true`,
      { method: "GET", headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    throw new Error(`CCTP fee endpoint is unavailable: ${message(error)}`);
  }
  if (!response.ok) throw new Error(`CCTP fee endpoint returned HTTP ${response.status}.`);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("CCTP fee endpoint returned invalid JSON.");
  }
  if (!Array.isArray(payload)) throw new Error("CCTP fee endpoint returned an invalid fee list.");
  const fee = payload.find(
    (item): item is FeeResponse =>
      isRecord(item) && item.finalityThreshold === CCTP_FINALITY_STANDARD,
  );
  if (!fee) throw new Error("CCTP Standard forwarding fees are unavailable for this route.");
  // minimumFee is basis points. This route intentionally supports only its documented zero value.
  if (!(fee.minimumFee === 0 || fee.minimumFee === "0")) {
    throw new Error("CCTP Standard protocol fee changed from zero; refusing to invent fee math.");
  }
  const forward = fee.forwardFee?.high;
  const maxFee = parseApiMinorUnits(forward, "CCTP forwardFee.high");
  if (maxFee >= amount)
    throw new Error("CCTP forwarding fee must be less than the total burn amount.");

  return {
    amountBaseUnits: amount.toString(),
    maxFeeBaseUnits: maxFee.toString(),
    minimumReceivedBaseUnits: (amount - maxFee).toString(),
    expiresAt: Date.now() + CCTP_QUOTE_TTL_MS,
  };
}

function parseApiMinorUnits(value: unknown, label: string): bigint {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new Error(`${label} must be a safe non-negative integer.`);
    return BigInt(value);
  }
  return parseUint256(value, label);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
