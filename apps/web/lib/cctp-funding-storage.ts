import { type Address, type Hash, isAddress } from "viem";

export interface FundingStorage {
  getItem(key: string): string | null;
  removeItem(key: string): void;
  setItem(key: string, value: string): void;
}

export interface StoredFundingTransfer {
  amountBaseUnits: string;
  burnTxHash: Hash;
  maxFeeBaseUnits: string;
  recipient: Address;
  savedAt: number;
  sender: Address;
  sourceBlockNumber: string;
  sourceNonce: number;
  version: 1;
}

export interface FundingIntent {
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  sourceBlockNumber: string;
  sourceNonce: number;
}

interface PendingFundingMarker {
  burnTxHash?: Hash;
  createdAt: number;
  recipient: Address;
  sender: Address;
  intent?: FundingIntent;
  version: 1;
}

export type LoadedFunding =
  | { kind: "active"; transfer: StoredFundingTransfer }
  | { hasIntent: boolean; kind: "pending" }
  | { kind: "none" };

export interface FundingStorageSnapshot {
  pending: string | null;
  transfer: string | null;
}

const HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export function isStrictTransactionHash(value: string): value is Hash {
  return HASH_PATTERN.test(value);
}

export function cctpFundingScope(recipient: Address, sender: Address): string {
  return `${recipient.toLowerCase()}:${sender.toLowerCase()}`;
}

export function cctpFundingTransferKey(recipient: Address, sender: Address): string {
  return `cctp-funding:v1:transfer:${cctpFundingScope(recipient, sender)}`;
}

export function cctpFundingPendingKey(recipient: Address, sender: Address): string {
  return `cctp-funding:v1:pending:${cctpFundingScope(recipient, sender)}`;
}

export function cctpFundingLockName(recipient: Address, sender: Address): string {
  return `cctp-funding:${cctpFundingScope(recipient, sender)}`;
}

function parseStoredObject(value: string, label: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error(`Saved CCTP ${label} data is invalid. Do not start another transfer.`);
  }
}

function isScopedAddress(value: unknown, expected: Address): value is Address {
  return (
    typeof value === "string" &&
    isAddress(value, { strict: false }) &&
    value.toLowerCase() === expected.toLowerCase()
  );
}

function parseIntent(value: unknown): FundingIntent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const intent = value as Record<string, unknown>;
  if (
    typeof intent.sourceNonce !== "number" ||
    !Number.isSafeInteger(intent.sourceNonce) ||
    intent.sourceNonce < 0 ||
    typeof intent.sourceBlockNumber !== "string" ||
    !/^\d+$/.test(intent.sourceBlockNumber) ||
    typeof intent.amountBaseUnits !== "string" ||
    !/^\d+$/.test(intent.amountBaseUnits) ||
    typeof intent.maxFeeBaseUnits !== "string" ||
    !/^\d+$/.test(intent.maxFeeBaseUnits)
  ) {
    return null;
  }
  return {
    amountBaseUnits: intent.amountBaseUnits,
    maxFeeBaseUnits: intent.maxFeeBaseUnits,
    sourceBlockNumber: intent.sourceBlockNumber,
    sourceNonce: intent.sourceNonce,
  };
}

function parseTransfer(value: string, recipient: Address, sender: Address): StoredFundingTransfer {
  const parsed = parseStoredObject(value, "transfer");
  const intent = parseIntent(parsed);
  if (
    parsed.version !== 1 ||
    !isStrictTransactionHash(typeof parsed.burnTxHash === "string" ? parsed.burnTxHash : "") ||
    !isScopedAddress(parsed.recipient, recipient) ||
    !isScopedAddress(parsed.sender, sender) ||
    !intent ||
    typeof parsed.savedAt !== "number" ||
    !Number.isFinite(parsed.savedAt)
  ) {
    throw new Error("Saved CCTP transfer data is invalid. Do not start another transfer.");
  }
  return {
    burnTxHash: parsed.burnTxHash as Hash,
    ...intent,
    recipient,
    savedAt: parsed.savedAt,
    sender,
    version: 1,
  };
}

function parsePending(value: string, recipient: Address, sender: Address): PendingFundingMarker {
  const parsed = parseStoredObject(value, "pending marker");
  const intent = parseIntent(parsed.intent);
  if (
    parsed.version !== 1 ||
    !isScopedAddress(parsed.recipient, recipient) ||
    !isScopedAddress(parsed.sender, sender) ||
    (parsed.intent !== undefined && !intent) ||
    (parsed.burnTxHash !== undefined &&
      !isStrictTransactionHash(typeof parsed.burnTxHash === "string" ? parsed.burnTxHash : "")) ||
    typeof parsed.createdAt !== "number" ||
    !Number.isFinite(parsed.createdAt)
  ) {
    throw new Error("Saved CCTP pending marker is invalid. Do not start another transfer.");
  }
  return {
    ...(parsed.burnTxHash ? { burnTxHash: parsed.burnTxHash as Hash } : {}),
    createdAt: parsed.createdAt,
    recipient,
    sender,
    ...(intent ? { intent } : {}),
    version: 1,
  };
}

function readStorage(storage: FundingStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    throw new Error("Browser storage is unavailable. CCTP funding cannot safely continue.");
  }
}

