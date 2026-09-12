import type { PaymentReceiptEvidence, PaymentReceiptVerdict } from "@arcanum/shared";

export type VerdictTone = "approved" | "rejected" | "escalated" | "frozen";

// Receipt envelopes are small; this cap prevents local parsing and file reads
// from consuming unbounded browser memory.
export const RECEIPT_INPUT_MAX_BYTES = 1024 * 1024;

export function receiptInputSizeError(size: number): string | null {
  return size > RECEIPT_INPUT_MAX_BYTES ? "Receipt JSON must be 1 MiB or smaller." : null;
}

/**
 * The limit is in bytes, so pasted text is measured in UTF-8 rather than by
 * UTF-16 code units, which under-count any non-ASCII content.
 */
export function receiptTextSizeError(text: string): string | null {
  return receiptInputSizeError(new TextEncoder().encode(text).byteLength);
}

const VERDICT_TONES: Record<PaymentReceiptVerdict, VerdictTone> = {
  allow: "approved",
  escalate: "escalated",
  deny: "rejected",
  freeze: "frozen",
};

export function verdictTone(verdict: PaymentReceiptVerdict): VerdictTone {
  return VERDICT_TONES[verdict];
}

/** VendorRegistry category indices, in bit order of `Policy.allowedCategories`. */
const VENDOR_CATEGORY_NAMES = ["API", "COMPUTE", "DATA", "SUBCONTRACTING", "OTHER"] as const;

export function vendorCategoryName(category: number): string {
  return VENDOR_CATEGORY_NAMES[category] ?? `CATEGORY ${category}`;
}

export function allowedCategoryNames(mask: string): string {
  const bits = BigInt(mask);
  const names = VENDOR_CATEGORY_NAMES.filter((_, index) => (bits >> BigInt(index)) & 1n);
  return names.length > 0 ? names.join(", ") : "NONE";
}

/** What the chain did relative to the verdict, as recorded by the evidence service. */
export function chainAgreement(evidence: PaymentReceiptEvidence): boolean | null {
  const value = evidence.details.verdictMatches;
  return typeof value === "boolean" ? value : null;
}

function formatDateUtc(date: Date): string {
  if (Number.isNaN(date.getTime())) return "INVALID TIMESTAMP";
  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

/** Receipt timestamps render in UTC so server and client output agree. */
export function formatUtc(iso: string): string {
  return formatDateUtc(new Date(iso));
}

/** Unix seconds from a receipt; values outside the Date range render as invalid. */
export function formatUnixUtc(seconds: number): string {
  return formatDateUtc(new Date(seconds * 1000));
}
