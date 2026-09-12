import {
  http,
  type Address,
  type Hash,
  type Hex,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
  createPublicClient,
  decodeEventLog,
  decodeFunctionData,
  getAddress,
  isAddressEqual,
  isHash,
} from "viem";

import {
  CCTP_FORWARD_HOOK_V1,
  CCTP_IRIS_URL,
  CCTP_ROUTE,
  CCTP_ZERO_BYTES32,
} from "../cctp/constants";
import { cctpTokenMessengerAbi, checkedRecipient } from "./transactions";

export interface CctpStatus {
  stage: "source_pending" | "attestation_pending" | "forwarding" | "completed" | "source_failed";
  burnTxHash: Hash;
  mintTxHash?: Hash;
  /**
   * Circle Forwarding Service state from Iris, when provided. This is
   * informational only: even COMPLETE still requires destination receipt and
   * native-USDC mint verification before this status can be completed.
   */
  forwardState?: string;
  /** Verified source transaction nonce; absent until the burn receipt is known. */
  sourceNonce?: number;
  /** Verified Sepolia receipt block number, serialized without precision loss. */
  sourceBlockNumber?: string;
  sender?: Address;
  /** Immutable Arc mint recipient verified from the source burn. */
  recipient?: Address;
  amountBaseUnits?: string;
  /** Maximum fee committed by the source burn, not the actual charged fee. */
  maxFeeBaseUnits?: string;
  /** Actual minted USDC amount, present only after verified completion. */
  receivedBaseUnits?: string;
  /** Actual charged fee, present only after verified completion. */
  feeBaseUnits?: string;
  detail?: string;
  /** Present when a client exposing readContract is injected and the final balance is readable. */
  balanceBaseUnits?: string;
}

export interface GetCctpStatusInput {
  burnTxHash: Hash;
  recipient: Address;
  /**
   * Optional destination transaction candidate for a user-initiated manual
   * relay. It is verified exactly like Circle's forwarded transaction and
   * never substitutes for an Iris attestation.
   */
  mintTxHash?: Hash;
}

/**
 * Deliberately small structural interface so browser callers can inject a viem
 * public client without coupling this API to a specific viem client generic.
 */
export interface CctpPublicClient {
  getChainId: () => Promise<number>;
  getTransaction: (parameters: { hash: Hash }) => Promise<unknown>;
  getTransactionReceipt: (parameters: { hash: Hash }) => Promise<unknown>;
  readContract?: (parameters: unknown) => Promise<unknown>;
}

export interface CctpStatusOptions {
  fetchFn?: typeof fetch;
  sourceClient?: CctpPublicClient;
  destinationClient?: CctpPublicClient;
}

