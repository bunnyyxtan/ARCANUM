"use client";

import { getArcscanTxUrl } from "@/lib/arcscan";
import {
  type PendingTransaction,
  TRANSACTION_RECOVERY_EVENT,
  checkRecovery,
  dismissRecovery,
  emergencyRecovery,
  listRecovery,
  recoveryAction,
  recoveryKey,
  submitRecoverable,
  waitForRecovery,
  withRecoveryLock,
} from "@/lib/transaction-recovery";
import { arcChain } from "@arcanum/shared";
import { useQueryClient } from "@tanstack/react-query";
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Hash } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";

function useRecoveryRecords() {
  const { address, isConnected } = useAccount();
  const [snapshot, setSnapshot] = useState<{
    account?: string;
    records: PendingTransaction[];
    error?: string;
  }>({ records: [] });
  const [online, setOnline] = useState(true);
  const refresh = useCallback(() => {
    setOnline(navigator.onLine);
    if (!address) {
      setSnapshot({ records: [] });
      return;
    }
    try {
      setSnapshot({
        account: address,
        records: listRecovery(window.localStorage, arcChain.id, address),
      });
    } catch (error) {
      setSnapshot({
        account: address,
        records: emergencyRecovery(arcChain.id, address),
        error: error instanceof Error ? error.message : "Recovery storage is unavailable.",
      });
    }
  }, [address]);
  useEffect(() => {
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener(TRANSACTION_RECOVERY_EVENT, refresh);
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener(TRANSACTION_RECOVERY_EVENT, refresh);
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, [refresh]);
  // Never display the previous account's recovery entries during an account switch.
  const matches = snapshot.account?.toLowerCase() === address?.toLowerCase();
  return {
    records: matches ? snapshot.records : [],
    error: matches ? snapshot.error : undefined,
    ready: matches && Boolean(address),
    online,
    isConnected,
  };
}

/** Shared boundary for the existing contract writers; business post-receipt guards stay at call sites. */
export function useRecoverableWrite(target?: string | null, action?: string, subject = "") {
  const write = useWriteContract();
  const { address } = useAccount();
  const client = usePublicClient({ chainId: arcChain.id });
  const queries = useQueryClient();
  const recovery = useRecoveryRecords();
  const actionPrefix = target && action ? recoveryAction(target, action, [subject]) : null;
  const currentScope = useRef(actionPrefix);
  currentScope.current = actionPrefix;
  const active = useRef(false);
  const currentAccount = useRef(address);
  currentAccount.current = address;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const waitForTransactionReceipt = async ({
    hash,
    timeout,
  }: { hash: Hash; confirmations?: number; timeout?: number }) => {
    if (!address || !client)
      throw new Error("Recovery account or RPC is unavailable. Do not resubmit.");
    const storage = window.localStorage;
    const entry = listRecovery(storage, arcChain.id, address).find((item) => item.hash === hash);
    if (!entry) throw new Error(`Recovery entry unavailable for ${hash}. Do not resubmit.`);
    try {
      return await withRecoveryLock(navigator.locks, entry, () =>
        waitForRecovery(storage, client, entry, timeout),
      );
    } finally {
      // Invalidate even on replacement/revert; never infer a business event from
      // a generic receipt (e.g. an escalation vote is not necessarily execution).
      void queries.invalidateQueries().catch(() => undefined);
    }
  };
  const writeContractAsync = (async (
    parameters: Parameters<typeof write.writeContractAsync>[0],
  ) => {
    if (!address || !client)
      throw new Error("Connect wallet and wait for the Arc RPC before submitting.");
    if (!navigator.onLine) throw new Error("Offline. Reconnect before submitting.");
    if (parameters.chainId !== arcChain.id)
      throw new Error("Transaction recovery chain does not match.");
    if (active.current) throw new Error("A wallet submission is already in progress.");
    const scope = {
      chainId: arcChain.id,
      account: address,
      action: recoveryAction(parameters.address, parameters.functionName, parameters.args),
      label: parameters.functionName,
    };
    active.current = true;
    try {
      const storage = window.localStorage;
      return await withRecoveryLock(navigator.locks, scope, async () => {
        if (
          !mounted.current ||
          currentAccount.current !== address ||
          currentScope.current !== actionPrefix
        ) {
          throw new Error(
            "Account, target, or page changed before submission. No transaction was sent.",
          );
        }
        return submitRecoverable(storage, scope, () =>
          write.writeContractAsync({ ...parameters, account: address }),
        );
      });
    } finally {
      active.current = false;
    }
  }) as typeof write.writeContractAsync;
  return {
    ...write,
    writeContractAsync,
    waitForTransactionReceipt,
    recoveryBlocked:
      !recovery.ready ||
      !recovery.online ||
      Boolean(recovery.error) ||
      recovery.records.some(
        (entry) =>
          entry.status === "unknown" && (!actionPrefix || entry.action.startsWith(actionPrefix)),
      ),
  };
}

export function TransactionRecovery() {
  const recovery = useRecoveryRecords();
  const client = usePublicClient({ chainId: arcChain.id });
  const queries = useQueryClient();
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ key: string; text: string } | null>(null);
  const inFlight = useRef(false);
  const check = async (entry: PendingTransaction) => {
    if (!client || !recovery.online || !recovery.isConnected || inFlight.current) return;
    inFlight.current = true;
    setChecking(recoveryKey(entry));
    setMessage(null);
    try {
      const resolved = await withRecoveryLock(navigator.locks, entry, () =>
        checkRecovery(window.localStorage, client, entry),
      );
      setMessage({
        key: recoveryKey(entry),
        text: `Transaction ${resolved.status}. Refreshing dashboard records; application state may still be indexing.`,
      });
      await queries.invalidateQueries();
    } catch (error) {
      setMessage({
        key: recoveryKey(entry),
        text:
          error instanceof Error ? error.message : "Status could not be checked. Do not resubmit.",
      });
    } finally {
      inFlight.current = false;
      setChecking(null);
    }
  };
  return (
    <TransactionRecoveryPanel
      recovery={recovery}
      clientReady={Boolean(client)}
      checking={checking}
      message={message}
      onCheck={check}
      onDismiss={(entry) => {
        void withRecoveryLock(navigator.locks, entry, async () => {
          dismissRecovery(window.localStorage, entry);
        }).catch(() => {
          setMessage({
            key: recoveryKey(entry),
            text: "Could not clear recovery storage, or a check is still running. Keep the transaction hash.",
          });
        });
      }}
    />
  );
}

