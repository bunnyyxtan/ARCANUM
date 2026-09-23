import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

import type { Address, Hash } from "viem";

/**
 * This state is deliberately boring.  It is an operator recovery aid, not an
 * authority for a transfer: the source and destination chains remain the
 * authority.  In particular, never add calldata, signed bytes, or credentials
 * to this file.
 */
export const CCTP_STATE_DIR = join("demo-output", "cctp");
export const CCTP_STATE_VERSION = 1;

export type CctpRunPhase =
  | "prepared"
  | "approval_pending"
  | "approval_confirmed"
  | "approval_failed"
  | "quote_expired"
  | "safety_failed"
  | "burn_failed"
  | "burn_pending"
  | "source_pending"
  | "attestation_pending"
  | "forwarding"
  | "completed"
  | "source_failed";

export interface CctpFundingState {
  version: 1;
  recipient: Address;
  sender?: Address;
  sourceChainId: number;
  destinationChainId: number;
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  minimumReceivedBaseUnits: string;
  quoteExpiresAt: number;
  phase: CctpRunPhase;
  approvalTxHash?: Hash;
  burnTxHash?: Hash;
  mintTxHash?: Hash;
  sourceNonce?: number;
  sourceBlockNumber?: string;
  sourceProofVerified?: boolean;
  sourceError?: string;
  lastError?: string;
  lastStage?: CctpRunPhase;
  pollCount: number;
  lastCheckedAt?: number;
  safety?: CctpSafetyState;
  updatedAt: number;
}

/**
 * Read-only safety terms and gas observations for an explicitly capped run.
 * These fields contain no calldata, signatures or credentials.
 */
export interface CctpSafetyState {
  maxFeeBaseUnits?: string;
  maxSourceGasWei?: string;
  initialQuoteMaxFeeBaseUnits?: string;
  refreshedQuoteMaxFeeBaseUnits?: string;
  approvalNonce?: number;
  burnNonce?: number;
  approvalMaxCostWei?: string;
  burnGasCeiling?: string;
  approvalGasLimit?: string;
  burnGasLimit?: string;
  approvalMaxFeePerGasWei?: string;
  burnMaxFeePerGasWei?: string;
  combinedMaxGasWei?: string;
}

export interface CctpStateIdentity {
  recipient: Address;
  sourceChainId: number;
}

export interface CctpBurnIntent {
  sender: Address;
  recipient: Address;
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  sourceNonce?: number;
  sourceBlockNumber?: string;
}

export interface CctpPendingMarker {
  version: 1;
  recipient: Address;
  sourceChainId: number;
  createdAt: number;
  intent?: CctpBurnIntent;
}

export interface CctpStateLock {
  readonly markerPath: string;
  release(): void;
}

export interface CctpSigningLock {
  readonly lockPath: string;
  release(): void;
}

const SAFE_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SAFE_HASH = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;

function stateStem(identity: CctpStateIdentity): string {
  const recipient = identity.recipient.toLowerCase();
  if (!SAFE_ADDRESS.test(recipient)) {
    throw new Error("Cannot address CCTP state: recipient is not a 20-byte address.");
  }
  if (!Number.isSafeInteger(identity.sourceChainId) || identity.sourceChainId <= 0) {
    throw new Error("Cannot address CCTP state: source chain id is invalid.");
  }
  return `${recipient.slice(2)}-${identity.sourceChainId}`;
}

function signingLockPath(sender: Address, sourceChainId: number, directory: string): string {
  const normalizedSender = sender.toLowerCase();
  if (!SAFE_ADDRESS.test(normalizedSender)) {
    throw new Error("Cannot address CCTP signing lock: sender is not a 20-byte address.");
  }
  if (!Number.isSafeInteger(sourceChainId) || sourceChainId <= 0) {
    throw new Error("Cannot address CCTP signing lock: source chain id is invalid.");
  }
  return join(directory, `${normalizedSender.slice(2)}-${sourceChainId}.signing`);
}