const messageTransmitterAbi = [
  {
    type: "event",
    name: "MessageSent",
    inputs: [{ indexed: false, name: "message", type: "bytes" }],
    anonymous: false,
  },
  {
    type: "event",
    name: "MessageReceived",
    inputs: [
      { indexed: true, name: "caller", type: "address" },
      { indexed: false, name: "sourceDomain", type: "uint32" },
      { indexed: true, name: "nonce", type: "bytes32" },
      { indexed: false, name: "sender", type: "bytes32" },
      { indexed: true, name: "finalityThresholdExecuted", type: "uint32" },
      { indexed: false, name: "messageBody", type: "bytes" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

interface ValidBurn {
  sender: Address;
  recipient: Address;
  nonce: Hex;
  amount: bigint;
  maxFee: bigint;
  feeExecuted: bigint;
  message: Hex;
}

interface IrisMessage {
  message: Hex;
  status: string;
  nonce: Hex;
  feeExecuted: bigint;
  expirationBlock: bigint;
  forwardState?: string;
  forwardTxHash?: Hash;
  decodedMessage: Record<string, unknown>;
}

interface VerifiedSourceIdentity {
  sourceNonce: number;
  sourceBlockNumber: string;
}

/**
 * Inspects both chains. Circle's Iris response is an attestation/forwarding
 * service trust boundary: it identifies the proposed destination transaction,
 * but a transfer is only `completed` after the Arc receipt, receiveMessage
 * call, MessageReceived event, and native-USDC mint Transfer all agree.
 */
export async function getCctpStatus(
  input: GetCctpStatusInput,
  options: CctpStatusOptions = {},
): Promise<CctpStatus> {
  if (!isHash(input.burnTxHash)) throw new Error("CCTP burn transaction hash is invalid.");
  if (input.mintTxHash !== undefined && !isHash(input.mintTxHash))
    throw new Error("CCTP mint transaction hash is invalid.");
  const recipient = checkedRecipient(input.recipient);
  const source = options.sourceClient ?? defaultClient(CCTP_ROUTE.sourceRpcUrl);
  const destination = options.destinationClient ?? defaultClient(CCTP_ROUTE.destinationRpcUrl);
  await assertChain(source, CCTP_ROUTE.sourceChainId, "source");

  let transaction: unknown;
  try {
    transaction = await source.getTransaction({ hash: input.burnTxHash });
  } catch (error) {
    if (isMissingTransactionError(error)) {
      return { stage: "source_pending", burnTxHash: input.burnTxHash };
    }
    throw error;
  }
  if (transaction === null) return { stage: "source_pending", burnTxHash: input.burnTxHash };
  let receipt: unknown;
  try {
    receipt = await source.getTransactionReceipt({ hash: input.burnTxHash });
  } catch (error) {
    if (isMissingTransactionError(error)) {
      return { stage: "source_pending", burnTxHash: input.burnTxHash };
    }
    throw error;
  }
  if (receipt === null) return { stage: "source_pending", burnTxHash: input.burnTxHash };
  const sourceIdentity = verifySourceIdentity(transaction, receipt, input.burnTxHash);

  if (statusOf(receipt) === "reverted") {
    const partial = validateBurnCall(transaction, recipient);
    return {
      stage: "source_failed",
      burnTxHash: input.burnTxHash,
      ...verifiedBurnFields(partial, recipient, sourceIdentity),
      detail: "The validated CCTP burn transaction reverted on Sepolia.",
    };
  }
  if (statusOf(receipt) !== "success")
    throw new Error("Source receipt has an unrecognized status.");
  const partial = validateBurnTransaction(transaction, receipt, recipient);

  const fetchFn = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== "function")
    throw new Error("No fetch implementation is available for CCTP status.");
  let irisResponse: Response;
  try {
    irisResponse = await fetchFn(
      `${CCTP_IRIS_URL}/v2/messages/${CCTP_ROUTE.sourceDomain}?transactionHash=${input.burnTxHash}`,
      { method: "GET" },
    );
  } catch (error) {
    throw new Error(`CCTP Iris API is unavailable: ${message(error)}`);
  }
  if (irisResponse.status === 404) {
    return pendingAttestation(
      input.burnTxHash,
      partial,
      sourceIdentity,
      "Circle has not indexed the validated burn yet.",
    );
  }
  if (!irisResponse.ok) throw new Error(`CCTP Iris API returned HTTP ${irisResponse.status}.`);

  let payload: unknown;
  try {
    payload = await irisResponse.json();
  } catch {
    throw new Error("CCTP Iris API returned invalid JSON.");
  }
  if (isPendingConfirmationsEnvelope(payload, input.burnTxHash)) {
    return pendingAttestation(
      input.burnTxHash,
      partial,
      sourceIdentity,
      "Circle is waiting for source-chain finality confirmations.",
    );
  }
  const iris = selectIrisMessage(payload, input.burnTxHash, partial);
  validateIrisIdentity(iris, partial, recipient);
  const attestedBurn = {
    ...partial,
    nonce: iris.nonce,
    feeExecuted: iris.feeExecuted,
    expirationBlock: iris.expirationBlock,
  };
  if (iris.status.toLowerCase() !== "complete") {
    return pendingAttestation(
      input.burnTxHash,
      partial,
      sourceIdentity,
      `Circle attestation status: ${iris.status}.`,
    );
  }
  if (
    input.mintTxHash !== undefined &&
    iris.forwardTxHash !== undefined &&
    input.mintTxHash.toLowerCase() !== iris.forwardTxHash.toLowerCase()
  ) {
    throw new Error("Supplied CCTP mint transaction hash conflicts with Circle's forwarding hash.");
  }
  const mintTxHash = iris.forwardTxHash ?? input.mintTxHash;
  if (!mintTxHash) {
    return forwarding(input.burnTxHash, attestedBurn, sourceIdentity, iris.forwardState);
  }

  await assertChain(destination, CCTP_ROUTE.destinationChainId, "destination");
  let destinationTx: unknown;
  let destinationReceipt: unknown;
  try {
    destinationTx = await destination.getTransaction({ hash: mintTxHash });
    if (destinationTx === null)
      return forwarding(
        input.burnTxHash,
        attestedBurn,
        sourceIdentity,
        iris.forwardState,
        mintTxHash,
      );
    destinationReceipt = await destination.getTransactionReceipt({ hash: mintTxHash });
  } catch (error) {
    if (isMissingTransactionError(error)) {
      return forwarding(
        input.burnTxHash,
        attestedBurn,
        sourceIdentity,
        iris.forwardState,
        mintTxHash,
      );
    }
    throw error;
  }
  if (destinationTx === null || destinationReceipt === null)
    return forwarding(
      input.burnTxHash,
      attestedBurn,
      sourceIdentity,
      iris.forwardState,
      mintTxHash,
    );
  if (statusOf(destinationReceipt) !== "success") {
    return forwarding(
      input.burnTxHash,
      attestedBurn,
      sourceIdentity,
      iris.forwardState,
      mintTxHash,
      "Forwarded destination transaction has not succeeded.",
    );
  }

  verifyDestinationSettlement(
    destinationTx,
    destinationReceipt,
    iris.message,
    attestedBurn,
    recipient,
  );
  const balanceBaseUnits = await optionalBalance(destination, recipient);
  return {
    stage: "completed",
    burnTxHash: input.burnTxHash,
    mintTxHash,
    ...(iris.forwardState === undefined ? {} : { forwardState: iris.forwardState }),
    ...verifiedBurnFields(attestedBurn, recipient, sourceIdentity),
    feeBaseUnits: attestedBurn.feeExecuted.toString(),
    receivedBaseUnits: (attestedBurn.amount - attestedBurn.feeExecuted).toString(),
    ...(balanceBaseUnits === undefined ? {} : { balanceBaseUnits }),
  };
}

function defaultClient(url: string): CctpPublicClient {
  return createPublicClient({ transport: http(url) }) as unknown as CctpPublicClient;
}

async function assertChain(
  client: CctpPublicClient,
  expected: number,
  name: string,
): Promise<void> {
  const actual = await client.getChainId();
  if (actual !== expected)
    throw new Error(`CCTP ${name} client is connected to chain ${actual}, expected ${expected}.`);
}

function verifySourceIdentity(
  transaction: unknown,
  receipt: unknown,
  requestedHash: Hash,
): VerifiedSourceIdentity {
  const tx = record(transaction, "Source transaction");
  const txHash = tx.hash;
  const nonce = tx.nonce;
  const sourceReceipt = record(receipt, "Source receipt");
  const receiptHash = sourceReceipt.transactionHash;
  const blockNumber = sourceReceipt.blockNumber;
  if (
    typeof txHash !== "string" ||
    !isHash(txHash) ||
    txHash.toLowerCase() !== requestedHash.toLowerCase() ||
    typeof receiptHash !== "string" ||
    !isHash(receiptHash) ||
    receiptHash.toLowerCase() !== requestedHash.toLowerCase()
  ) {
    throw new Error("Source transaction and receipt are not bound to the requested burn hash.");
  }
  if (typeof nonce !== "number" || !Number.isSafeInteger(nonce) || nonce < 0) {
    throw new Error("Source transaction nonce is not a safe non-negative integer.");
  }
  if (typeof blockNumber !== "bigint" || blockNumber < 0n) {
    throw new Error("Source receipt block number is not a canonical non-negative value.");
  }
  return { sourceNonce: nonce, sourceBlockNumber: blockNumber.toString() };
}

function verifiedBurnFields(
  burn: Pick<ValidBurn, "sender" | "amount" | "maxFee">,
  recipient: Address,
  identity: VerifiedSourceIdentity,
): Pick<
  CctpStatus,
  | "sourceNonce"
  | "sourceBlockNumber"
  | "sender"
  | "recipient"
  | "amountBaseUnits"
  | "maxFeeBaseUnits"
> {
  return {
    ...identity,
    sender: burn.sender,
    recipient,
    amountBaseUnits: burn.amount.toString(),
    maxFeeBaseUnits: burn.maxFee.toString(),
  };
}

function validateBurnTransaction(
  transaction: unknown,
  receipt: unknown,
  recipient: Address,
): ValidBurn {
  const burn = validateBurnCall(transaction, recipient);
  const message = sourceMessage(receipt);
  const parsedMessage = verifyMessageLayout(
    message,
    burn.amount,
    burn.maxFee,
    recipient,
    burn.sender,
  );
  if (parsedMessage.feeExecuted > burn.maxFee || parsedMessage.feeExecuted >= burn.amount) {
    throw new Error("Source CCTP message has an invalid executed fee.");
  }
  return { ...burn, recipient, ...parsedMessage, message };
}

function validateBurnCall(
  transaction: unknown,
  recipient: Address,
): Omit<ValidBurn, "recipient" | "nonce" | "feeExecuted" | "message"> {
  const tx = record(transaction, "Source transaction");
  const to = addressField(tx.to, "Source transaction recipient");
  if (!isAddressEqual(to, CCTP_ROUTE.sourceTokenMessenger)) {
    throw new Error("Source transaction is not addressed to the pinned CCTP TokenMessenger.");
  }
  const sender = addressField(tx.from, "Source transaction sender");
  if (typeof tx.input !== "string" && typeof tx.data !== "string")
    throw new Error("Source transaction has no calldata.");
  const data = (tx.input ?? tx.data) as Hex;
  let decoded: ReturnType<typeof decodeFunctionData<typeof cctpTokenMessengerAbi>>;
  try {
    decoded = decodeFunctionData({ abi: cctpTokenMessengerAbi, data });
  } catch {
    throw new Error("Source transaction calldata is not a CCTP forwarding burn.");
  }
  if (decoded.functionName !== "depositForBurnWithHook")
    throw new Error("Source transaction does not use the CCTP forwarding hook.");
  const args = decoded.args;
  if (!args || args.length !== 8) throw new Error("Source CCTP burn calldata is malformed.");
  const [amount, domain, mintRecipient, burnToken, destinationCaller, maxFee, finality, hook] =
    args;
  if (
    domain !== CCTP_ROUTE.destinationDomain ||
    !isAddressEqual(burnToken as Address, CCTP_ROUTE.sourceUsdc) ||
    mintRecipient.toLowerCase() !== bytes32Address(recipient).toLowerCase() ||
    destinationCaller.toLowerCase() !== CCTP_ZERO_BYTES32 ||
    finality !== 2_000 ||
    hook.toLowerCase() !== CCTP_FORWARD_HOOK_V1
  ) {
    throw new Error("Source CCTP burn calldata does not match the immutable Sepolia-to-Arc route.");
  }
  if (amount === 0n || maxFee >= amount)
    throw new Error("Source CCTP burn has invalid amount or fee.");
  return { sender, amount, maxFee };
}

function sourceMessage(receipt: unknown): Hex {
  const logs = logsOf(receipt);
  const messages: Hex[] = [];
  for (const log of logs) {
    if (!sameAddress(log.address, CCTP_ROUTE.sourceMessageTransmitter)) continue;
    try {
      const decoded = decodeEventLog({
        abi: messageTransmitterAbi,
        data: log.data as Hex,
        topics: log.topics as [Hex, ...Hex[]],
      });
      if (decoded.eventName === "MessageSent" && typeof decoded.args.message === "string")
        messages.push(decoded.args.message);
    } catch {
      // A different event from the transmitter is not evidence of a CCTP burn.
    }
  }
  if (messages.length !== 1)
    throw new Error("Validated burn receipt must contain exactly one source MessageSent event.");
  const message = messages[0];
  if (!message) throw new Error("Source MessageSent event is missing.");
  return message;
}

function verifyMessageLayout(
  message: Hex,
  amount: bigint,
  maxFee: bigint,
  recipient: Address,
  sender: Address,
): { feeExecuted: bigint; nonce: Hex } {
  const raw = message.slice(2);
  // Relay messages have zeroed nonce/finality-executed/fee/expiration placeholders.
  if (!/^[0-9a-fA-F]+$/.test(raw) || raw.length !== (148 + 228 + 32) * 2) {
    throw new Error("Source MessageSent payload is not the fixed forwarding CCTP v2 message.");
  }
  const word = (offset: number) => BigInt(`0x${raw.slice(offset * 2, offset * 2 + 64)}`);
  const uint32 = (offset: number) => Number.parseInt(raw.slice(offset * 2, offset * 2 + 8), 16);
  const bytes32 = (offset: number) => `0x${raw.slice(offset * 2, offset * 2 + 64)}`.toLowerCase();
  if (
    uint32(0) !== 1 ||
    uint32(4) !== CCTP_ROUTE.sourceDomain ||
    uint32(8) !== CCTP_ROUTE.destinationDomain ||
    bytes32(12) !== CCTP_ZERO_BYTES32 ||
    bytes32(44) !== bytes32Address(CCTP_ROUTE.sourceTokenMessenger).toLowerCase() ||
    bytes32(76) !== bytes32Address(CCTP_ROUTE.destinationTokenMessenger).toLowerCase() ||
    bytes32(108) !== CCTP_ZERO_BYTES32 ||
    uint32(140) !== 2_000 ||
    uint32(144) !== 0 ||
    uint32(148) !== 1 ||
    bytes32(152) !== bytes32Address(CCTP_ROUTE.sourceUsdc).toLowerCase() ||
    bytes32(184) !== bytes32Address(recipient).toLowerCase() ||
    word(216) !== amount ||
    bytes32(248) !== bytes32Address(sender).toLowerCase() ||
    word(280) !== maxFee ||
    word(312) !== 0n ||
    word(344) !== 0n ||
    `0x${raw.slice(376 * 2)}`.toLowerCase() !== CCTP_FORWARD_HOOK_V1
  ) {
    throw new Error(
      "Source MessageSent payload does not bind the expected CCTP route, sender, recipient, amount, and hook.",
    );
  }
  return {
    nonce: CCTP_ZERO_BYTES32,
    feeExecuted: 0n,
  };
}

interface AttestedFields {
  nonce: Hex;
  feeExecuted: bigint;
  expirationBlock: bigint;
}

/**
 * Before Iris has assembled an attested message, its v2 endpoint returns this
 * one-record envelope. There is no message body to bind yet, so accept only
 * this exact pending shape after the on-chain source burn has been verified.
 */
function isPendingConfirmationsEnvelope(payload: unknown, burnTxHash: Hash): boolean {
  if (!isRecord(payload) || typeof payload.sourceTxHash !== "string") return false;
  if (payload.sourceTxHash.toLowerCase() !== burnTxHash.toLowerCase()) return false;
  if (!Array.isArray(payload.messages) || payload.messages.length !== 1) return false;
  const entry = payload.messages[0];
  return (
    isRecord(entry) &&
    entry.attestation === "PENDING" &&
    entry.message === null &&
    typeof entry.eventNonce === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(entry.eventNonce) &&
    entry.cctpVersion === 2 &&
    entry.status === "pending_confirmations" &&
    entry.decodedMessage === null &&
    entry.delayReason === null
  );
}

function selectIrisMessage(payload: unknown, burnTxHash: Hash, burn: ValidBurn): IrisMessage {
  const body = record(payload, "CCTP Iris response");
  if (
    typeof body.sourceTxHash !== "string" ||
    body.sourceTxHash.toLowerCase() !== burnTxHash.toLowerCase()
  ) {
    throw new Error("CCTP Iris response is not bound to the requested source transaction.");
  }
  if (!Array.isArray(body.messages)) throw new Error("CCTP Iris response has no messages array.");
  const matches = body.messages
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      entry,
      fields:
        attestedMessageFields(entry.message, burn) ??
        (typeof entry.message === "string" &&
        entry.message.toLowerCase() === burn.message.toLowerCase() &&
        typeof entry.status === "string" &&
        entry.status.toLowerCase() !== "complete"
          ? {
              nonce: CCTP_ZERO_BYTES32,
              feeExecuted: 0n,
              expirationBlock: 0n,
            }
          : undefined),
    }))
    .filter(
      (candidate): candidate is { entry: Record<string, unknown>; fields: AttestedFields } =>
        candidate.fields !== undefined,
    );
  if (matches.length !== 1)
    throw new Error("CCTP Iris response does not uniquely identify the validated source message.");
  const match = matches[0];
  if (!match) throw new Error("CCTP Iris source message is missing.");
  if (typeof match.entry.status !== "string" || !isRecord(match.entry.decodedMessage))
    throw new Error("CCTP Iris message metadata is malformed.");
  if (
    (match.entry.cctpVersion !== undefined && match.entry.cctpVersion !== 2) ||
    (match.entry.eventNonce !== undefined &&
      !sameBytes32(match.entry.eventNonce, match.fields.nonce))
  ) {
    throw new Error("CCTP Iris message metadata is not bound to the attested v2 message.");
  }
  if (
    match.entry.forwardTxHash !== undefined &&
    (typeof match.entry.forwardTxHash !== "string" || !isHash(match.entry.forwardTxHash))
  ) {
    throw new Error("CCTP Iris forwarding transaction hash is malformed.");
  }
  return {
    message: match.entry.message as Hex,
    status: match.entry.status,
    nonce: match.fields.nonce,
    feeExecuted: match.fields.feeExecuted,
    expirationBlock: match.fields.expirationBlock,
    ...(typeof match.entry.forwardState === "string"
      ? { forwardState: match.entry.forwardState }
      : {}),
    ...(typeof match.entry.forwardTxHash === "string"
      ? { forwardTxHash: match.entry.forwardTxHash as Hash }
      : {}),
    decodedMessage: match.entry.decodedMessage,
  };
}