export function TransactionRecoveryPanel({
  recovery,
  clientReady,
  checking,
  message,
  onCheck,
  onDismiss,
}: {
  recovery: {
    records: PendingTransaction[];
    error?: string;
    online: boolean;
    isConnected: boolean;
  };
  clientReady: boolean;
  checking: string | null;
  message: { key: string; text: string } | null;
  onCheck: (entry: PendingTransaction) => Promise<void>;
  onDismiss: (entry: PendingTransaction) => void;
}) {
  if (!recovery.error && !recovery.records.length && recovery.online) return null;
  return (
    <section
      aria-label="Transaction recovery"
      className="m-4 space-y-3 border border-[var(--wl-amber)] bg-[var(--wl-bg)] p-4 text-sm text-[var(--wl-ink)]"
    >
      <h2 className="font-semibold">Transaction recovery · connected account</h2>
      {recovery.error && (
        <p role="alert">
          Recovery storage unavailable: {recovery.error} Do not submit again until wallet activity
          is verified.
        </p>
      )}
      {!recovery.online && (
        <output className="block">
          Offline. Explorer links remain available; reconnect to check status.
        </output>
      )}
      {recovery.records.map((entry) => (
        <div key={recoveryKey(entry)} className="space-y-2 border-t border-[var(--wl-line)] pt-3">
          <p>
            <strong>{entry.label}</strong> ·{" "}
            {entry.status === "unknown"
              ? "Outcome unknown — do not resubmit"
              : `Transaction ${entry.status}`}
          </p>
          <p className="break-all font-mono text-xs">
            {entry.account} · chain {entry.chainId}
          </p>
          {entry.hash ? (
            <a
              className="block break-all underline"
              href={getArcscanTxUrl(entry.hash) ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              View original transaction: {entry.hash}
            </a>
          ) : (
            <p>No hash returned. Check the wallet's activity; this action remains blocked.</p>
          )}
          {entry.replacementHash && (
            <a
              className="block break-all underline"
              href={getArcscanTxUrl(entry.replacementHash) ?? undefined}
              target="_blank"
              rel="noreferrer"
            >
              View replacement: {entry.replacementHash}
            </a>
          )}
          {entry.storageError && <p role="alert">{entry.storageError}</p>}
          {entry.status !== "unknown" && (
            <p>
              Receipt confirmed. This does not prove the intended business outcome. Dashboard
              records may still be indexing; review current chain state.
            </p>
          )}
          <button
            type="button"
            className="min-h-11 border px-3 disabled:opacity-50"
            disabled={
              !entry.hash ||
              !clientReady ||
              !recovery.online ||
              !recovery.isConnected ||
              checking !== null
            }
            onClick={() => void onCheck(entry)}
          >
            {checking === recoveryKey(entry) ? "Checking…" : "Check status"}
          </button>
          {entry.status !== "unknown" && (
            <button
              type="button"
              className="ml-2 min-h-11 border px-3"
              onClick={() => onDismiss(entry)}
            >
              Dismiss confirmed record
            </button>
          )}
          {message?.key === recoveryKey(entry) && <output className="block">{message.text}</output>}
        </div>
      ))}
    </section>
  );
}