export function cctpStatePath(identity: CctpStateIdentity, directory = CCTP_STATE_DIR): string {
  return join(directory, `${stateStem(identity)}.json`);
}

export function cctpPendingPath(identity: CctpStateIdentity, directory = CCTP_STATE_DIR): string {
  return join(directory, `${stateStem(identity)}.pending`);
}

/**
 * Serialize all source-chain signing for one funder on one chain, regardless
 * of destination recipient. This is separate from the recipient-keyed pending
 * marker because two recipients can otherwise reserve the same pending nonce.
 */
export function acquireCctpSigningLock(
  sender: Address,
  sourceChainId: number,
  directory = CCTP_STATE_DIR,
): CctpSigningLock {
  ensureDirectory(directory);
  const lockPath = signingLockPath(sender, sourceChainId, directory);
  let fd: number;
  try {
    fd = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `A CCTP signing lock already exists for sender ${sender} on source ${sourceChainId}; inspect the other start and do not sign concurrently.`,
      );
    }
    throw error;
  }
  try {
    writeFileSync(
      fd,
      `${JSON.stringify({ version: CCTP_STATE_VERSION, sender, sourceChainId, createdAt: Date.now() })}\n`,
      { encoding: "utf8" },
    );
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    try {
      unlinkSync(lockPath);
    } catch {
      // Preserve the original lock creation error.
    }
    throw error;
  }
  closeSync(fd);
  chmodSync(lockPath, 0o600);
  let released = false;
  return {
    lockPath,
    release(): void {
      if (released) return;
      released = true;
      try {
        unlinkSync(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // mkdir's mode is affected by umask and does not change an existing
  // directory.  Keep the state directory private when it already exists.
  chmodSync(directory, 0o700);
}

function writePrivate(path: string, contents: string): void {
  const fd = openSync(path, "w", 0o600);
  try {
    writeFileSync(fd, contents, { encoding: "utf8" });
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  chmodSync(path, 0o600);
}

/**
 * Atomic replacement with a private temporary file.  A failed rename leaves
 * the old state (and, importantly, the pending marker) intact.
 */
function atomicWrite(path: string, contents: string): void {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    writePrivate(temporary, contents);
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  } catch (error) {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
    } catch {
      // Preserve the original write error.  The pending marker is the
      // operator's signal that this run must not be repeated automatically.
    }
    throw error;
  }
}

function assertDecimal(value: unknown, field: string): string {
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    throw new Error(`CCTP state has an invalid ${field}.`);
  }
  return value;
}

function assertOptionalHash(value: unknown, field: string): Hash | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !SAFE_HASH.test(value)) {
    throw new Error(`CCTP state has an invalid ${field}.`);
  }
  return value as Hash;
}

function assertOptionalAddress(value: unknown, field: string): Address | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !SAFE_ADDRESS.test(value)) {
    throw new Error(`CCTP state has an invalid ${field}.`);
  }
  return value as Address;
}

function assertOptionalNonce(value: unknown, field: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`CCTP state has an invalid ${field}.`);
  }
  return value;
}

function assertOptionalBlockNumber(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !DECIMAL.test(value)) {
    throw new Error(`CCTP state has an invalid ${field}.`);
  }
  return value;
}

function parseSafetyState(value: unknown, path: string): CctpSafetyState {
  if (typeof value !== "object" || value === null) {
    throw new Error(`CCTP state ${path} has an invalid safety record.`);
  }
  const input = value as Record<string, unknown>;
  const decimalFields = [
    "maxFeeBaseUnits",
    "maxSourceGasWei",
    "initialQuoteMaxFeeBaseUnits",
    "refreshedQuoteMaxFeeBaseUnits",
    "approvalMaxCostWei",
    "burnGasCeiling",
    "approvalGasLimit",
    "burnGasLimit",
    "approvalMaxFeePerGasWei",
    "burnMaxFeePerGasWei",
    "combinedMaxGasWei",
  ] as const;
  const safety: CctpSafetyState = {};
  for (const field of decimalFields) {
    const parsed = assertOptionalBlockNumber(input[field], `safety.${field}`);
    if (parsed !== undefined) safety[field] = parsed;
  }
  for (const field of ["approvalNonce", "burnNonce"] as const) {
    const parsed = assertOptionalNonce(input[field], `safety.${field}`);
    if (parsed !== undefined) safety[field] = parsed;
  }
  return safety;
}