/**
 * Iris fills the source relay's zero nonce/finality/fee/expiration fields.
 * Those mutable fields cannot be compared byte-for-byte with MessageSent; all
 * immutable header and burn fields remain bound to the source call instead.
 */
function attestedMessageFields(value: unknown, burn: ValidBurn): AttestedFields | undefined {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]+$/.test(value)) return undefined;
  const raw = value.slice(2);
  if (raw.length !== (148 + 228 + 32) * 2) return undefined;
  const word = (offset: number) => BigInt(`0x${raw.slice(offset * 2, offset * 2 + 64)}`);
  const uint32 = (offset: number) => Number.parseInt(raw.slice(offset * 2, offset * 2 + 8), 16);
  const bytes32 = (offset: number) => `0x${raw.slice(offset * 2, offset * 2 + 64)}`.toLowerCase();
  const nonce = `0x${raw.slice(12 * 2, 44 * 2)}` as Hex;
  const feeExecuted = word(312);
  const expirationBlock = word(344);
  if (
    uint32(0) !== 1 ||
    uint32(4) !== CCTP_ROUTE.sourceDomain ||
    uint32(8) !== CCTP_ROUTE.destinationDomain ||
    nonce.toLowerCase() === CCTP_ZERO_BYTES32 ||
    bytes32(44) !== bytes32Address(CCTP_ROUTE.sourceTokenMessenger).toLowerCase() ||
    bytes32(76) !== bytes32Address(CCTP_ROUTE.destinationTokenMessenger).toLowerCase() ||
    bytes32(108) !== CCTP_ZERO_BYTES32 ||
    uint32(140) !== 2_000 ||
    uint32(144) < 2_000 ||
    uint32(148) !== 1 ||
    bytes32(152) !== bytes32Address(CCTP_ROUTE.sourceUsdc).toLowerCase() ||
    bytes32(184) !== bytes32Address(burn.recipient).toLowerCase() ||
    word(216) !== burn.amount ||
    bytes32(248) !== bytes32Address(burn.sender).toLowerCase() ||
    word(280) !== burn.maxFee ||
    feeExecuted > burn.maxFee ||
    feeExecuted >= burn.amount ||
    `0x${raw.slice(376 * 2)}`.toLowerCase() !== CCTP_FORWARD_HOOK_V1
  ) {
    return undefined;
  }
  return { nonce, feeExecuted, expirationBlock };
}

