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

  async requestReceipt(intent: SignedPaymentIntentInput): Promise<RequestedReceipt> {
    const body = asRecord(await this.post("/api/receipts", intent));
    return {
      receipt: paymentReceiptEnvelopeSchema.parse(body.receipt),
      replayed: body.replayed === true,
    };
  }

  async attachEvidence(receiptId: string, txHash: `0x${string}`): Promise<AttachedReceiptEvidence> {
    const body = asRecord(
      await this.post(`/api/receipts/${encodeURIComponent(receiptId)}/evidence`, { txHash }),
    );
    if (typeof body.receiptId !== "string" || !Array.isArray(body.evidence)) {
      throw new ReceiptRequestError({
        code: "MALFORMED_RESPONSE",
        message: "Arcanum receipt API returned an evidence payload without receiptId/evidence.",
        status: 200,
      });
    }
    return {
      receiptId: body.receiptId,
      evidence: body.evidence.map((item) => paymentReceiptEvidenceSchema.parse(item)),
    };
  }

  private async post(path: string, payload: unknown): Promise<unknown> {
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
    return json;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReceiptRequestError({
      code: "MALFORMED_RESPONSE",
      message: "Arcanum receipt API returned a non-object body.",
      status: 200,
    });
  }
  return value as Record<string, unknown>;
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