function parseState(value: unknown, path: string): CctpFundingState {
  if (typeof value !== "object" || value === null) {
    throw new Error(`CCTP state ${path} is not an object.`);
  }
  const input = value as Record<string, unknown>;
  if (input.version !== CCTP_STATE_VERSION) {
    throw new Error(`CCTP state ${path} has an unsupported version.`);
  }
  if (typeof input.recipient !== "string" || !SAFE_ADDRESS.test(input.recipient)) {
    throw new Error(`CCTP state ${path} has an invalid recipient.`);
  }
  if (
    typeof input.sourceChainId !== "number" ||
    !Number.isSafeInteger(input.sourceChainId) ||
    input.sourceChainId <= 0 ||
    typeof input.destinationChainId !== "number" ||
    !Number.isSafeInteger(input.destinationChainId) ||
    input.destinationChainId <= 0
  ) {
    throw new Error(`CCTP state ${path} has invalid chain ids.`);
  }
  const phases: readonly CctpRunPhase[] = [
    "prepared",
    "approval_pending",
    "approval_confirmed",
    "approval_failed",
    "quote_expired",
    "safety_failed",
    "burn_failed",
    "burn_pending",
    "source_pending",
    "attestation_pending",
    "forwarding",
    "completed",
    "source_failed",
  ];
  if (typeof input.phase !== "string" || !phases.includes(input.phase as CctpRunPhase)) {
    throw new Error(`CCTP state ${path} has an invalid phase.`);
  }
  if (
    typeof input.pollCount !== "number" ||
    !Number.isSafeInteger(input.pollCount) ||
    input.pollCount < 0 ||
    typeof input.updatedAt !== "number" ||
    !Number.isFinite(input.updatedAt)
  ) {
    throw new Error(`CCTP state ${path} has invalid progress metadata.`);
  }
  return {
    version: 1,
    recipient: input.recipient as Address,
    sender: assertOptionalAddress(input.sender, "sender"),
    sourceChainId: input.sourceChainId,
    destinationChainId: input.destinationChainId,
    amountBaseUnits: assertDecimal(input.amountBaseUnits, "amountBaseUnits"),
    maxFeeBaseUnits: assertDecimal(input.maxFeeBaseUnits, "maxFeeBaseUnits"),
    minimumReceivedBaseUnits: assertDecimal(
      input.minimumReceivedBaseUnits,
      "minimumReceivedBaseUnits",
    ),
    quoteExpiresAt:
      typeof input.quoteExpiresAt === "number" && Number.isFinite(input.quoteExpiresAt)
        ? input.quoteExpiresAt
        : (() => {
            throw new Error(`CCTP state ${path} has an invalid quoteExpiresAt.`);
          })(),
    phase: input.phase as CctpRunPhase,
    approvalTxHash: assertOptionalHash(input.approvalTxHash, "approvalTxHash"),
    burnTxHash: assertOptionalHash(input.burnTxHash, "burnTxHash"),
    mintTxHash: assertOptionalHash(input.mintTxHash, "mintTxHash"),
    sourceNonce: assertOptionalNonce(input.sourceNonce, "sourceNonce"),
    sourceBlockNumber: assertOptionalBlockNumber(input.sourceBlockNumber, "sourceBlockNumber"),
    sourceProofVerified:
      input.sourceProofVerified === undefined
        ? undefined
        : typeof input.sourceProofVerified === "boolean"
          ? input.sourceProofVerified
          : (() => {
              throw new Error(`CCTP state ${path} has an invalid sourceProofVerified.`);
            })(),
    sourceError:
      input.sourceError === undefined
        ? undefined
        : typeof input.sourceError === "string"
          ? input.sourceError
          : (() => {
              throw new Error(`CCTP state ${path} has an invalid sourceError.`);
            })(),
    lastError:
      input.lastError === undefined
        ? undefined
        : typeof input.lastError === "string"
          ? input.lastError
          : (() => {
              throw new Error(`CCTP state ${path} has an invalid lastError.`);
            })(),
    lastStage:
      input.lastStage === undefined
        ? undefined
        : phases.includes(input.lastStage as CctpRunPhase)
          ? (input.lastStage as CctpRunPhase)
          : (() => {
              throw new Error(`CCTP state ${path} has an invalid lastStage.`);
            })(),
    lastCheckedAt:
      input.lastCheckedAt === undefined
        ? undefined
        : typeof input.lastCheckedAt === "number" && Number.isFinite(input.lastCheckedAt)
          ? input.lastCheckedAt
          : (() => {
              throw new Error(`CCTP state ${path} has an invalid lastCheckedAt.`);
            })(),
    pollCount: input.pollCount,
    safety: input.safety === undefined ? undefined : parseSafetyState(input.safety, path),
    updatedAt: input.updatedAt,
  };
}