function validateIrisIdentity(iris: IrisMessage, burn: ValidBurn, recipient: Address): void {
  const outer = iris.decodedMessage;
  const inner = record(outer.decodedMessageBody, "CCTP Iris decoded burn message");
  if (
    decimal(outer.sourceDomain, "sourceDomain") !== BigInt(CCTP_ROUTE.sourceDomain) ||
    decimal(outer.destinationDomain, "destinationDomain") !==
      BigInt(CCTP_ROUTE.destinationDomain) ||
    !sameAddress(outer.sender, CCTP_ROUTE.sourceTokenMessenger) ||
    !sameAddress(outer.recipient, CCTP_ROUTE.destinationTokenMessenger) ||
    !sameBytes32(outer.destinationCaller, CCTP_ZERO_BYTES32) ||
    !sameAddress(inner.burnToken, CCTP_ROUTE.sourceUsdc) ||
    !sameAddress(inner.mintRecipient, recipient) ||
    decimal(inner.amount, "amount") !== burn.amount ||
    !sameAddress(inner.messageSender, burn.sender)
  ) {
    throw new Error("CCTP Iris metadata does not match the validated source burn identity.");
  }
}

function verifyDestinationSettlement(
  transaction: unknown,
  receipt: unknown,
  message: Hex,
  burn: ValidBurn & { expirationBlock: bigint },
  recipient: Address,
): void {
  const tx = record(transaction, "Forwarded destination transaction");
  if (!sameAddress(tx.to, CCTP_ROUTE.destinationMessageTransmitter)) {
    throw new Error("Forwarded transaction is not addressed to Arc's pinned MessageTransmitter.");
  }
  const data = (tx.input ?? tx.data) as Hex;
  let decoded: ReturnType<typeof decodeFunctionData<typeof messageTransmitterAbi>>;
  try {
    decoded = decodeFunctionData({ abi: messageTransmitterAbi, data });
  } catch {
    throw new Error("Forwarded destination transaction is not receiveMessage calldata.");
  }
  if (
    decoded.functionName !== "receiveMessage" ||
    !decoded.args ||
    decoded.args[0].toLowerCase() !== message.toLowerCase() ||
    typeof decoded.args[1] !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(decoded.args[1])
  ) {
    throw new Error("Forwarded receiveMessage call is not bound to the Iris source message.");
  }

  const expectedReceived = burn.amount - burn.feeExecuted;
  const mintBlock = blockNumberOf(receipt);
  if (burn.expirationBlock !== 0n && mintBlock >= burn.expirationBlock) {
    throw new Error("Forwarded Arc mint occurred after the CCTP message expiration block.");
  }
  let received = false;
  let minted = false;
  for (const log of logsOf(receipt)) {
    if (sameAddress(log.address, CCTP_ROUTE.destinationMessageTransmitter)) {
      try {
        const event = decodeEventLog({
          abi: messageTransmitterAbi,
          data: log.data as Hex,
          topics: log.topics as [Hex, ...Hex[]],
        });
        if (
          event.eventName === "MessageReceived" &&
          event.args.sourceDomain === CCTP_ROUTE.sourceDomain &&
          sameBytes32(event.args.nonce, burn.nonce) &&
          sameBytes32(event.args.sender, bytes32Address(CCTP_ROUTE.sourceTokenMessenger)) &&
          event.args.finalityThresholdExecuted >= 2_000 &&
          typeof event.args.messageBody === "string" &&
          event.args.messageBody.toLowerCase() === `0x${message.slice(2 + 148 * 2)}`.toLowerCase()
        )
          received = true;
      } catch {}
    }
    if (sameAddress(log.address, CCTP_ROUTE.destinationUsdc)) {
      try {
        const event = decodeEventLog({
          abi: erc20Abi,
          data: log.data as Hex,
          topics: log.topics as [Hex, ...Hex[]],
        });
        if (
          event.eventName === "Transfer" &&
          sameAddress(event.args.from, "0x0000000000000000000000000000000000000000") &&
          sameAddress(event.args.to, recipient) &&
          event.args.value === expectedReceived
        )
          minted = true;
      } catch {}
    }
  }
  if (!received)
    throw new Error(
      "Forwarded Arc receipt lacks an authentic MessageReceived event for this message.",
    );
  if (!minted)
    throw new Error(
      "Forwarded Arc receipt lacks the exact native-USDC mint to the requested recipient.",
    );
}

