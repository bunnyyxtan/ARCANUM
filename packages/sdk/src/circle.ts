import {
  type Address,
  type Hex,
  type LocalAccount,
  type SignableMessage,
  type TransactionSerializable,
  type TransactionSerialized,
  type TypedData,
  type TypedDataDefinition,
  bytesToHex,
  getAddress,
  getTypesForEIP712Domain,
  isAddress,
  isAddressEqual,
  isHex,
  parseTransaction,
  recoverMessageAddress,
  recoverTransactionAddress,
  recoverTypedDataAddress,
  serializeTypedData,
} from "viem";
import { toAccount } from "viem/accounts";

import { CircleSignerError, CircleWalletsApi } from "./circle-api";

export {
  CIRCLE_API_URL,
  CircleSignerError,
  type CircleSignerErrorCode,
  type CircleWalletsApiConfig,
} from "./circle-api";

/**
 * Circle developer-controlled wallet as the agent signer.
 *
 * The wallet's key lives in Circle's MPC service; this adapter turns it into
 * a viem local account so ArcanumClient can use it exactly like a private
 * key: EIP-191 messages for payment intents, and transactions for
 * GuardedWallet.executeUSDC. viem still prepares nonce, gas and fees over
 * the configured Arc RPC and broadcasts the signed transaction itself, so
 * nothing about policy, escalation or evidence changes — only where the
 * signature comes from.
 *
 * Every answer from Circle is checked before it is used: a signature must
 * recover to the wallet address, and a signed transaction must also parse
 * back to exactly the fields that were requested. Anything else throws a
 * CircleSignerError and nothing is broadcast.
 *
 * Node-only: the entity secret ciphertext needs node:crypto.
 */
export interface CircleWalletAccountConfig {
  /** Circle API key. */
  apiKey: string;
  /** The entity secret registered in Circle Console (64 hex characters). */
  entitySecret: string;
  /**
   * Id of the developer-controlled wallet: an EOA created on Circle's generic
   * EVM-TESTNET or EVM identifier, the only ones its sign/transaction endpoint serves.
   */
  walletId: string;
  /** The wallet's address, as returned when it was created. */
  address: Address;
  /** Defaults to https://api.circle.com. */
  apiUrl?: string;
  /** Injectable for tests. Defaults to the global fetch. */
  fetch?: typeof fetch;
  /** Free text Circle shows next to each signing request in its console. */
  memo?: string;
}

interface SignatureResponse {
  signature?: unknown;
}

interface SignedTransactionResponse {
  signature?: unknown;
  signedTransaction?: unknown;
  txHash?: unknown;
}

