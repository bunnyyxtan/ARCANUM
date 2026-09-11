import { constants as cryptoConstants, publicEncrypt } from "node:crypto";

/**
 * Minimal client for the Circle developer-controlled wallets REST API.
 *
 * Only what the Arcanum signer adapter and its setup script need: bearer
 * auth, a fresh entity secret ciphertext on every write, and error
 * shaping that never carries the API key, the entity secret or the request
 * body. Circle's own SDK is not used so the SDK keeps viem as its only
 * runtime dependency.
 */

export const CIRCLE_API_URL = "https://api.circle.com";

export type CircleSignerErrorCode =
  | "INVALID_CONFIG"
  | "CIRCLE_API_ERROR"
  | "MALFORMED_RESPONSE"
  | "SIGNATURE_MISMATCH"
  | "TRANSACTION_MISMATCH"
  | "UNSUPPORTED_TRANSACTION";

export class CircleSignerError extends Error {
  readonly code: CircleSignerErrorCode;
  /** HTTP status of the failing Circle call, when there was one. */
  readonly status?: number;
  /** Circle's own numeric error code, when the response carried one. */
  readonly circleCode?: number;

  constructor(input: {
    code: CircleSignerErrorCode;
    message: string;
    status?: number;
    circleCode?: number;
  }) {
    super(input.message);
    this.name = "CircleSignerError";
    this.code = input.code;
    this.status = input.status;
    this.circleCode = input.circleCode;
  }
}

export interface CircleWalletsApiConfig {
  /** Circle API key (testnet or mainnet). Sent as a bearer token, never stored elsewhere. */
  apiKey: string;
  /** The registered entity secret: 32 bytes as 64 hex characters, with or without 0x. */
  entitySecret: string;
  /** Defaults to https://api.circle.com. */
  apiUrl?: string;
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
}

const ENTITY_SECRET_PATTERN = /^(0x)?[0-9a-fA-F]{64}$/;

/**
 * Circle expects the raw 32 secret bytes encrypted with its entity public
 * key using RSA-OAEP with SHA-256 for both the hash and MGF1, base64 encoded.
 * Node's publicEncrypt derives the MGF1 hash from oaepHash, so no label or
 * extra option is needed.
 */
export function encryptEntitySecret(publicKeyPem: string, entitySecret: string): string {
  const secretHex = normalizeEntitySecret(entitySecret);
  const secretBytes = Buffer.from(secretHex, "hex");
  if (secretBytes.length !== 32) {
    throw new CircleSignerError({
      code: "INVALID_CONFIG",
      message: "The Circle entity secret must be exactly 32 bytes.",
    });
  }
  return publicEncrypt(
    {
      key: publicKeyPem,
      padding: cryptoConstants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    secretBytes,
  ).toString("base64");
}

function normalizeEntitySecret(entitySecret: string): string {
  const trimmed = entitySecret.trim();
  if (!ENTITY_SECRET_PATTERN.test(trimmed)) {
    throw new CircleSignerError({
      code: "INVALID_CONFIG",
      message: "The Circle entity secret must be 64 hex characters (32 bytes).",
    });
  }
  return trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
}

interface CircleErrorBody {
  code?: unknown;
  message?: unknown;
}

export class CircleWalletsApi {
  private readonly apiKey: string;
  private readonly entitySecret: string;
  private readonly apiUrl: string;
  private readonly fetchImpl: typeof fetch;
  private publicKey: Promise<string> | null = null;

  constructor(config: CircleWalletsApiConfig) {
    if (!config.apiKey.trim()) {
      throw new CircleSignerError({
        code: "INVALID_CONFIG",
        message: "A Circle API key is required.",
      });
    }
    this.apiKey = config.apiKey.trim();
    // Validated up front so a malformed secret fails before any network call.
    this.entitySecret = normalizeEntitySecret(config.entitySecret);
    this.apiUrl = (config.apiUrl ?? CIRCLE_API_URL).replace(/\/+$/, "");
    this.fetchImpl = config.fetch ?? globalThis.fetch;
  }

  /** GET without an entity secret; used for reads such as the entity public key or a wallet. */
  async get<T>(path: string): Promise<T> {
    const response = await this.send(path, { method: "GET" });
    return this.readData<T>(response);
  }

  /**
   * POST with a freshly encrypted entity secret. Circle rejects a reused
   * ciphertext, so a body is never retried; callers that want a retry make
   * a new call, which encrypts again.
   */
  async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const entitySecretCiphertext = encryptEntitySecret(
      await this.getPublicKey(),
      this.entitySecret,
    );
    const response = await this.send(path, {
      method: "POST",
      body: JSON.stringify({ ...body, entitySecretCiphertext }),
    });
    return this.readData<T>(response);
  }

  /** The entity public key is stable per Circle account; only a successful fetch is cached. */
  getPublicKey(): Promise<string> {
    if (!this.publicKey) {
      this.publicKey = this.get<{ publicKey?: unknown }>("/v1/w3s/config/entity/publicKey")
        .then((data) => {
          if (typeof data.publicKey !== "string" || !data.publicKey.includes("PUBLIC KEY")) {
            throw new CircleSignerError({
              code: "MALFORMED_RESPONSE",
              message: "Circle did not return a PEM entity public key.",
            });
          }
          return data.publicKey;
        })
        .catch((error: unknown) => {
          this.publicKey = null;
          throw error;
        });
    }
    return this.publicKey;
  }

  private async send(path: string, init: { method: "GET" | "POST"; body?: string }) {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.apiUrl}${path}`, {
        method: init.method,
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.apiKey}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        body: init.body,
      });
    } catch (error) {
      // The cause is dropped on purpose: undici errors can echo request headers.
      throw new CircleSignerError({
        code: "CIRCLE_API_ERROR",
        message: `Circle API request to ${path} failed: ${this.redact(error instanceof Error ? error.message : "network error")}`,
      });
    }
    return { path, response };
  }

  /**
   * Remote and transport text is kept in errors because it is what an operator
   * needs, but never with the credentials in it, and never unbounded.
   */
  private redact(text: string): string {
    const clean = text
      .split(this.apiKey)
      .join("[api key]")
      .split(this.entitySecret)
      .join("[entity secret]");
    return clean.length > 240 ? `${clean.slice(0, 240)}…` : clean;
  }

  private async readData<T>({ path, response }: { path: string; response: Response }): Promise<T> {
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      json = undefined;
    }
    if (!response.ok) {
      const body = (json ?? {}) as CircleErrorBody;
      const circleCode = typeof body.code === "number" ? body.code : undefined;
      const detail = this.redact(
        typeof body.message === "string" ? body.message : response.statusText,
      );
      throw new CircleSignerError({
        code: "CIRCLE_API_ERROR",
        message: `Circle API ${path} answered ${response.status}${circleCode !== undefined ? ` (code ${circleCode})` : ""}: ${detail}`,
        status: response.status,
        circleCode,
      });
    }
    if (typeof json !== "object" || json === null || !("data" in json)) {
      throw new CircleSignerError({
        code: "MALFORMED_RESPONSE",
        message: `Circle API ${path} returned no data object.`,
        status: response.status,
      });
    }
    return (json as { data: T }).data;
  }
}