function pendingAttestation(
  hash: Hash,
  burn: ValidBurn,
  sourceIdentity: VerifiedSourceIdentity,
  detail: string,
): CctpStatus {
  return {
    stage: "attestation_pending",
    burnTxHash: hash,
    ...verifiedBurnFields(burn, burn.recipient, sourceIdentity),
    detail,
  };
}

function forwarding(
  hash: Hash,
  burn: ValidBurn,
  sourceIdentity: VerifiedSourceIdentity,
  state?: string,
  mintTxHash?: Hash,
  detail?: string,
): CctpStatus {
  return {
    stage: "forwarding",
    burnTxHash: hash,
    ...(mintTxHash ? { mintTxHash } : {}),
    ...(state === undefined ? {} : { forwardState: state }),
    ...verifiedBurnFields(burn, burn.recipient, sourceIdentity),
    detail:
      detail ??
      (state
        ? `Forwarding service state: ${state}.`
        : "Circle attested the burn; forwarding is still pending."),
  };
}

function isMissingTransactionError(error: unknown): boolean {
  return (
    error instanceof TransactionNotFoundError || error instanceof TransactionReceiptNotFoundError
  );
}

async function optionalBalance(
  client: CctpPublicClient,
  recipient: Address,
): Promise<string | undefined> {
  if (!client.readContract) return undefined;
  const balance = await client.readContract({
    address: CCTP_ROUTE.destinationUsdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [recipient],
  });
  if (typeof balance !== "bigint") throw new Error("Arc USDC balance response is malformed.");
  return balance.toString();
}

