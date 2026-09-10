import {
  type PaymentReceiptEnvelope,
  type PaymentReceiptEvidence,
  paymentReceiptEnvelopeSchema,
  paymentReceiptEvidenceSchema,
} from "@arcanum/shared";

import type { SignedPaymentIntentInput } from "./types";

/** A domain error returned by the Arcanum receipt API (`{ error: { code, message } }`). */
export class ReceiptRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(input: { code: string; message: string; status: number }) {
    super(input.message);
    this.name = "ReceiptRequestError";
    this.code = input.code;
    this.status = input.status;
  }
}

export type RequestedReceipt = Readonly<{
  receipt: PaymentReceiptEnvelope;
  /** True when this signed reference had already been attested and the stored receipt came back. */
  replayed: boolean;
}>;

export type AttachedReceiptEvidence = Readonly<{
  receiptId: string;
  evidence: readonly PaymentReceiptEvidence[];
}>;

export type ReceiptApiOptions = Readonly<{
  /** Origin of the Arcanum deployment, e.g. `https://thearcanum.in`. */
  apiUrl: string;
  fetch?: typeof fetch;
}>;

/** Thin REST client for `/api/receipts`. Shapes are validated, never trusted. */
export class ReceiptApi {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ReceiptApiOptions) {
    this.baseUrl = options.apiUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof this.fetchImpl !== "function") {
      throw new Error("A fetch implementation is required to talk to the Arcanum receipt API.");
    }
  }

  /**
   * The envelope is parsed strictly and `replayed` must be a boolean: the
   * caller decides whether to pay on that flag, so a response that leaves it
   * out is malformed, not "not replayed".
   */
  async requestReceipt(intent: SignedPaymentIntentInput): Promise<RequestedReceipt> {
    const { status, json } = await this.post("/api/receipts", intent);
    const body = asRecord(json, status);
    const envelope = paymentReceiptEnvelopeSchema.safeParse(body.receipt);
    if (!envelope.success) {
      throw new ReceiptRequestError({
        code: "MALFORMED_RESPONSE",
        message: `Arcanum receipt API returned a body that is not a receipt envelope (${issueSummary(envelope.error)}).`,
        status,
      });
    }
    if (typeof body.replayed !== "boolean") {
      throw new ReceiptRequestError({
        code: "MALFORMED_RESPONSE",
        message: "Arcanum receipt API returned a receipt without a boolean replayed flag.",
        status,
      });
    }
    return { receipt: envelope.data, replayed: body.replayed };
  }

  async attachEvidence(receiptId: string, txHash: `0x${string}`): Promise<AttachedReceiptEvidence> {
    const { status, json } = await this.post(
      `/api/receipts/${encodeURIComponent(receiptId)}/evidence`,
      { txHash },
    );
    const body = asRecord(json, status);
    if (typeof body.receiptId !== "string" || !Array.isArray(body.evidence)) {
      throw new ReceiptRequestError({
        code: "MALFORMED_RESPONSE",
        message: "Arcanum receipt API returned an evidence payload without receiptId/evidence.",
        status,
      });
    }
    const evidence = body.evidence.map((item) => paymentReceiptEvidenceSchema.safeParse(item));
    const broken = evidence.find((item) => !item.success);
    if (broken && !broken.success) {
      throw new ReceiptRequestError({
        code: "MALFORMED_RESPONSE",
        message: `Arcanum receipt API returned an evidence row that does not parse (${issueSummary(broken.error)}).`,
        status,
      });
    }
    return {
      receiptId: body.receiptId,
      evidence: evidence.flatMap((item) => (item.success ? [item.data] : [])),
    };
  }

  private async post(path: string, payload: unknown): Promise<{ status: number; json: unknown }> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      const error = apiError(json);
      throw new ReceiptRequestError({
        code: error?.code ?? "HTTP_ERROR",
        message: error?.message ?? `Arcanum receipt API responded ${response.status} for ${path}.`,
        status: response.status,
      });
    }
    return { status: response.status, json };
  }
}

function asRecord(value: unknown, status: number): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReceiptRequestError({
      code: "MALFORMED_RESPONSE",
      message: "Arcanum receipt API returned a non-object body.",
      status,
    });
  }
  return value as Record<string, unknown>;
}

function issueSummary(error: { issues: readonly { path: PropertyKey[]; message: string }[] }) {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
}

function apiError(json: unknown): { code: string; message: string } | null {
  if (typeof json !== "object" || json === null) {
    return null;
  }
  const error = (json as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) {
    return null;
  }
  const { code, message } = error as { code?: unknown; message?: unknown };
  return typeof code === "string" && typeof message === "string" ? { code, message } : null;
}