export function readCctpState(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
): CctpFundingState | undefined {
  const path = cctpStatePath(identity, directory);
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Cannot read CCTP state ${path}: ${error instanceof Error ? error.message : "invalid JSON"}.`,
    );
  }
  return parseState(parsed, path);
}

export function writeCctpState(state: CctpFundingState, directory = CCTP_STATE_DIR): string {
  const identity = { recipient: state.recipient, sourceChainId: state.sourceChainId };
  const path = cctpStatePath(identity, directory);
  ensureDirectory(directory);
  // Validate before replacing a known-good record.
  parseState(state, path);
  atomicWrite(path, `${JSON.stringify({ ...state, updatedAt: Date.now() }, null, 2)}\n`);
  return path;
}

export function updateCctpState(
  identity: CctpStateIdentity,
  update: Partial<Omit<CctpFundingState, "version" | "recipient" | "sourceChainId">>,
  directory = CCTP_STATE_DIR,
): CctpFundingState {
  const current = readCctpState(identity, directory);
  if (!current) {
    throw new Error(
      `No CCTP state exists for ${identity.recipient} on source ${identity.sourceChainId}.`,
    );
  }
  const next = { ...current, ...update, updatedAt: Date.now() };
  writeCctpState(next, directory);
  return next;
}

/**
 * Create the marker before any source-chain broadcast.  A pre-existing marker
 * is never stale-cleaned: the operator must inspect the referenced hash and
 * resolve it with status/watch before trying another start.
 */
export function acquireCctpLock(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
  intent?: CctpBurnIntent,
): CctpStateLock {
  ensureDirectory(directory);
  const markerPath = cctpPendingPath(identity, directory);
  let fd: number;
  try {
    fd = openSync(markerPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(
        `An unresolved CCTP run already exists for ${identity.recipient} on source ${identity.sourceChainId}; inspect it with status/watch and never rebroadcast automatically.`,
      );
    }
    throw error;
  }
  try {
    const marker = JSON.stringify({
      version: CCTP_STATE_VERSION,
      recipient: identity.recipient,
      sourceChainId: identity.sourceChainId,
      createdAt: Date.now(),
      ...(intent ? { intent: checkedIntent(intent, identity) } : {}),
    });
    writeFileSync(fd, `${marker}\n`, { encoding: "utf8" });
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    try {
      unlinkSync(markerPath);
    } catch {
      // The original error is more useful to the caller.
    }
    throw error;
  }
  closeSync(fd);
  chmodSync(markerPath, 0o600);
  let released = false;
  return {
    markerPath,
    release(): void {
      if (released) return;
      released = true;
      try {
        unlinkSync(markerPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}

function checkedIntent(intent: CctpBurnIntent, identity: CctpStateIdentity): CctpBurnIntent {
  if (!SAFE_ADDRESS.test(intent.sender) || !SAFE_ADDRESS.test(intent.recipient)) {
    throw new Error("CCTP pending marker has an invalid sender or recipient.");
  }
  if (intent.recipient.toLowerCase() !== identity.recipient.toLowerCase()) {
    throw new Error("CCTP pending marker recipient does not match its state identity.");
  }
  return {
    sender: intent.sender,
    recipient: intent.recipient,
    amountBaseUnits: assertDecimal(intent.amountBaseUnits, "pending amountBaseUnits"),
    maxFeeBaseUnits: assertDecimal(intent.maxFeeBaseUnits, "pending maxFeeBaseUnits"),
    sourceNonce: assertOptionalNonce(intent.sourceNonce, "pending sourceNonce"),
    sourceBlockNumber: assertOptionalBlockNumber(
      intent.sourceBlockNumber,
      "pending sourceBlockNumber",
    ),
  };
}

function parsePendingMarker(value: unknown, path: string): CctpPendingMarker {
  if (typeof value !== "object" || value === null) {
    throw new Error(`CCTP pending marker ${path} is not an object.`);
  }
  const input = value as Record<string, unknown>;
  if (input.version !== CCTP_STATE_VERSION) {
    throw new Error(`CCTP pending marker ${path} has an unsupported version.`);
  }
  if (
    typeof input.recipient !== "string" ||
    !SAFE_ADDRESS.test(input.recipient) ||
    typeof input.sourceChainId !== "number" ||
    !Number.isSafeInteger(input.sourceChainId) ||
    input.sourceChainId <= 0 ||
    typeof input.createdAt !== "number" ||
    !Number.isFinite(input.createdAt)
  ) {
    throw new Error(`CCTP pending marker ${path} has invalid identity metadata.`);
  }
  const marker: CctpPendingMarker = {
    version: 1,
    recipient: input.recipient as Address,
    sourceChainId: input.sourceChainId,
    createdAt: input.createdAt,
  };
  if (input.intent !== undefined) {
    if (typeof input.intent !== "object" || input.intent === null) {
      throw new Error(`CCTP pending marker ${path} has an invalid intent.`);
    }
    const intent = input.intent as Record<string, unknown>;
    marker.intent = checkedIntent(
      {
        sender: intent.sender as Address,
        recipient: intent.recipient as Address,
        amountBaseUnits: intent.amountBaseUnits as string,
        maxFeeBaseUnits: intent.maxFeeBaseUnits as string,
        sourceNonce: intent.sourceNonce as number | undefined,
        sourceBlockNumber: intent.sourceBlockNumber as string | undefined,
      },
      { recipient: marker.recipient, sourceChainId: marker.sourceChainId },
    );
  }
  return marker;
}

export function readCctpPendingMarker(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
): CctpPendingMarker | undefined {
  const path = cctpPendingPath(identity, directory);
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Cannot read CCTP pending marker ${path}: ${error instanceof Error ? error.message : "invalid JSON"}.`,
    );
  }
  const marker = parsePendingMarker(parsed, path);
  if (
    marker.recipient.toLowerCase() !== identity.recipient.toLowerCase() ||
    marker.sourceChainId !== identity.sourceChainId
  ) {
    throw new Error(`CCTP pending marker ${path} does not match its filename identity.`);
  }
  return marker;
}