/** The only transaction shape this signer accepts: an EIP-1559 call with a recipient. */
interface Eip1559Request {
  chainId: number;
  nonce: number;
  to: Address;
  value: bigint;
  data: Hex;
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

const SIGNATURE_HEX_LENGTH = 2 + 65 * 2;

export function circleWalletAccount(config: CircleWalletAccountConfig): LocalAccount {
  if (!isAddress(config.address, { strict: false })) {
    throw new CircleSignerError({
      code: "INVALID_CONFIG",
      message: "The Circle wallet address is not a valid address.",
    });
  }
  if (!config.walletId.trim()) {
    throw new CircleSignerError({
      code: "INVALID_CONFIG",
      message: "A Circle wallet id is required.",
    });
  }
  const address = getAddress(config.address);
  const walletId = config.walletId.trim();
  const memo = config.memo ?? "Arcanum agent signer";
  const api = new CircleWalletsApi({
    apiKey: config.apiKey,
    entitySecret: config.entitySecret,
    apiUrl: config.apiUrl,
    fetch: config.fetch,
  });

  async function signMessage({ message }: { message: SignableMessage }): Promise<Hex> {
    const encoded = encodeMessage(message);
    const data = await api.post<SignatureResponse>("/v1/w3s/developer/sign/message", {
      walletId,
      message: encoded.message,
      encodedByHex: encoded.encodedByHex,
      memo,
    });
    const signature = readSignature(data.signature);
    const recovered = await recoverMessageAddress({ message, signature });
    if (!isAddressEqual(recovered, address)) {
      throw new CircleSignerError({
        code: "SIGNATURE_MISMATCH",
        message: `Circle returned a message signature from ${recovered}, not from the wallet ${address}.`,
      });
    }
    return signature;
  }

  async function signTransaction(transaction: TransactionSerializable): Promise<Hex> {
    const request = projectRequest(transaction);
    const data = await api.post<SignedTransactionResponse>("/v1/w3s/developer/sign/transaction", {
      walletId,
      transaction: JSON.stringify(circleTransaction(request)),
      memo,
    });
    const signed = data.signedTransaction;
    if (typeof signed !== "string" || !isHex(signed)) {
      throw new CircleSignerError({
        code: "MALFORMED_RESPONSE",
        message: "Circle did not return a hex signedTransaction.",
      });
    }
    assertSignedMatches(signed, request);
    const recovered = await recoverTransactionAddress({
      serializedTransaction: signed as TransactionSerialized,
    });
    if (!isAddressEqual(recovered, address)) {
      throw new CircleSignerError({
        code: "SIGNATURE_MISMATCH",
        message: `Circle returned a transaction signed by ${recovered}, not by the wallet ${address}.`,
      });
    }
    return signed;
  }

  async function signTypedData<
    const typedData extends TypedData | Record<string, unknown>,
    primaryType extends keyof typedData | "EIP712Domain" = keyof typedData,
  >(parameters: TypedDataDefinition<typedData, primaryType>): Promise<Hex> {
    const typed = parameters as unknown as TypedDataDefinition;
    const serialized = serializeTypedData({
      domain: typed.domain,
      primaryType: typed.primaryType,
      message: typed.message,
      // Circle wants EIP712Domain spelled out; viem derives it from the domain.
      types: { EIP712Domain: getTypesForEIP712Domain({ domain: typed.domain }), ...typed.types },
    } as unknown as TypedDataDefinition);
    const data = await api.post<SignatureResponse>("/v1/w3s/developer/sign/typedData", {
      walletId,
      data: serialized,
      memo,
    });
    const signature = readSignature(data.signature);
    const recovered = await recoverTypedDataAddress({ ...typed, signature });
    if (!isAddressEqual(recovered, address)) {
      throw new CircleSignerError({
        code: "SIGNATURE_MISMATCH",
        message: `Circle returned a typed data signature from ${recovered}, not from the wallet ${address}.`,
      });
    }
    return signature;
  }

  return toAccount({ address, signMessage, signTransaction, signTypedData });
}

function encodeMessage(message: SignableMessage): { message: string; encodedByHex: boolean } {
  if (typeof message === "string") {
    return { message, encodedByHex: false };
  }
  const raw = typeof message.raw === "string" ? message.raw : bytesToHex(message.raw);
  return { message: raw, encodedByHex: true };
}

function readSignature(value: unknown): Hex {
  if (typeof value !== "string" || !isHex(value) || value.length !== SIGNATURE_HEX_LENGTH) {
    throw new CircleSignerError({
      code: "MALFORMED_RESPONSE",
      message: "Circle did not return a 65-byte hex signature.",
    });
  }
  return value;
}

/**
 * Keep only the consensus fields of an EIP-1559 call and refuse anything
 * this signer cannot express to Circle, instead of dropping it silently.
 */
function projectRequest(transaction: TransactionSerializable): Eip1559Request {
  const {
    type,
    chainId,
    nonce,
    to,
    value,
    data,
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
    gasPrice,
    accessList,
    authorizationList,
  } = transaction as TransactionSerializable & {
    gasPrice?: bigint;
    accessList?: readonly unknown[];
    authorizationList?: readonly unknown[];
  };
  const blobFields = transaction as {
    blobs?: unknown;
    sidecars?: unknown;
    maxFeePerBlobGas?: unknown;
  };

  if (
    (type !== undefined && type !== "eip1559") ||
    gasPrice !== undefined ||
    (accessList?.length ?? 0) > 0 ||
    (authorizationList?.length ?? 0) > 0 ||
    blobFields.blobs !== undefined ||
    blobFields.sidecars !== undefined ||
    blobFields.maxFeePerBlobGas !== undefined
  ) {
    throw new CircleSignerError({
      code: "UNSUPPORTED_TRANSACTION",
      message:
        "The Circle signer only signs plain EIP-1559 transactions (no legacy gas price, access list, authorization list or blobs).",
    });
  }
  if (
    typeof chainId !== "number" ||
    typeof nonce !== "number" ||
    typeof gas !== "bigint" ||
    typeof maxFeePerGas !== "bigint" ||
    typeof maxPriorityFeePerGas !== "bigint"
  ) {
    throw new CircleSignerError({
      code: "UNSUPPORTED_TRANSACTION",
      message:
        "The transaction must be prepared (chainId, nonce, gas, maxFeePerGas and maxPriorityFeePerGas) before the Circle signer sees it.",
    });
  }
  if (!to || !isAddress(to, { strict: false })) {
    throw new CircleSignerError({
      code: "UNSUPPORTED_TRANSACTION",
      message: "The Circle signer does not sign contract creation; a recipient is required.",
    });
  }

  return {
    chainId,
    nonce,
    to: getAddress(to),
    value: value ?? 0n,
    data: data ?? "0x",
    gas,
    maxFeePerGas,
    maxPriorityFeePerGas,
  };
}

/**
 * Circle's EVM transaction object, in the shape of Circle's own example:
 * nonce and chainId as JSON numbers, amounts and gas as decimal strings.
 */
function circleTransaction(request: Eip1559Request): Record<string, string | number> {
  return {
    chainId: request.chainId,
    nonce: request.nonce,
    to: request.to,
    value: request.value.toString(),
    gas: request.gas.toString(),
    maxFeePerGas: request.maxFeePerGas.toString(),
    maxPriorityFeePerGas: request.maxPriorityFeePerGas.toString(),
    ...(request.data !== "0x" ? { data: request.data } : {}),
  };
}

/**
 * The signed bytes are what gets broadcast, so they, not Circle's word, are
 * compared with the request field by field. parseTransaction omits a zero
 * value, empty data and an empty access list; those defaults are applied
 * before comparing.
 */
function assertSignedMatches(signed: Hex, request: Eip1559Request): void {
  let parsed: ReturnType<typeof parseTransaction>;
  try {
    parsed = parseTransaction(signed);
  } catch (error) {
    throw new CircleSignerError({
      code: "MALFORMED_RESPONSE",
      message: `Circle's signedTransaction does not parse: ${error instanceof Error ? error.message : "unknown error"}`,
    });
  }
  if (parsed.type !== "eip1559") {
    throw mismatch(`type ${parsed.type}`);
  }
  if (parsed.chainId !== request.chainId) {
    throw mismatch(`chainId ${parsed.chainId}`);
  }
  if (parsed.nonce !== request.nonce) {
    throw mismatch(`nonce ${parsed.nonce}`);
  }
  if (!parsed.to || !isAddressEqual(parsed.to, request.to)) {
    throw mismatch(`recipient ${parsed.to ?? "none"}`);
  }
  if ((parsed.value ?? 0n) !== request.value) {
    throw mismatch(`value ${parsed.value ?? 0n}`);
  }
  if ((parsed.data ?? "0x").toLowerCase() !== request.data.toLowerCase()) {
    throw mismatch("calldata");
  }
  if (parsed.gas !== request.gas) {
    throw mismatch(`gas ${parsed.gas}`);
  }
  if (parsed.maxFeePerGas !== request.maxFeePerGas) {
    throw mismatch(`maxFeePerGas ${parsed.maxFeePerGas}`);
  }
  if (parsed.maxPriorityFeePerGas !== request.maxPriorityFeePerGas) {
    throw mismatch(`maxPriorityFeePerGas ${parsed.maxPriorityFeePerGas}`);
  }
  if ((parsed.accessList?.length ?? 0) > 0) {
    throw mismatch("an access list");
  }
}

function mismatch(detail: string): CircleSignerError {
  return new CircleSignerError({
    code: "TRANSACTION_MISMATCH",
    message: `Circle signed a different transaction (${detail}) than the one requested; nothing was sent.`,
  });
}
