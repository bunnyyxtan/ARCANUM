import {
  type Address,
  type Hash,
  type Hex,
  type LocalAccount,
  encodeFunctionData,
  keccak256,
} from "viem";

import {
  CCTP_ROUTE,
  type CctpPublicClient,
  type CctpStatus,
  getCctpStatus,
} from "../../packages/sdk/src/cctp";
import { safeError, saveObservedStatus, validateCctpRecovery } from "./cctp-fund-io";
import {
  type DestinationPublicClient,
  type SourcePublicClient,
  destinationPublicClient,
  funderAccount,
  recipientFromEnv,
  sourcePublicClient,
} from "./cctp-fund-signing";
import {
  type CctpRelayJournal,
  createCctpRelayJournal,
  readCctpRelayJournal,
  updateCctpRelayJournal,
} from "./cctp-relay-state";
import {
  type CctpFundingState,
  type CctpPendingMarker,
  type CctpStateIdentity,
  clearCctpPendingMarker,
  readCctpPendingMarker,
  readCctpState,
  updateCctpState,
} from "./cctp-state";

export const MANUAL_RELAY_BURN_HASH =
  "0xe53412c49a9e3524105e893b48812fa1e7859fb68c27d8160c3b70b82a28bbd9" as Hash;
export const MANUAL_RELAY_RECIPIENT = "0x9f044588539dc7fd7c2e666de55557abc3539b32" as Address;
export const MANUAL_RELAY_SENDER = "0xbf4be36ce2614b6c17261a593c937e0442675c39" as Address;
/** 0.01 Arc native USDC, whose native-denomination scale is 18 decimals. */
export const MANUAL_RELAY_GAS_CAP_WEI = 10_000_000_000_000_000n;

