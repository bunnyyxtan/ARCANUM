import type { Address, Hash, TransactionReceipt, WaitForTransactionReceiptParameters } from "viem";

const PREFIX = "arcanum:transaction-recovery:v1:";
export const TRANSACTION_RECOVERY_EVENT = "arcanum:transaction-recovery";
export type RecoveryStatus = "unknown" | "success" | "reverted" | "replaced" | "cancelled";
export type PendingTransaction = {
  chainId: number;
  account: Address;
  action: string;
  label: string;
  hash?: Hash;
  replacementHash?: Hash;
  replacementReason?: "cancelled" | "replaced";
  status: RecoveryStatus;
  createdAt: number;
  storageError?: string;
};
export type RecoveryStorage = Pick<
  Storage,
  "length" | "key" | "getItem" | "setItem" | "removeItem"
>;
export type RecoveryClient = {
  waitForTransactionReceipt: (
    args: WaitForTransactionReceiptParameters,
  ) => Promise<TransactionReceipt>;
  getTransactionReceipt: (args: { hash: Hash }) => Promise<TransactionReceipt>;
};

// Retain a submitted hash even if storage becomes unavailable *after* the probe.
// This is deliberately not represented as durable recovery.
const emergency = new Map<string, PendingTransaction>();
const memory = new Map<string, PendingTransaction>();
const hashPattern = /^0x[0-9a-fA-F]{64}$/;
const addressPattern = /^0x[0-9a-fA-F]{40}$/;
const statuses: RecoveryStatus[] = ["unknown", "success", "reverted", "replaced", "cancelled"];

export function recoveryKey(scope: Pick<PendingTransaction, "chainId" | "account" | "action">) {
  return `${PREFIX}${scope.chainId}:${scope.account.toLowerCase()}:${scope.action.toLowerCase()}`;
}

export async function withRecoveryLock<T>(
  locks: Pick<LockManager, "request"> | undefined,
  scope: Pick<PendingTransaction, "chainId" | "account" | "action">,
  work: () => Promise<T>,
): Promise<T> {
  if (!locks)
    throw new Error(
      "This browser cannot safely lock transaction recovery. Use a browser with Web Locks support.",
    );
  return locks.request(recoveryKey(scope), { ifAvailable: true }, async (lock) => {
    if (!lock)
      throw new Error(
        "This action is already being submitted or checked in another view. Wait for that check; do not resubmit.",
      );
    return work();
  });
}

// Opposing writes share a lock: rejecting is not safe while approval is unknown.
// Do not include mutable values (caps, policy, deployment label) in the identity.
export function recoveryAction(
  address: string,
  functionName: string,
  args: readonly unknown[] = [],
) {
  const group = ["approve", "reject", "cancel", "cancelEscalation", "sweepExpired"].includes(
    functionName,
  )
    ? "escalation"
    : ["addVendor", "blockVendor", "removeVendor"].includes(functionName)
      ? "vendor"
      : ["addSigner", "removeSigner"].includes(functionName)
        ? "signer"
        : functionName;
  const subject = ["escalation", "vendor", "signer"].includes(group) ? String(args[0]) : "";
  // Cancellation routes through the governed wallet, while voting routes through
  // the manager. Both must lock the same immutable escalation request id.
  if (group === "escalation") return `${group}:${subject}`.toLowerCase();
  return `${address}:${group}:${subject}`.toLowerCase();
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(TRANSACTION_RECOVERY_EVENT));
}

function parse(raw: string): PendingTransaction {
  const value = JSON.parse(raw) as PendingTransaction;
  if (
    !value ||
    !Number.isSafeInteger(value.chainId) ||
    value.chainId <= 0 ||
    !addressPattern.test(value.account) ||
    typeof value.action !== "string" ||
    typeof value.label !== "string" ||
    !Number.isFinite(value.createdAt) ||
    !statuses.includes(value.status) ||
    (value.hash !== undefined && !hashPattern.test(value.hash)) ||
    (value.replacementHash !== undefined && !hashPattern.test(value.replacementHash)) ||
    (value.replacementReason !== undefined &&
      !["cancelled", "replaced"].includes(value.replacementReason))
  )
    throw new Error(
      "Transaction recovery data is invalid. Do not resubmit; inspect wallet activity.",
    );
  return value;
}

