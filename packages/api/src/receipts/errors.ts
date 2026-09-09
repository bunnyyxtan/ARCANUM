import { TRPCError } from "@trpc/server";

/**
 * Everything that can stop a receipt from being issued or linked is a named,
 * explicit failure. There is no fallback verdict: a receipt either attests a
 * real policy decision or it does not exist.
 */
export const RECEIPT_ERROR_CODES = {
  SIGNATURE_INVALID: { trpc: "BAD_REQUEST", http: 400 },
  UNSUPPORTED_CHAIN: { trpc: "BAD_REQUEST", http: 400 },
  UNSUPPORTED_TOKEN: { trpc: "BAD_REQUEST", http: 400 },
  UNSUPPORTED_WALLET_TOKEN: { trpc: "BAD_REQUEST", http: 400 },
  INVALID_AMOUNT: { trpc: "BAD_REQUEST", http: 400 },
  INVALID_RECIPIENT: { trpc: "BAD_REQUEST", http: 400 },
  INVALID_RECEIPT: { trpc: "BAD_REQUEST", http: 400 },
  INVALID_TRANSACTION_HASH: { trpc: "BAD_REQUEST", http: 400 },
  AGENT_NOT_AUTHORIZED: { trpc: "FORBIDDEN", http: 403 },
  WALLET_NOT_REGISTERED: { trpc: "NOT_FOUND", http: 404 },
  RECEIPT_NOT_FOUND: { trpc: "NOT_FOUND", http: 404 },
  TRANSACTION_NOT_FOUND: { trpc: "NOT_FOUND", http: 404 },
  REQUEST_KEY_CONFLICT: { trpc: "CONFLICT", http: 409 },
  EVIDENCE_MISMATCH: { trpc: "PRECONDITION_FAILED", http: 412 },
  RECEIPT_ISSUER_NOT_CONFIGURED: { trpc: "SERVICE_UNAVAILABLE", http: 503 },
  RECEIPT_ISSUER_NOT_REGISTERED: { trpc: "SERVICE_UNAVAILABLE", http: 503 },
  RECEIPT_STORE_UNAVAILABLE: { trpc: "SERVICE_UNAVAILABLE", http: 503 },
  CHAIN_READ_FAILED: { trpc: "BAD_GATEWAY", http: 502 },
} as const satisfies Record<string, { trpc: TRPCError["code"]; http: number }>;

export type ReceiptErrorCode = keyof typeof RECEIPT_ERROR_CODES;

export class ReceiptError extends Error {
  readonly code: ReceiptErrorCode;
  readonly httpStatus: number;
  readonly trpcCode: TRPCError["code"];

  constructor(code: ReceiptErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ReceiptError";
    this.code = code;
    this.httpStatus = RECEIPT_ERROR_CODES[code].http;
    this.trpcCode = RECEIPT_ERROR_CODES[code].trpc;
  }

  /** The domain code travels to clients through the router's error formatter. */
  toTRPCError(): TRPCError {
    return new TRPCError({ code: this.trpcCode, message: this.message, cause: this });
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}

export function isReceiptError(error: unknown): error is ReceiptError {
  return error instanceof ReceiptError;
}

/** Run a service call inside a tRPC procedure, translating domain errors. */
export async function withReceiptErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw isReceiptError(error) ? error.toTRPCError() : error;
  }
}