/**
 * Add the prepared source nonce/block anchor exactly once. Existing intent
 * fields are immutable: a process can enrich its marker, never repurpose it.
 */
export function bindCctpPendingMarker(
  identity: CctpStateIdentity,
  intent: CctpBurnIntent,
  directory = CCTP_STATE_DIR,
): CctpPendingMarker {
  const path = cctpPendingPath(identity, directory);
  const current = readCctpPendingMarker(identity, directory);
  if (!current) throw new Error("Cannot bind CCTP pending marker: marker is missing.");
  if (!current.intent) {
    throw new Error(
      "Cannot bind legacy CCTP pending marker without durable sender/quote identity; refusing to adopt it.",
    );
  }
  const next = checkedIntent(intent, identity);
  const existing = current.intent;
  for (const field of ["sender", "recipient", "amountBaseUnits", "maxFeeBaseUnits"] as const) {
    if (existing[field].toLowerCase() !== next[field].toLowerCase()) {
      throw new Error(`CCTP pending marker ${field} does not match the prepared intent.`);
    }
  }
  if (existing.sourceNonce !== undefined && existing.sourceNonce !== next.sourceNonce) {
    throw new Error("CCTP pending marker source nonce is already bound to another value.");
  }
  if (
    existing.sourceBlockNumber !== undefined &&
    existing.sourceBlockNumber !== next.sourceBlockNumber
  ) {
    throw new Error("CCTP pending marker source block anchor is already bound to another value.");
  }
  const merged: CctpPendingMarker = {
    ...current,
    intent: {
      ...existing,
      sourceNonce: next.sourceNonce,
      sourceBlockNumber: next.sourceBlockNumber,
    },
  };
  atomicWrite(path, `${JSON.stringify(merged, null, 2)}\n`);
  return merged;
}