export function listRecovery(storage: RecoveryStorage, chainId: number, account: string) {
  const records = new Map<string, PendingTransaction>();
  const accountPrefix = `${PREFIX}${chainId}:${account.toLowerCase()}:`;
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index);
    if (!key?.startsWith(accountPrefix)) continue;
    const raw = storage.getItem(key);
    if (raw) {
      const entry = parse(raw);
      if (recoveryKey(entry) !== key) throw new Error("Transaction recovery scope is invalid.");
      records.set(key, entry);
    }
  }
  for (const [key, entry] of emergency) {
    if (key.startsWith(accountPrefix)) records.set(key, entry);
  }
  return [...records.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function emergencyRecovery(chainId: number, account: string) {
  return [...memory.values()].filter(
    (entry) => entry.chainId === chainId && entry.account.toLowerCase() === account.toLowerCase(),
  );
}

function save(storage: RecoveryStorage, entry: PendingTransaction, strict = false) {
  const key = recoveryKey(entry);
  memory.set(key, entry);
  try {
    storage.setItem(key, JSON.stringify(entry));
    if (storage.getItem(key) !== JSON.stringify(entry))
      throw new Error("Storage verification failed.");
    emergency.delete(key);
  } catch {
    if (strict) {
      memory.delete(key);
      throw new Error(
        "Durable transaction recovery storage is unavailable. No transaction was sent.",
      );
    }
    const retained = {
      ...entry,
      storageError:
        "Recovery could not be saved. Copy this hash now; do not close or reload this page.",
    };
    emergency.set(key, retained);
    memory.set(key, retained);
  }
  notify();
}

export function recoveryPreflight(storage: RecoveryStorage, scope: PendingTransaction) {
  const existing = listRecovery(storage, scope.chainId, scope.account).find(
    (entry) => recoveryKey(entry) === recoveryKey(scope) && entry.status === "unknown",
  );
  if (existing) {
    throw new Error(
      `An earlier ${existing.label} has an unknown outcome${existing.hash ? `: ${existing.hash}` : ""}. Use Check status; do not submit again.`,
    );
  }
  // This reservation is also the storage probe and survives reload during the wallet prompt.
  save(storage, scope, true);
}

function saveOutcome(
  storage: RecoveryStorage,
  original: PendingTransaction,
  outcome: PendingTransaction,
) {
  let current: PendingTransaction | undefined;
  try {
    current = listRecovery(storage, original.chainId, original.account).find(
      (entry) => recoveryKey(entry) === recoveryKey(original),
    );
  } catch {
    current = memory.get(recoveryKey(original));
  }
  // A stale check/dismiss must never overwrite a newer pending submission.
  if (current?.hash !== original.hash || current?.createdAt !== original.createdAt) return;
  save(storage, outcome);
}

function explicitlyRejected(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && typeof current === "object" && depth < 8; depth++) {
    if ("code" in current && current.code === 4001) return true;
    current = "cause" in current ? current.cause : null;
  }
  return false;
}

export async function submitRecoverable(
  storage: RecoveryStorage,
  scope: Omit<PendingTransaction, "createdAt" | "status" | "hash">,
  send: () => Promise<Hash>,
): Promise<Hash> {
  const entry: PendingTransaction = { ...scope, createdAt: Date.now(), status: "unknown" };
  recoveryPreflight(storage, entry);
  let hash: Hash;
  try {
    hash = await send();
  } catch (error) {
    // RPC/send errors can occur after broadcast. Only explicit user rejection
    // proves this reservation did not submit a transaction.
    if (explicitlyRejected(error)) {
      storage.removeItem(recoveryKey(entry));
      memory.delete(recoveryKey(entry));
      notify();
      throw error;
    }
    throw new Error(
      "The wallet submission outcome is unknown. Do not resubmit. Inspect wallet activity; the recovery reservation has been retained.",
      { cause: error },
    );
  }
  save(storage, { ...entry, hash });
  return hash;
}