const RECEIVE_MESSAGE_ABI = [
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

interface RelayIrisPayload {
  message: Hex;
  attestation: Hex;
}

export interface RelayPreparedRequest {
  chainId: number;
  nonce: number;
  to: Address;
  data: Hex;
  value: 0n;
  type: "eip1559";
  gas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

export interface ManualRelayDependencies {
  sourceClient?: SourcePublicClient;
  destinationClient?: DestinationPublicClient;
  account?: LocalAccount;
  fetchFn?: typeof fetch;
  statusFn?: (
    input: {
      burnTxHash: Hash;
      recipient: Address;
      mintTxHash?: Hash;
    },
    options: {
      sourceClient: SourcePublicClient;
      destinationClient: DestinationPublicClient;
      fetchFn?: typeof fetch;
    },
  ) => Promise<CctpStatus>;
  directory?: string;
}

function sameHash(left: string | undefined, right: Hash): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

function sameAddress(left: string | undefined, right: Address): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

function expectedIdentity(
  state: CctpFundingState,
  marker: CctpPendingMarker,
): {
  sender: Address;
  recipient: Address;
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  sourceNonce: number;
  sourceBlockNumber: string;
} {
  if (!state.burnTxHash) throw new Error("Canonical CCTP state has no source burn hash.");
  if (!state.sender || state.sourceNonce === undefined || state.sourceBlockNumber === undefined) {
    throw new Error("Canonical CCTP state has incomplete source intent proof.");
  }
  const intent = marker.intent;
  if (!intent || intent.sourceNonce === undefined || intent.sourceBlockNumber === undefined) {
    throw new Error("CCTP pending marker has incomplete source intent proof.");
  }
  const stateIdentity = {
    sender: state.sender,
    recipient: state.recipient,
    amountBaseUnits: state.amountBaseUnits,
    maxFeeBaseUnits: state.maxFeeBaseUnits,
    sourceNonce: state.sourceNonce,
    sourceBlockNumber: state.sourceBlockNumber,
  };
  const markerIdentity = {
    sender: intent.sender,
    recipient: intent.recipient,
    amountBaseUnits: intent.amountBaseUnits,
    maxFeeBaseUnits: intent.maxFeeBaseUnits,
    sourceNonce: intent.sourceNonce,
    sourceBlockNumber: intent.sourceBlockNumber,
  };
  if (
    stateIdentity.sender.toLowerCase() !== markerIdentity.sender.toLowerCase() ||
    stateIdentity.recipient.toLowerCase() !== markerIdentity.recipient.toLowerCase() ||
    stateIdentity.amountBaseUnits !== markerIdentity.amountBaseUnits ||
    stateIdentity.maxFeeBaseUnits !== markerIdentity.maxFeeBaseUnits ||
    stateIdentity.sourceNonce !== markerIdentity.sourceNonce ||
    stateIdentity.sourceBlockNumber !== markerIdentity.sourceBlockNumber
  ) {
    throw new Error(
      "Canonical CCTP state and pending marker are not bound to the same source intent.",
    );
  }
  return stateIdentity;
}

export function validateManualRelayIntent(
  burnTxHash: Hash,
  state: CctpFundingState | undefined,
  marker: CctpPendingMarker | undefined,
  status: CctpStatus,
  accountAddress: Address,
  expectedRecipient = MANUAL_RELAY_RECIPIENT,
  expectedSender = MANUAL_RELAY_SENDER,
): void {
  if (!sameHash(state?.burnTxHash, burnTxHash)) {
    throw new Error("Manual relay hash does not match the canonical source burn state.");
  }
  if (!state || !marker) {
    throw new Error("Manual relay requires both canonical state and its pending marker.");
  }
  const intent = expectedIdentity(state, marker);
  if (!sameAddress(intent.recipient, expectedRecipient)) {
    throw new Error("Manual relay recipient is not the approved Arc recipient.");
  }
  if (!sameAddress(intent.sender, expectedSender)) {
    throw new Error("Manual relay source sender is not the approved Circle account.");
  }
  if (!sameAddress(intent.recipient, state.recipient)) {
    throw new Error("Manual relay recipient does not match canonical state.");
  }
  if (!sameAddress(accountAddress, intent.sender)) {
    throw new Error("Configured signer is not the canonical source sender.");
  }
  if (!sameHash(status.burnTxHash, burnTxHash)) {
    throw new Error("CCTP status proof is for a different source burn hash.");
  }
  const recovery = validateCctpRecovery(state, marker, burnTxHash, status);
  if (!recovery.linked) {
    throw new Error(
      `Manual relay source proof rejected: ${recovery.reason ?? "identity mismatch"}.`,
    );
  }
}

function parseIrisRelayPayload(raw: string, burnTxHash: Hash): RelayIrisPayload {
  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Circle Iris response snapshot was not valid JSON.");
  }
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Circle Iris response snapshot is not an object.");
  }
  const body = payload as Record<string, unknown>;
  if (
    typeof body.sourceTxHash !== "string" ||
    body.sourceTxHash.toLowerCase() !== burnTxHash.toLowerCase() ||
    !Array.isArray(body.messages) ||
    body.messages.length !== 1
  ) {
    throw new Error("Circle Iris response is not uniquely bound to the requested source burn.");
  }
  const entry = body.messages[0];
  if (typeof entry !== "object" || entry === null) {
    throw new Error("Circle Iris message record is malformed.");
  }
  const message = entry as Record<string, unknown>;
  if (
    message.status !== "complete" ||
    typeof message.message !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(message.message) ||
    typeof message.attestation !== "string" ||
    !/^0x[0-9a-fA-F]+$/.test(message.attestation) ||
    message.attestation === "0x"
  ) {
    throw new Error("Circle Iris response has no complete usable attestation.");
  }
  return {
    message: message.message as Hex,
    attestation: message.attestation as Hex,
  };
}