function writeVerified(storage: FundingStorage, key: string, value: string): void {
  // Read first so privacy-mode/quota failures are detected before a wallet request.
  readStorage(storage, key);
  try {
    storage.setItem(key, value);
  } catch {
    throw new Error(
      "Browser storage could not save CCTP recovery data. Do not submit a transaction.",
    );
  }
  if (readStorage(storage, key) !== value) {
    throw new Error(
      "Browser storage did not verify CCTP recovery data. Do not submit a transaction.",
    );
  }
}

function removeFundingStorage(storage: FundingStorage, key: string): void {
  readStorage(storage, key);
  try {
    storage.removeItem(key);
  } catch {
    throw new Error("Browser storage could not clear CCTP recovery data.");
  }
  if (readStorage(storage, key) !== null) {
    throw new Error("Browser storage did not clear CCTP recovery data.");
  }
}

export function removeFundingStorageIfMatches(
  storage: FundingStorage,
  key: string,
  expectedValue: string,
): boolean {
  if (readStorage(storage, key) !== expectedValue) return false;
  removeFundingStorage(storage, key);
  return true;
}

export function readFundingStorageSnapshot(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
): FundingStorageSnapshot {
  return {
    pending: readStorage(storage, cctpFundingPendingKey(recipient, sender)),
    transfer: readStorage(storage, cctpFundingTransferKey(recipient, sender)),
  };
}

export function fundingSnapshotMatches(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
  expected: FundingStorageSnapshot,
): boolean {
  const current = readFundingStorageSnapshot(storage, recipient, sender);
  return current.pending === expected.pending && current.transfer === expected.transfer;
}

export function loadFundingStorage(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
): LoadedFunding {
  const { pending, transfer } = readFundingStorageSnapshot(storage, recipient, sender);
  if (transfer) return { kind: "active", transfer: parseTransfer(transfer, recipient, sender) };

  if (pending) {
    return { hasIntent: Boolean(parsePending(pending, recipient, sender).intent), kind: "pending" };
  }
  return { kind: "none" };
}

export function writePendingFundingMarker(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
): string {
  const marker: PendingFundingMarker = {
    createdAt: Date.now(),
    recipient,
    sender,
    version: 1,
  };
  const serialized = JSON.stringify(marker);
  writeVerified(storage, cctpFundingPendingKey(recipient, sender), serialized);
  return serialized;
}

export function bindPendingFundingIntent(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
  expectedMarker: string,
  intent: FundingIntent,
): string {
  const key = cctpFundingPendingKey(recipient, sender);
  if (readStorage(storage, key) !== expectedMarker) {
    throw new Error("CCTP pending recovery data changed in another tab.");
  }
  if (!parseIntent(intent)) throw new Error("Invalid CCTP burn intent.");
  const marker = parsePending(expectedMarker, recipient, sender);
  const bound = JSON.stringify({ ...marker, intent });
  writeVerified(storage, key, bound);
  return bound;
}

export function persistFundingTransfer(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
  burnTxHash: Hash,
  intent: FundingIntent,
): void {
  if (!isStrictTransactionHash(burnTxHash))
    throw new Error("Wallet returned an invalid transaction hash.");
  if (!parseIntent(intent)) throw new Error("Invalid CCTP burn intent.");
  const transfer: StoredFundingTransfer = {
    ...intent,
    burnTxHash,
    recipient,
    savedAt: Date.now(),
    sender,
    version: 1,
  };
  writeVerified(storage, cctpFundingTransferKey(recipient, sender), JSON.stringify(transfer));
}

export function persistFundingTransferIfSnapshotMatches(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
  burnTxHash: Hash,
  intent: FundingIntent,
  expected: FundingStorageSnapshot,
): void {
  if (!fundingSnapshotMatches(storage, recipient, sender, expected)) {
    throw new Error("CCTP recovery data changed in another tab. The transfer was not replaced.");
  }
  persistFundingTransfer(storage, recipient, sender, burnTxHash, intent);
}

export function linkPendingFundingMarker(
  storage: FundingStorage,
  recipient: Address,
  sender: Address,
  expectedMarker: string,
  burnTxHash: Hash,
): string {
  const key = cctpFundingPendingKey(recipient, sender);
  if (readStorage(storage, key) !== expectedMarker) {
    throw new Error("CCTP pending recovery data changed in another tab.");
  }
  const marker = parsePending(expectedMarker, recipient, sender);
  if (!marker.intent) throw new Error("Legacy CCTP pending marker has no burn identity.");
  const linked = JSON.stringify({ ...marker, burnTxHash });
  writeVerified(storage, key, linked);
  return linked;
}

export function pendingMarkerLinksHash(
  value: string,
  recipient: Address,
  sender: Address,
  burnTxHash: Hash,
): boolean {
  return (
    parsePending(value, recipient, sender).burnTxHash?.toLowerCase() === burnTxHash.toLowerCase()
  );
}

export function pendingFundingIntent(
  value: string,
  recipient: Address,
  sender: Address,
): FundingIntent | undefined {
  return parsePending(value, recipient, sender).intent;
}

export interface FundingLockManager {
  request<T>(name: string, options: { mode: "exclusive" }, callback: () => Promise<T>): Promise<T>;
}

export async function withFundingLock<T>(
  lockManager: FundingLockManager | undefined,
  name: string,
  callback: () => Promise<T>,
): Promise<T> {
  if (!lockManager) {
    throw new Error("This browser does not support the CCTP safety lock. Use a supported browser.");
  }
  return lockManager.request(name, { mode: "exclusive" }, callback);
}