/**
 * A fresh fee quote may change the burn's max fee after approval. Permit that
 * exact pre-burn update only while the marker has no bound source nonce. Once a
 * nonce/block anchor exists, the burn intent is immutable.
 */
export function refreshCctpPendingMarkerQuote(
  identity: CctpStateIdentity,
  maxFeeBaseUnits: string,
  directory = CCTP_STATE_DIR,
): CctpPendingMarker {
  const path = cctpPendingPath(identity, directory);
  const current = readCctpPendingMarker(identity, directory);
  if (!current?.intent) {
    throw new Error("Cannot refresh CCTP pending marker without a durable quote intent.");
  }
  if (current.intent.sourceNonce !== undefined || current.intent.sourceBlockNumber !== undefined) {
    throw new Error("Cannot refresh a CCTP quote after the source nonce has been bound.");
  }
  if (!DECIMAL.test(maxFeeBaseUnits)) {
    throw new Error("CCTP refreshed max fee must be a canonical unsigned decimal.");
  }
  const next: CctpPendingMarker = {
    ...current,
    intent: { ...current.intent, maxFeeBaseUnits },
  };
  atomicWrite(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

export function hasCctpPendingMarker(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
): boolean {
  return existsSync(cctpPendingPath(identity, directory));
}

export function archiveCctpState(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
): string | undefined {
  const path = cctpStatePath(identity, directory);
  if (!existsSync(path)) return undefined;
  const base = `${path}.${Date.now()}`;
  let archive = `${base}.json`;
  let suffix = 1;
  while (existsSync(archive)) {
    archive = `${base}.${suffix}.json`;
    suffix += 1;
  }
  renameSync(path, archive);
  chmodSync(archive, 0o600);
  return archive;
}

export function clearCctpPendingMarker(
  identity: CctpStateIdentity,
  directory = CCTP_STATE_DIR,
): void {
  const path = cctpPendingPath(identity, directory);
  try {
    unlinkSync(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export function isCctpTerminalPhase(phase: CctpRunPhase): boolean {
  return phase === "completed" || phase === "source_failed" || phase === "burn_failed";
}

export function isCctpUnresolvedPhase(phase: CctpRunPhase): boolean {
  return !isCctpTerminalPhase(phase);
}