async function getStatus(
  dependencies: ManualRelayDependencies,
  input: { burnTxHash: Hash; recipient: Address; mintTxHash?: Hash },
  captureResponse = false,
): Promise<{ status: CctpStatus; irisSnapshot?: string }> {
  const source = dependencies.sourceClient ?? sourcePublicClient();
  const destination = dependencies.destinationClient ?? destinationPublicClient();
  const fetchFn = dependencies.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== "function")
    throw new Error("No fetch implementation is available for relay.");
  let irisSnapshot: string | undefined;
  const captureFetch: typeof fetch = async (request, init) => {
    const response = await fetchFn(request, init);
    if (captureResponse) irisSnapshot = await response.clone().text();
    return response;
  };
  const status = dependencies.statusFn
    ? await dependencies.statusFn(input, {
        sourceClient: source,
        destinationClient: destination,
        fetchFn: captureFetch,
      })
    : await getCctpStatus(input, {
        sourceClient: source as unknown as CctpPublicClient,
        destinationClient: destination as unknown as CctpPublicClient,
        fetchFn: captureFetch,
      });
  return { status, ...(irisSnapshot === undefined ? {} : { irisSnapshot }) };
}

export async function prepareManualRelayRequest(
  client: DestinationPublicClient,
  account: Address,
  data: Hex,
): Promise<RelayPreparedRequest> {
  const chainId = await client.getChainId();
  if (chainId !== CCTP_ROUTE.destinationChainId) {
    throw new Error(
      `Arc relay RPC is chain ${chainId}, not Arc Testnet (${CCTP_ROUTE.destinationChainId}).`,
    );
  }
  await client.call({ account, to: CCTP_ROUTE.destinationMessageTransmitter, data, value: 0n });
  const estimatedGas = await client.estimateGas({
    account,
    to: CCTP_ROUTE.destinationMessageTransmitter,
    data,
    value: 0n,
  });
  const gas = (estimatedGas * 120n + 99n) / 100n;
  const [pendingNonce, latestNonce, fees] = await Promise.all([
    client.getTransactionCount({ address: account, blockTag: "pending" }),
    client.getTransactionCount({ address: account, blockTag: "latest" }),
    client.estimateFeesPerGas(),
  ]);
  if (pendingNonce !== latestNonce) {
    throw new Error(
      "Arc signer has a pending transaction; refusing a nonce race for manual relay.",
    );
  }
  if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) {
    throw new Error("Arc RPC did not provide explicit EIP-1559 fee terms.");
  }
  if (fees.maxFeePerGas < fees.maxPriorityFeePerGas) {
    throw new Error("Arc RPC returned invalid EIP-1559 fee ordering.");
  }
  if (gas * fees.maxFeePerGas > MANUAL_RELAY_GAS_CAP_WEI) {
    throw new Error(
      "Manual relay exceeds the hard 0.01 Arc native-USDC gas cap; no signing attempted.",
    );
  }
  return {
    chainId: CCTP_ROUTE.destinationChainId,
    nonce: pendingNonce,
    to: CCTP_ROUTE.destinationMessageTransmitter,
    data,
    value: 0n,
    type: "eip1559",
    gas,
    maxFeePerGas: fees.maxFeePerGas,
    maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
  };
}

function relayData(payload: RelayIrisPayload): Hex {
  return encodeFunctionData({
    abi: RECEIVE_MESSAGE_ABI,
    functionName: "receiveMessage",
    args: [payload.message, payload.attestation],
  });
}

function journalIntentMatches(
  journal: CctpRelayJournal,
  identity: ReturnType<typeof expectedIdentity>,
): boolean {
  return (
    sameAddress(journal.sender, identity.sender) &&
    sameAddress(journal.recipient, identity.recipient) &&
    journal.amountBaseUnits === identity.amountBaseUnits &&
    journal.maxFeeBaseUnits === identity.maxFeeBaseUnits &&
    journal.sourceNonce === identity.sourceNonce &&
    journal.sourceBlockNumber === identity.sourceBlockNumber
  );
}

