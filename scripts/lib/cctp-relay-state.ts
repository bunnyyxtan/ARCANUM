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

import { CCTP_STATE_DIR, type CctpStateIdentity } from "./cctp-state";

export const CCTP_RELAY_JOURNAL_VERSION = 1;

export type CctpRelayJournalPhase =
  | "attempt_marked"
  | "signed"
  | "broadcast"
  | "ambiguous"
  | "completed";

export interface CctpRelayJournal {
  version: 1;
  burnTxHash: Hash;
  recipient: Address;
  sender: Address;
  amountBaseUnits: string;
  maxFeeBaseUnits: string;
  sourceNonce: number;
  sourceBlockNumber: string;
  phase: CctpRelayJournalPhase;
  mintTxHash?: Hash;
  createdAt: number;
  attemptMarkedAt: number;
  updatedAt: number;
  lastError?: string;
}

const SAFE_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SAFE_HASH = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL = /^(0|[1-9][0-9]*)$/;

function stateStem(identity: CctpStateIdentity): string {
  const recipient = identity.recipient.toLowerCase();
  if (!SAFE_ADDRESS.test(recipient)) throw new Error("Relay recipient is not a 20-byte address.");
  if (!Number.isSafeInteger(identity.sourceChainId) || identity.sourceChainId <= 0) {
    throw new Error("Relay source chain id is invalid.");
  }
  return `${recipient.slice(2)}-${identity.sourceChainId}`;
}

export function cctpRelayJournalPath(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
  directory = CCTP_STATE_DIR,
): string {
  if (!SAFE_HASH.test(burnTxHash)) throw new Error("Relay burn hash is invalid.");
  return join(directory, `${stateStem(identity)}-${burnTxHash.slice(2).toLowerCase()}.relay.json`);
}

function ensureDirectory(directory: string): void {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
}

