import { createHash, randomUUID } from "node:crypto";
import {
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
import { dirname, join } from "node:path";

import type { Address, Hash } from "viem";
import { z } from "zod";

import { TransactionRecoveryError, TransferRevertedError } from "../../packages/sdk/src/errors";
import type {
  ExecuteUSDCInput,
  ExecuteUSDCOptions,
  ExecuteUSDCResult,
} from "../../packages/sdk/src/types";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const hash = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const referenceSchema = z.string().trim().min(1).max(160);
const journalSchema = z
  .object({
    version: z.literal(1),
    chainId: z.number().int().positive(),
    walletAddress: address,
    reference: referenceSchema,
    receiptId: z.string().uuid(),
    phase: z.enum(["prepared", "submitted", "resolved", "reverted", "not_submitted"]),
    txHash: hash.optional(),
    input: z
      .object({
        to: address,
        amount: z.string().regex(/^[1-9][0-9]*$/),
        reason: z.string(),
        metadata: z.record(z.union([z.string(), z.number().finite(), z.boolean()])).optional(),
      })
      .strict(),
    outcome: z
      .object({
        verdict: z.enum(["ALLOW", "ESCALATE", "DENY", "FREEZE"]),
        reason: z.string().optional(),
        escalationId: hash.optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ReceiptExecutionJournal = z.infer<typeof journalSchema>;
export type ReceiptExecutionIdentity = Readonly<{
  chainId: number;
  walletAddress: Address;
  reference: string;
}>;
type ExecutionClient = {
  executeUSDC(input: ExecuteUSDCInput, options?: ExecuteUSDCOptions): Promise<ExecuteUSDCResult>;
};
type RecoveryClient = {
  reconcileUSDC(txHash: Hash, input: ExecuteUSDCInput): Promise<ExecuteUSDCResult>;
};

function key(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function paths(identity: ReceiptExecutionIdentity, directory: string) {
  referenceSchema.parse(identity.reference);
  address.parse(identity.walletAddress);
  z.number().int().positive().parse(identity.chainId);
  const base = join(
    directory,
    `execution-${identity.chainId}-${identity.walletAddress.toLowerCase()}`,
  );
  return {
    journal: `${base}-${key(identity.reference)}.json`,
    pending: `${base}.pending`,
    mutex: `${base}.lock`,
  };
}

function syncDirectory(directory: string) {
  const fd = openSync(directory, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

/** File fsync -> same-directory atomic rename -> directory fsync, with private permissions. */
function atomicWrite(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temporary, "wx", 0o600);
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, path);
  syncDirectory(dirname(path));
}

/** Short, synchronous filesystem critical section. Never held during network requests. */
function locked<T>(identity: ReceiptExecutionIdentity, directory: string, operation: () => T): T {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  syncDirectory(dirname(directory));
  const { mutex } = paths(identity, directory);
  let fd: number;
  try {
    fd = openSync(mutex, "wx", 0o600);
  } catch (cause) {
    throw new Error(
      `Execution journal is locked (${mutex}). Another process or interrupted filesystem update needs review; do not execute again.`,
      { cause },
    );
  }
  try {
    writeFileSync(fd, "Journal update in progress; never automatically remove a stale lock.\n");
    fsyncSync(fd);
    syncDirectory(directory);
    return operation();
  } finally {
    closeSync(fd);
    unlinkSync(mutex);
    syncDirectory(directory);
  }
}

function assertAvailable(identity: ReceiptExecutionIdentity, directory: string) {
  const path = paths(identity, directory);
  if (existsSync(path.pending)) {
    throw new Error(
      `This wallet has an unresolved execution (${path.pending}). Recover its original reference/hash; a new reference is not a retry.`,
    );
  }
  if (existsSync(path.journal)) {
    throw new Error(
      `Reference already has an execution journal (${path.journal}). Do not execute it again; use recover --reference with the original reference.`,
    );
  }
}

export function assertReceiptExecutionAvailable(
  identity: ReceiptExecutionIdentity,
  directory: string,
) {
  locked(identity, directory, () => assertAvailable(identity, directory));
}

export function readReceiptExecution(
  identity: ReceiptExecutionIdentity,
  directory: string,
): ReceiptExecutionJournal {
  const journal = journalSchema.parse(
    JSON.parse(readFileSync(paths(identity, directory).journal, "utf8")),
  );
  if (
    journal.chainId !== identity.chainId ||
    journal.walletAddress.toLowerCase() !== identity.walletAddress.toLowerCase() ||
    journal.reference !== identity.reference ||
    (journal.phase !== "prepared" && journal.phase !== "not_submitted" && !journal.txHash) ||
    journal.input.metadata?.reference !== identity.reference ||
    journal.input.metadata?.receiptId !== journal.receiptId
  ) {
    throw new Error(
      "Execution journal identity or phase is inconsistent; operator review required.",
    );
  }
  return journal;
}

function writeJournal(journal: ReceiptExecutionJournal, directory: string) {
  journalSchema.parse(journal);
  atomicWrite(paths(journal as ReceiptExecutionIdentity, directory).journal, journal);
}

function finish(
  journal: ReceiptExecutionJournal,
  phase: "resolved" | "reverted" | "not_submitted",
  result: ExecuteUSDCResult,
  directory: string,
) {
  const identity = journal as ReceiptExecutionIdentity;
  try {
    locked(identity, directory, () => {
      const current = readReceiptExecution(identity, directory);
      if (current.txHash && current.txHash !== result.txHash) {
        throw new Error("Refusing to replace the original journaled transaction hash.");
      }
      writeJournal(
        {
          ...current,
          phase,
          txHash: result.txHash,
          outcome: {
            verdict: result.verdict,
            ...(result.reason ? { reason: result.reason } : {}),
            ...(result.escalationId ? { escalationId: result.escalationId } : {}),
          },
        },
        directory,
      );
      const pending = paths(identity, directory).pending;
      // Another reference may have started since a previous reconciliation completed.
      if (existsSync(pending)) {
        const marker = JSON.parse(readFileSync(pending, "utf8")) as { reference?: unknown };
        if (marker.reference === identity.reference) {
          unlinkSync(pending);
          syncDirectory(directory);
        }
      }
    });
  } catch (cause) {
    const txHash = journal.txHash ?? result.txHash;
    if (txHash) {
      throw new TransactionRecoveryError(
        txHash as Hash,
        "CONFIRMATION_UNAVAILABLE",
        "Could not persist the chain outcome. Keep the execution journal and recover this hash.",
        { cause },
      );
    }
    throw cause;
  }
}

/** No reference (even a new one) can bypass a wallet's unresolved submission marker. */
export async function executeReceiptJournaled(
  client: ExecutionClient,
  identity: ReceiptExecutionIdentity,
  receiptId: string,
  input: ExecuteUSDCInput,
  directory: string,
): Promise<ExecuteUSDCResult> {
  if (input.metadata?.reference !== identity.reference || input.metadata?.receiptId !== receiptId) {
    throw new Error("Receipt/reference metadata must match the execution journal.");
  }
  const journal: ReceiptExecutionJournal = {
    version: 1,
    ...identity,
    receiptId,
    phase: "prepared",
    input: { ...input, amount: input.amount.toString() },
  };
  locked(identity, directory, () => {
    assertAvailable(identity, directory);
    writeJournal(journal, directory);
    atomicWrite(paths(identity, directory).pending, { reference: identity.reference });
  });
  try {
    const result = await client.executeUSDC(input, {
      onSubmitted: (submission) => {
        journal.txHash = submission.txHash;
        if (
          submission.walletAddress.toLowerCase() !== identity.walletAddress.toLowerCase() ||
          submission.chainId !== identity.chainId
        ) {
          throw new Error("Submitted transaction identity differs from the journal.");
        }
        locked(identity, directory, () => {
          const current = readReceiptExecution(identity, directory);
          if (current.txHash && current.txHash !== submission.txHash) {
            throw new Error("Refusing to overwrite a submitted hash.");
          }
          writeJournal({ ...journal, phase: "submitted" }, directory);
        });
      },
    });
    if (journal.txHash && !result.txHash) {
      throw new Error("Submitted execution returned an outcome without its hash.");
    }
    finish(journal, result.txHash ? "resolved" : "not_submitted", result, directory);
    return result;
  } catch (error) {
    if (error instanceof TransferRevertedError) {
      finish(journal, "reverted", { verdict: "DENY", txHash: error.txHash }, directory);
    }
    // Other errors retain prepared/submitted state and the wallet-wide blocking marker.
    if (
      !(error instanceof TransactionRecoveryError) &&
      !(error instanceof TransferRevertedError) &&
      journal.txHash
    ) {
      throw new TransactionRecoveryError(
        journal.txHash as Hash,
        "CONFIRMATION_UNAVAILABLE",
        "Execution journal could not record a definitive outcome; recover the same hash.",
        { cause: error },
      );
    }
    throw error;
  }
}

/** The injected interface has no signing/submission method; recovery is chain-read-only. */
export async function recoverReceiptExecution(
  client: RecoveryClient,
  identity: ReceiptExecutionIdentity,
  directory: string,
): Promise<ExecuteUSDCResult> {
  const journal = readReceiptExecution(identity, directory);
  if (!journal.txHash) {
    throw new Error(
      "No submitted hash was durably recorded. Investigate signer/nonce/provider history; do not execute again or delete the pending marker.",
    );
  }
  const input = {
    ...journal.input,
    to: journal.input.to as Address,
    amount: BigInt(journal.input.amount),
  };
  try {
    const result = await client.reconcileUSDC(journal.txHash as Hash, input);
    finish(journal, "resolved", result, directory);
    return result;
  } catch (error) {
    if (error instanceof TransferRevertedError) {
      finish(journal, "reverted", { verdict: "DENY", txHash: error.txHash }, directory);
    }
    throw error;
  }
}

export function requestedReceiptReference(
  args: readonly string[],
  required: boolean,
): string | undefined {
  const index = args.indexOf("--reference");
  if (index < 0) {
    if (required) {
      throw new Error(
        "Provide --reference <stable-business-reference>; never change it to retry a payment.",
      );
    }
    return undefined;
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--") || args.lastIndexOf("--reference") !== index) {
    throw new Error("Provide exactly one --reference <stable-business-reference>.");
  }
  return referenceSchema.parse(value);
}