async function pollKnownRelay(
  burnTxHash: Hash,
  recipient: Address,
  state: CctpFundingState,
  marker: CctpPendingMarker,
  journal: CctpRelayJournal,
  dependencies: ManualRelayDependencies,
  account: LocalAccount,
): Promise<CctpStatus> {
  if (!journal.mintTxHash) {
    throw new Error(
      "A prior manual relay journal has no known mint hash; refusing to sign or retry. Inspect it manually.",
    );
  }
  if (!sameHash(state.mintTxHash, journal.mintTxHash)) {
    throw new Error(
      "Relay journal mint hash does not match canonical state; refusing to poll/rebroadcast.",
    );
  }
  const { status } = await getStatus(dependencies, {
    burnTxHash,
    recipient,
    mintTxHash: journal.mintTxHash,
  });
  validateManualRelayIntent(burnTxHash, state, marker, status, account.address);
  if (status.stage === "completed") {
    const identity = identityForRelay(recipient);
    saveObservedStatus(identity, burnTxHash, status, dependencies.directory);
    clearCctpPendingMarker(identity, dependencies.directory);
    updateCctpRelayJournal(identity, burnTxHash, { phase: "completed" }, dependencies.directory);
  }
  return status;
}

function identityForRelay(recipient: Address): CctpStateIdentity {
  return { recipient, sourceChainId: CCTP_ROUTE.sourceChainId };
}