function logsOf(receipt: unknown): Array<Record<string, unknown>> {
  const logs = record(receipt, "Transaction receipt").logs;
  if (!Array.isArray(logs)) throw new Error("Transaction receipt has no logs.");
  return logs.map((entry) => record(entry, "Transaction log"));
}

function blockNumberOf(receipt: unknown): bigint {
  const blockNumber = record(receipt, "Transaction receipt").blockNumber;
  if (typeof blockNumber !== "bigint")
    throw new Error("Transaction receipt has an invalid block number.");
  return blockNumber;
}

function statusOf(receipt: unknown): string | undefined {
  const status = record(receipt, "Transaction receipt").status;
  return typeof status === "string" ? status : undefined;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} is malformed.`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function addressField(value: unknown, label: string): Address {
  if (typeof value !== "string") throw new Error(`${label} is missing.`);
  try {
    return getAddress(value);
  } catch {
    throw new Error(`${label} is invalid.`);
  }
}

function sameAddress(value: unknown, expected: Address): boolean {
  if (typeof value !== "string") return false;
  try {
    return isAddressEqual(getAddress(value), expected);
  } catch {
    return false;
  }
}

function sameBytes32(value: unknown, expected: Hex): boolean {
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

function bytes32Address(address: Address): Hex {
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}` as Hex;
}

function decimal(value: unknown, label: string): bigint {
  if (typeof value !== "string" || !/^(?:0|[1-9]\d*)$/.test(value))
    throw new Error(`CCTP Iris ${label} is malformed.`);
  return BigInt(value);
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