export async function waitForRecovery(
  storage: RecoveryStorage,
  client: RecoveryClient,
  entry: PendingTransaction,
  timeout = 120_000,
) {
  if (!entry.hash)
    throw new Error(
      "No hash was returned. Inspect the wallet's activity before any further submission.",
    );
  let replacement: { hash: Hash; cancelled: boolean } | undefined;
  let receipt: TransactionReceipt;
  try {
    receipt = await client.waitForTransactionReceipt({
      hash: entry.hash,
      confirmations: 1,
      timeout,
      onReplaced: (event) => {
        replacement = { hash: event.transaction.hash, cancelled: event.reason === "cancelled" };
        // Keep replacement evidence durable even if its receipt wait times out.
        saveOutcome(storage, entry, {
          ...entry,
          replacementHash: replacement.hash,
          replacementReason: replacement.cancelled ? "cancelled" : "replaced",
        });
      },
    });
  } catch (cause) {
    throw new Error(
      `Transaction outcome is unknown: ${entry.hash}. Use Check status to check the original transaction; do not resubmit.`,
      { cause },
    );
  }
  const expectedHash = replacement?.hash ?? entry.hash;
  if (receipt.transactionHash.toLowerCase() !== expectedHash.toLowerCase()) {
    throw new Error(
      `RPC returned a different transaction receipt. Outcome remains unknown: ${entry.hash}. Do not resubmit.`,
    );
  }
  if (replacement) {
    const status = replacement?.cancelled ? "cancelled" : "replaced";
    saveOutcome(storage, entry, { ...entry, replacementHash: receipt.transactionHash, status });
    throw new Error(
      `Transaction ${status}: ${entry.hash}. Replacement: ${receipt.transactionHash}. The original action's success has not been inferred; review chain activity.`,
    );
  }
  saveOutcome(storage, entry, { ...entry, status: receipt.status });
  return receipt;
}

// Read only. No wallet request, resend, signature, nonce change, or fund-moving retry.
export async function checkRecovery(
  storage: RecoveryStorage,
  client: RecoveryClient,
  entry: PendingTransaction,
) {
  if (!entry.hash)
    throw new Error(
      "No transaction hash was returned. Inspect wallet activity. This action remains blocked.",
    );
  let receipt: TransactionReceipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: entry.hash });
  } catch (cause) {
    if (entry.replacementHash) {
      try {
        const replacement = await client.getTransactionReceipt({ hash: entry.replacementHash });
        if (replacement.transactionHash.toLowerCase() === entry.replacementHash.toLowerCase()) {
          const resolved = { ...entry, status: entry.replacementReason ?? ("replaced" as const) };
          saveOutcome(storage, entry, resolved);
          return resolved;
        }
      } catch {
        // Neither hash has a confirmed receipt: retain the pending record.
      }
    }
    throw new Error(
      `Still unknown: ${entry.hash}. The RPC may be offline or the transaction may be pending. Do not resubmit.`,
      { cause },
    );
  }
  if (receipt.transactionHash.toLowerCase() !== entry.hash.toLowerCase()) {
    throw new Error("RPC returned a different transaction. Recovery remains unresolved.");
  }
  const resolved = { ...entry, status: receipt.status };
  saveOutcome(storage, entry, resolved);
  return resolved;
}

export function dismissRecovery(storage: RecoveryStorage, entry: PendingTransaction) {
  if (entry.status === "unknown") throw new Error("Unresolved transactions cannot be dismissed.");
  const current = listRecovery(storage, entry.chainId, entry.account).find(
    (item) => recoveryKey(item) === recoveryKey(entry),
  );
  if (
    !current ||
    current.status === "unknown" ||
    current.hash !== entry.hash ||
    current.createdAt !== entry.createdAt
  )
    throw new Error("Recovery record changed. Check its current status.");
  storage.removeItem(recoveryKey(entry));
  emergency.delete(recoveryKey(entry));
  memory.delete(recoveryKey(entry));
  notify();
}