export async function runManualRelay(
  burnTxHash: Hash,
  confirm: boolean,
  dependencies: ManualRelayDependencies = {},
): Promise<CctpStatus> {
  if (!confirm) throw new Error("Manual relay requires the exact --confirm flag.");
  if (burnTxHash.toLowerCase() !== MANUAL_RELAY_BURN_HASH.toLowerCase()) {
    throw new Error("This operator-only relay is pinned to the approved source burn hash.");
  }
  const recipient = recipientFromEnv();
  if (recipient.toLowerCase() !== MANUAL_RELAY_RECIPIENT.toLowerCase()) {
    throw new Error("GUARDED_WALLET is not the approved manual-relay recipient.");
  }
  const identity = identityForRelay(recipient);
  const directory = dependencies.directory;
  const state = readCctpState(identity, directory);
  const marker = readCctpPendingMarker(identity, directory);
  const account = dependencies.account ?? funderAccount();
  if (!state) {
    throw new Error("Manual relay requires the existing canonical state and marker.");
  }
  if (
    state.phase === "completed" &&
    state.mintTxHash &&
    sameHash(state.burnTxHash, burnTxHash) &&
    sameAddress(state.sender, MANUAL_RELAY_SENDER) &&
    sameAddress(account.address, MANUAL_RELAY_SENDER)
  ) {
    const { status } = await getStatus(dependencies, {
      burnTxHash,
      recipient,
      mintTxHash: state.mintTxHash,
    });
    const recovery = validateCctpRecovery(state, marker, burnTxHash, status);
    if (status.stage !== "completed" || !recovery.linked) {
      throw new Error(
        "Canonical completed relay state did not pass a fresh completed status proof.",
      );
    }
    return status;
  }
  if (!marker) {
    throw new Error("Manual relay requires the existing canonical state and marker.");
  }
  const intent = expectedIdentity(state, marker);
  if (
    !sameAddress(intent.sender, MANUAL_RELAY_SENDER) ||
    !sameAddress(account.address, intent.sender)
  ) {
    throw new Error("Configured signer is not the approved source sender.");
  }
  const journal = readCctpRelayJournal(identity, burnTxHash, directory);
  if (journal) {
    if (!journal.mintTxHash) {
      throw new Error(
        "A prior manual relay journal has no known mint hash; refusing to sign or retry. Inspect it manually.",
      );
    }
    if (!journalIntentMatches(journal, intent)) {
      throw new Error("Manual relay journal is not bound to the current source intent.");
    }
    return pollKnownRelay(burnTxHash, recipient, state, marker, journal, dependencies, account);
  }
  if (state.mintTxHash) {
    throw new Error(
      "Canonical state already has a mint hash; poll status instead of starting another relay.",
    );
  }

  const first = await getStatus(dependencies, { burnTxHash, recipient }, true);
  validateManualRelayIntent(burnTxHash, state, marker, first.status, account.address);
  if (first.status.stage === "completed") {
    saveObservedStatus(identity, burnTxHash, first.status, directory);
    clearCctpPendingMarker(identity, directory);
    return first.status;
  }
  if (first.status.mintTxHash) {
    throw new Error(
      "Circle already supplied a destination mint hash; refusing to submit a second manual relay.",
    );
  }
  if (first.status.stage !== "forwarding" || !first.irisSnapshot) {
    throw new Error("CCTP attestation is not ready for a manual relay.");
  }
  const payload = parseIrisRelayPayload(first.irisSnapshot, burnTxHash);
  const destination = dependencies.destinationClient ?? destinationPublicClient();
  const data = relayData(payload);
  const request = await prepareManualRelayRequest(destination, account.address, data);
  let relayJournal: CctpRelayJournal;
  try {
    relayJournal = createCctpRelayJournal(
      identity,
      {
        burnTxHash,
        recipient,
        sender: account.address,
        amountBaseUnits: intent.amountBaseUnits,
        maxFeeBaseUnits: intent.maxFeeBaseUnits,
        sourceNonce: intent.sourceNonce,
        sourceBlockNumber: intent.sourceBlockNumber,
      },
      directory,
    );
  } catch (error) {
    const existing = readCctpRelayJournal(identity, burnTxHash, directory);
    if (!existing) throw error;
    if (!existing.mintTxHash) {
      throw new Error("Another relay attempt is marked without a known hash; inspect it manually.");
    }
    return pollKnownRelay(burnTxHash, recipient, state, marker, existing, dependencies, account);
  }
  let signed: Hex;
  try {
    signed = await account.signTransaction(request);
  } catch (error) {
    throw new Error(
      `Manual relay signing failed after the attempt marker was written: ${safeError(error)}.`,
    );
  }
  const mintTxHash = keccak256(signed);
  updateCctpRelayJournal(
    identity,
    burnTxHash,
    {
      phase: "signed",
      mintTxHash,
    },
    directory,
  );
  try {
    updateCctpState(identity, { mintTxHash }, directory);
  } catch (error) {
    throw new Error(
      `Signed relay ${mintTxHash} is journaled but canonical state could not be updated (${safeError(error)}); do not rebroadcast.`,
    );
  }
  let broadcastHash: Hash;
  try {
    broadcastHash = await destination.sendRawTransaction({ serializedTransaction: signed });
    if (broadcastHash.toLowerCase() !== mintTxHash.toLowerCase()) {
      throw new Error("Arc RPC returned a hash different from the signed relay bytes.");
    }
    updateCctpRelayJournal(identity, burnTxHash, { phase: "broadcast" }, directory);
  } catch (error) {
    updateCctpRelayJournal(
      identity,
      burnTxHash,
      {
        phase: "ambiguous",
        lastError: safeError(error),
      },
      directory,
    );
    throw new Error(
      `Manual relay broadcast is ambiguous for ${mintTxHash}; inspect status and never resubmit (${safeError(error)}).`,
    );
  }
  const { status } = await getStatus(dependencies, {
    burnTxHash,
    recipient,
    mintTxHash: broadcastHash,
  });
  validateManualRelayIntent(burnTxHash, state, marker, status, account.address);
  if (status.stage === "completed") {
    saveObservedStatus(identity, burnTxHash, status, directory);
    clearCctpPendingMarker(identity, directory);
    updateCctpRelayJournal(identity, burnTxHash, { phase: "completed" }, directory);
  }
  return status;
}

export function approvedRelayUsage(): string {
  return "Usage: cctp-relay.ts <approved burnTxHash> --confirm";
}