function atomicWrite(path: string, value: CctpRelayJournal): void {
  const temporary = `${path}.${process.pid}.${Date.now()}.tmp`;
  try {
    const fd = openSync(temporary, "w", 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8" });
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    chmodSync(temporary, 0o600);
    renameSync(temporary, path);
    chmodSync(path, 0o600);
  } catch (error) {
    try {
      if (existsSync(temporary)) unlinkSync(temporary);
    } catch {
      // Preserve the write failure and leave the prior journal intact.
    }
    throw error;
  }
}

function parseJournal(value: unknown, path: string): CctpRelayJournal {
  if (typeof value !== "object" || value === null) {
    throw new Error(`Relay journal ${path} is not an object.`);
  }
  const input = value as Record<string, unknown>;
  const phases: readonly CctpRelayJournalPhase[] = [
    "attempt_marked",
    "signed",
    "broadcast",
    "ambiguous",
    "completed",
  ];
  if (
    input.version !== CCTP_RELAY_JOURNAL_VERSION ||
    typeof input.burnTxHash !== "string" ||
    !SAFE_HASH.test(input.burnTxHash) ||
    typeof input.recipient !== "string" ||
    !SAFE_ADDRESS.test(input.recipient) ||
    typeof input.sender !== "string" ||
    !SAFE_ADDRESS.test(input.sender) ||
    typeof input.amountBaseUnits !== "string" ||
    !DECIMAL.test(input.amountBaseUnits) ||
    typeof input.maxFeeBaseUnits !== "string" ||
    !DECIMAL.test(input.maxFeeBaseUnits) ||
    typeof input.sourceNonce !== "number" ||
    !Number.isSafeInteger(input.sourceNonce) ||
    input.sourceNonce < 0 ||
    typeof input.sourceBlockNumber !== "string" ||
    !DECIMAL.test(input.sourceBlockNumber) ||
    typeof input.phase !== "string" ||
    !phases.includes(input.phase as CctpRelayJournalPhase) ||
    typeof input.createdAt !== "number" ||
    !Number.isFinite(input.createdAt) ||
    typeof input.attemptMarkedAt !== "number" ||
    !Number.isFinite(input.attemptMarkedAt) ||
    typeof input.updatedAt !== "number" ||
    !Number.isFinite(input.updatedAt)
  ) {
    throw new Error(`Relay journal ${path} has invalid or incomplete identity metadata.`);
  }
  if (
    input.mintTxHash !== undefined &&
    (typeof input.mintTxHash !== "string" || !SAFE_HASH.test(input.mintTxHash))
  ) {
    throw new Error(`Relay journal ${path} has an invalid mintTxHash.`);
  }
  if (input.lastError !== undefined && typeof input.lastError !== "string") {
    throw new Error(`Relay journal ${path} has an invalid lastError.`);
  }
  return {
    version: 1,
    burnTxHash: input.burnTxHash as Hash,
    recipient: input.recipient as Address,
    sender: input.sender as Address,
    amountBaseUnits: input.amountBaseUnits,
    maxFeeBaseUnits: input.maxFeeBaseUnits,
    sourceNonce: input.sourceNonce,
    sourceBlockNumber: input.sourceBlockNumber,
    phase: input.phase as CctpRelayJournalPhase,
    mintTxHash: input.mintTxHash as Hash | undefined,
    createdAt: input.createdAt,
    attemptMarkedAt: input.attemptMarkedAt,
    updatedAt: input.updatedAt,
    lastError: input.lastError as string | undefined,
  };
}

export function readCctpRelayJournal(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
  directory = CCTP_STATE_DIR,
): CctpRelayJournal | undefined {
  const path = cctpRelayJournalPath(identity, burnTxHash, directory);
  if (!existsSync(path)) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Cannot read relay journal ${path}: ${error instanceof Error ? error.message : "invalid JSON"}.`,
    );
  }
  const journal = parseJournal(parsed, path);
  if (
    journal.burnTxHash.toLowerCase() !== burnTxHash.toLowerCase() ||
    journal.recipient.toLowerCase() !== identity.recipient.toLowerCase()
  ) {
    throw new Error(`Relay journal ${path} is bound to a different transfer.`);
  }
  return journal;
}

/**
 * Exclusive create is the relay's per-burn attempt marker. A journal without
 * mintTxHash is intentionally not recoverable automatically.
 */
export function createCctpRelayJournal(
  identity: CctpStateIdentity,
  intent: Omit<
    CctpRelayJournal,
    "version" | "phase" | "createdAt" | "attemptMarkedAt" | "updatedAt"
  >,
  directory = CCTP_STATE_DIR,
): CctpRelayJournal {
  ensureDirectory(directory);
  const path = cctpRelayJournalPath(identity, intent.burnTxHash, directory);
  const now = Date.now();
  const journal: CctpRelayJournal = {
    ...intent,
    version: 1,
    phase: "attempt_marked",
    createdAt: now,
    attemptMarkedAt: now,
    updatedAt: now,
  };
  let fd: number;
  try {
    fd = openSync(path, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      throw new Error(`Relay journal already exists for ${intent.burnTxHash}.`);
    }
    throw error;
  }
  try {
    writeFileSync(fd, `${JSON.stringify(journal, null, 2)}\n`, { encoding: "utf8" });
    fsyncSync(fd);
  } catch (error) {
    closeSync(fd);
    try {
      unlinkSync(path);
    } catch {
      // Preserve the original failure.
    }
    throw error;
  }
  closeSync(fd);
  chmodSync(path, 0o600);
  return journal;
}

export function updateCctpRelayJournal(
  identity: CctpStateIdentity,
  burnTxHash: Hash,
  update: Partial<Omit<CctpRelayJournal, "version" | "burnTxHash" | "recipient">>,
  directory = CCTP_STATE_DIR,
): CctpRelayJournal {
  const current = readCctpRelayJournal(identity, burnTxHash, directory);
  if (!current) throw new Error(`No relay journal exists for ${burnTxHash}.`);
  const next: CctpRelayJournal = { ...current, ...update, updatedAt: Date.now() };
  const path = cctpRelayJournalPath(identity, burnTxHash, directory);
  atomicWrite(path, next);
  return next;
}
