"use client";

import { IS_ARC_MAINNET } from "@arcanum/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Address, EIP1193Provider, Hash } from "viem";
import { useAccount } from "wagmi";

import { CCTP_ROUTE, type CctpQuote, type CctpStatus, buildCctpTransactions } from "@/lib/cctp";
import {
  assertImportableCctpStatus,
  assertSelectedFundingAccount,
  assertStatusMatchesFundingIntent,
  assertSuccessfulApprovalReceipt,
  assertValidCctpQuote,
  assertValidCctpStatus,
  burnNonceForIntent,
  canUseOriginalQuoteForBurn,
  createFundingWalletClient,
  fundingIntentFromStatus,
  fundingStateForStage,
  isKnownUserRejection,
  parseFundingAmount,
} from "@/lib/cctp-funding-flow";
import {
  type FundingStorage,
  bindPendingFundingIntent,
  cctpFundingLockName,
  cctpFundingPendingKey,
  cctpFundingScope,
  cctpFundingTransferKey,
  fundingSnapshotMatches,
  isStrictTransactionHash,
  linkPendingFundingMarker,
  loadFundingStorage,
  pendingFundingIntent,
  pendingMarkerLinksHash,
  persistFundingTransferIfSnapshotMatches,
  readFundingStorageSnapshot,
  removeFundingStorageIfMatches,
  withFundingLock,
  writePendingFundingMarker,
} from "@/lib/cctp-funding-storage";

export type AgentFundingState =
  | "IDLE"
  | "QUOTING"
  | "QUOTED"
  | "APPROVING"
  | "BURNING"
  | "BURN_SUBMITTED"
  | "POLLING_STATUS"
  | "COMPLETED"
  | "SOURCE_FAILED"
  | "RECOVERY_REQUIRED";

function browserStorage(): FundingStorage {
  try {
    return window.localStorage;
  } catch {
    throw new Error("Browser storage is unavailable. CCTP funding cannot safely continue.");
  }
}

function browserLocks() {
  if (typeof navigator === "undefined") return undefined;
  return navigator.locks;
}

function messageFor(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useAgentFundingController(governedWalletAddress: Address | null) {
  const { address: wagmiAddress, connector, isConnected } = useAccount();
  const [state, setState] = useState<AgentFundingState>("IDLE");
  const [amount, setAmountState] = useState("");
  const [quote, setQuote] = useState<CctpQuote | null>(null);
  const [status, setStatus] = useState<CctpStatus | null>(null);
  const [burnTxHash, setBurnTxHash] = useState<Hash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const quoteRequestRef = useRef(0);
  const scope =
    governedWalletAddress && wagmiAddress
      ? cctpFundingScope(governedWalletAddress, wagmiAddress)
      : null;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const assertCurrentScope = useCallback((expectedScope: string) => {
    if (scopeRef.current !== expectedScope) {
      throw new Error("Connected account or destination changed. The funding flow was stopped.");
    }
  }, []);

  const requestStatus = useCallback(
    async (hash: Hash, recipient: Address, sender: Address, signal?: AbortSignal) => {
      const response = await fetch(
        `/api/cctp/status?burnTxHash=${encodeURIComponent(hash)}&recipient=${encodeURIComponent(recipient)}`,
        { signal },
      );
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const apiError =
          body && typeof body === "object" && "error" in body && typeof body.error === "string"
            ? body.error
            : "Status fetch failed";
        throw new Error(apiError);
      }
      if (!body || typeof body !== "object" || !("transfer" in body)) {
        throw new Error("Malformed CCTP status response.");
      }
      return assertValidCctpStatus(body.transfer, hash, recipient, sender);
    },
    [],
  );

  // A stored burn hash is authoritative recovery data. A pending marker without one
  // intentionally blocks new writes: a wallet may have broadcast while the UI lost its reply.
  useEffect(() => {
    quoteRequestRef.current += 1;
    setState("IDLE");
    setAmountState("");
    setQuote(null);
    setStatus(null);
    setBurnTxHash(null);
    setError(null);
    if (IS_ARC_MAINNET || !governedWalletAddress || !wagmiAddress) return;
    try {
      const saved = loadFundingStorage(browserStorage(), governedWalletAddress, wagmiAddress);
      if (saved.kind === "active") {
        setBurnTxHash(saved.transfer.burnTxHash);
        setState("POLLING_STATUS");
      } else if (saved.kind === "pending") {
        setState("RECOVERY_REQUIRED");
        setError(
          saved.hasIntent
            ? "An unresolved CCTP wallet request was found. Do not start another transfer; import its burn hash after checking your wallet."
            : "A legacy unresolved CCTP wallet request lacks a burn identity. Inspect it manually; it cannot be cleared or replaced here.",
        );
      }
    } catch (caught) {
      setState("RECOVERY_REQUIRED");
      setError(messageFor(caught, "Unable to load CCTP recovery data."));
    }
  }, [governedWalletAddress, wagmiAddress]);

  // Keep separate tabs from presenting stale recovery state for this exact account/recipient.
  useEffect(() => {
    if (IS_ARC_MAINNET || !governedWalletAddress || !wagmiAddress) return;
    const transferKey = cctpFundingTransferKey(governedWalletAddress, wagmiAddress);
    const pendingKey = cctpFundingPendingKey(governedWalletAddress, wagmiAddress);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== transferKey && event.key !== pendingKey) return;
      try {
        const saved = loadFundingStorage(browserStorage(), governedWalletAddress, wagmiAddress);
        if (saved.kind === "active") {
          setBurnTxHash(saved.transfer.burnTxHash);
          setState("POLLING_STATUS");
          setError(null);
        } else if (saved.kind === "pending") {
          setBurnTxHash(null);
          setState("RECOVERY_REQUIRED");
          setError(
            saved.hasIntent
              ? "An unresolved CCTP wallet request was found in another tab."
              : "A legacy unresolved CCTP wallet request requires manual inspection.",
          );
        } else {
          setBurnTxHash(null);
          setStatus(null);
          setState("IDLE");
        }
      } catch (caught) {
        setState("RECOVERY_REQUIRED");
        setError(messageFor(caught, "Unable to read CCTP recovery data."));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [governedWalletAddress, wagmiAddress]);

  const setAmount = useCallback((value: string) => {
    quoteRequestRef.current += 1;
    setAmountState(value);
    setQuote(null);
    setError(null);
    setState((current) => (current === "QUOTED" || current === "QUOTING" ? "IDLE" : current));
  }, []);

  const fetchQuote = useCallback(
    async (value: string) => {
      try {
        parseFundingAmount(value);
      } catch (caught) {
        setError(messageFor(caught, "Enter a valid USDC amount."));
        return;
      }
      if (
        IS_ARC_MAINNET ||
        !governedWalletAddress ||
        !wagmiAddress ||
        !isConnected ||
        state === "RECOVERY_REQUIRED" ||
        (state !== "IDLE" && state !== "QUOTED")
      ) {
        setError(
          IS_ARC_MAINNET
            ? "CCTP funding is available only on Arc Testnet."
            : !isConnected
              ? "Connect the source wallet that will fund this agent."
              : "Resolve the active CCTP transfer before requesting a new quote.",
        );
        return;
      }
      const requestId = quoteRequestRef.current + 1;
      const expectedScope = scope;
      quoteRequestRef.current = requestId;
      setQuote(null);
      setState("QUOTING");
      setError(null);
      try {
        const response = await fetch(`/api/cctp/quote?amount=${encodeURIComponent(value)}`);
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const apiError =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Failed to fetch CCTP quote.";
          throw new Error(apiError);
        }
        if (!body || typeof body !== "object" || !("quote" in body)) {
          throw new Error("Malformed CCTP quote response.");
        }
        const nextQuote = assertValidCctpQuote(body.quote, value);
        if (scopeRef.current !== expectedScope || quoteRequestRef.current !== requestId) return;
        setQuote(nextQuote);
        setState("QUOTED");
      } catch (caught) {
        if (scopeRef.current !== expectedScope || quoteRequestRef.current !== requestId) return;
        setError(messageFor(caught, "Unable to fetch CCTP quote."));
        setState("IDLE");
      }
    },
    [governedWalletAddress, isConnected, scope, state, wagmiAddress],
  );

  const submitFunding = useCallback(async () => {
    try {
      parseFundingAmount(amount);
    } catch (caught) {
      setError(messageFor(caught, "Enter a valid USDC amount."));
      return;
    }
    if (
      submittingRef.current ||
      IS_ARC_MAINNET ||
      !governedWalletAddress ||
      !wagmiAddress ||
      !connector ||
      !quote ||
      state !== "QUOTED"
    ) {
      if (!isConnected) setError("Connect the source wallet that will fund this agent.");
      return;
    }
    const expectedScope = scope;
    if (!expectedScope) return;
    submittingRef.current = true;
    setError(null);
    let pendingMarker: string | null = null;
    let burnWalletRequestStarted = false;
    try {
      await withFundingLock(
        browserLocks(),
        cctpFundingLockName(governedWalletAddress, wagmiAddress),
        async () => {
          assertCurrentScope(expectedScope);
          const storage = browserStorage();
          const saved = loadFundingStorage(storage, governedWalletAddress, wagmiAddress);
          if (saved.kind === "active") {
            throw new Error("An active CCTP transfer is already being tracked for this wallet.");
          }
          if (saved.kind === "pending") {
            throw new Error(
              "An unresolved CCTP wallet request exists. Import its burn hash before continuing.",
            );
          }
          const provider = (await connector.getProvider()) as EIP1193Provider | undefined;
          if (!provider)
            throw new Error("The selected wallet connector did not provide a signing provider.");
          const client = createFundingWalletClient(provider);
          const verifyWallet = async () => {
            assertCurrentScope(expectedScope);
            const accounts = await client.getAddresses();
            assertSelectedFundingAccount(accounts, wagmiAddress);
            const chainId = await client.getChainId();
            return { account: wagmiAddress, chainId };
          };

          const initial = await verifyWallet();
          assertValidCctpQuote(quote, amount);
          // Persist and verify recovery state before any request which can open a wallet UI.
          pendingMarker = writePendingFundingMarker(storage, governedWalletAddress, wagmiAddress);
          if (initial.chainId !== CCTP_ROUTE.sourceChainId) {
            try {
              await client.switchChain({ id: CCTP_ROUTE.sourceChainId });
            } catch (caught) {
              if (
                typeof caught === "object" &&
                caught !== null &&
                "code" in caught &&
                (caught as { code?: unknown }).code === 4902
              ) {
                await provider.request({
                  method: "wallet_addEthereumChain",
                  params: [
                    {
                      blockExplorerUrls: [CCTP_ROUTE.sourceExplorerUrl],
                      chainId: `0x${CCTP_ROUTE.sourceChainId.toString(16)}`,
                      chainName: "Sepolia",
                      nativeCurrency: { decimals: 18, name: "Sepolia ETH", symbol: "SEP" },
                      rpcUrls: [CCTP_ROUTE.sourceRpcUrl],
                    },
                  ],
                });
                await client.switchChain({ id: CCTP_ROUTE.sourceChainId });
              } else {
                throw caught;
              }
            }
          }
          if ((await verifyWallet()).chainId !== CCTP_ROUTE.sourceChainId) {
            throw new Error("Switch the selected wallet to Ethereum Sepolia before funding.");
          }

          const initialTransactions = buildCctpTransactions({
            quote,
            recipient: governedWalletAddress,
          });
          setState("APPROVING");
          const approvalHash = await client.sendTransaction({
            account: wagmiAddress,
            data: initialTransactions.approval.data,
            to: initialTransactions.approval.to,
            value: 0n,
          });
          const approvalReceipt = await client.waitForTransactionReceipt({ hash: approvalHash });
          assertSuccessfulApprovalReceipt(approvalReceipt);

          const checked = await verifyWallet();
          if (checked.chainId !== CCTP_ROUTE.sourceChainId) {
            throw new Error("Network changed after approval. No burn was sent.");
          }
          const quoteResponse = await fetch(`/api/cctp/quote?amount=${encodeURIComponent(amount)}`);
          const quoteBody: unknown = await quoteResponse.json().catch(() => null);
          if (
            !quoteResponse.ok ||
            !quoteBody ||
            typeof quoteBody !== "object" ||
            !("quote" in quoteBody)
          ) {
            throw new Error(
              "Could not revalidate the CCTP quote before burning. No burn was sent.",
            );
          }
          const refreshedQuote = assertValidCctpQuote(quoteBody.quote, amount);
          if (!canUseOriginalQuoteForBurn(quote, refreshedQuote)) {
            throw new Error(
              "CCTP requires a higher fee or the approved quote expired. Review a new quote; no burn was sent.",
            );
          }
          assertCurrentScope(expectedScope);
          const finalCheck = await verifyWallet();
          if (finalCheck.chainId !== CCTP_ROUTE.sourceChainId) {
            throw new Error("Network changed before burn. No burn was sent.");
          }
          const burnTransactions = buildCctpTransactions({
            // Retain the user's reviewed fee cap and minimum, never silently raise either.
            quote,
            recipient: governedWalletAddress,
          });
          const sourceNonce = await client.getTransactionCount({
            address: wagmiAddress,
            blockTag: "pending",
          });
          const sourceBlockNumber = await client.getBlockNumber();
          assertCurrentScope(expectedScope);
          if (!pendingMarker) throw new Error("CCTP recovery marker disappeared before burn.");
          const burnIntent = {
            amountBaseUnits: quote.amountBaseUnits,
            maxFeeBaseUnits: quote.maxFeeBaseUnits,
            sourceBlockNumber: sourceBlockNumber.toString(),
            sourceNonce,
          };
          pendingMarker = bindPendingFundingIntent(
            storage,
            governedWalletAddress,
            wagmiAddress,
            pendingMarker,
            burnIntent,
          );
          const burnSnapshot = readFundingStorageSnapshot(
            storage,
            governedWalletAddress,
            wagmiAddress,
          );
          if (burnSnapshot.transfer !== null || burnSnapshot.pending !== pendingMarker) {
            throw new Error("CCTP recovery data changed in another tab. No burn was sent.");
          }
          setState("BURNING");
          burnWalletRequestStarted = true;
          const hash = await client.sendTransaction({
            account: wagmiAddress,
            data: burnTransactions.burn.data,
            nonce: burnNonceForIntent(burnIntent),
            to: burnTransactions.burn.to,
            value: 0n,
          });
          if (!isStrictTransactionHash(hash))
            throw new Error("Wallet returned an invalid burn transaction hash.");
          if (scopeRef.current === expectedScope) setBurnTxHash(hash);
          persistFundingTransferIfSnapshotMatches(
            storage,
            governedWalletAddress,
            wagmiAddress,
            hash,
            burnIntent,
            burnSnapshot,
          );
          // Never remove the ambiguity marker until the hash has been durably verified.
          const linkedMarker = linkPendingFundingMarker(
            storage,
            governedWalletAddress,
            wagmiAddress,
            pendingMarker,
            hash,
          );
          if (
            !removeFundingStorageIfMatches(
              storage,
              cctpFundingPendingKey(governedWalletAddress, wagmiAddress),
              linkedMarker,
            )
          ) {
            throw new Error("CCTP pending recovery data changed in another tab.");
          }
          pendingMarker = null;
          assertCurrentScope(expectedScope);
          setBurnTxHash(hash);
          setState("BURN_SUBMITTED");
        },
      );
    } catch (caught) {
      const transactionError = messageFor(caught, "CCTP transaction failed.");
      if (!burnWalletRequestStarted && pendingMarker && governedWalletAddress && wagmiAddress) {
        try {
          const expectedMarker = pendingMarker;
          await withFundingLock(
            browserLocks(),
            cctpFundingLockName(governedWalletAddress, wagmiAddress),
            async () => {
              if (
                !removeFundingStorageIfMatches(
                  browserStorage(),
                  cctpFundingPendingKey(governedWalletAddress, wagmiAddress),
                  expectedMarker,
                )
              ) {
                throw new Error("CCTP recovery marker changed in another tab.");
              }
            },
          );
          pendingMarker = null;
        } catch (storageError) {
          if (scopeRef.current !== expectedScope) return;
          setState("RECOVERY_REQUIRED");
          setError(
            `${transactionError} Recovery marker could not be cleared: ${messageFor(storageError, "storage error")}`,
          );
          return;
        }
      }
      // The current account/recipient effect owns the replacement scope's UI state.
      // Recovery data for the old scope has still been handled above.
      if (scopeRef.current !== expectedScope) return;
      if (burnWalletRequestStarted) {
        setState("RECOVERY_REQUIRED");
        setError(
          `${transactionError} The burn request may have been broadcast. Do not retry; import the hash shown by your wallet.`,
        );
      } else {
        setState("QUOTED");
        setError(
          isKnownUserRejection(caught)
            ? "Wallet request rejected. No burn was sent."
            : transactionError,
        );
      }
    } finally {
      submittingRef.current = false;
    }
  }, [
    amount,
    assertCurrentScope,
    connector,
    governedWalletAddress,
    isConnected,
    quote,
    scope,
    state,
    wagmiAddress,
  ]);

  useEffect(() => {
    if (IS_ARC_MAINNET || !burnTxHash || !governedWalletAddress || !wagmiAddress || !scope) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const expectedScope = scope;
    const poll = async () => {
      controller = new AbortController();
      try {
        const nextStatus = await requestStatus(
          burnTxHash,
          governedWalletAddress,
          wagmiAddress,
          controller.signal,
        );
        if (stopped || scopeRef.current !== expectedScope) return;
        setStatus(nextStatus);
        setError(null);
        const nextState = fundingStateForStage(nextStatus.stage);
        setState(nextState);
        if (nextState === "POLLING_STATUS") timer = setTimeout(poll, 10_000);
      } catch (caught) {
        if (stopped || (caught instanceof DOMException && caught.name === "AbortError")) return;
        if (scopeRef.current !== expectedScope) return;
        setError(`Status check failed: ${messageFor(caught, "network error")}. Retrying.`);
        setState("POLLING_STATUS");
        timer = setTimeout(poll, 10_000);
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [burnTxHash, governedWalletAddress, requestStatus, scope, wagmiAddress]);

  const reset = useCallback(async () => {
    if (
      !governedWalletAddress ||
      !wagmiAddress ||
      !burnTxHash ||
      !status ||
      (state !== "COMPLETED" && state !== "SOURCE_FAILED")
    ) {
      setError(
        "The active CCTP transfer must reach a verified terminal status before starting another.",
      );
      return;
    }
    const expectedScope = scope;
    if (!expectedScope) return;
    try {
      await withFundingLock(
        browserLocks(),
        cctpFundingLockName(governedWalletAddress, wagmiAddress),
        async () => {
          assertCurrentScope(expectedScope);
          if (
            status.burnTxHash.toLowerCase() !== burnTxHash.toLowerCase() ||
            fundingStateForStage(status.stage) !== state
          ) {
            throw new Error(
              "The displayed CCTP terminal status no longer matches the tracked burn.",
            );
          }
          const storage = browserStorage();
          const snapshot = readFundingStorageSnapshot(storage, governedWalletAddress, wagmiAddress);
          const saved = loadFundingStorage(storage, governedWalletAddress, wagmiAddress);
          if (
            saved.kind !== "active" ||
            saved.transfer.burnTxHash.toLowerCase() !== burnTxHash.toLowerCase() ||
            snapshot.transfer === null
          ) {
            throw new Error("The tracked CCTP recovery record changed in another tab.");
          }
          assertStatusMatchesFundingIntent(
            status,
            saved.transfer,
            governedWalletAddress,
            wagmiAddress,
          );
          if (
            snapshot.pending &&
            !pendingMarkerLinksHash(
              snapshot.pending,
              governedWalletAddress,
              wagmiAddress,
              burnTxHash,
            )
          ) {
            throw new Error("A newer unresolved CCTP wallet request exists. It was not cleared.");
          }
          if (snapshot.pending) {
            if (
              !removeFundingStorageIfMatches(
                storage,
                cctpFundingPendingKey(governedWalletAddress, wagmiAddress),
                snapshot.pending,
              )
            ) {
              throw new Error("CCTP pending recovery data changed in another tab.");
            }
          }
          if (
            !removeFundingStorageIfMatches(
              storage,
              cctpFundingTransferKey(governedWalletAddress, wagmiAddress),
              snapshot.transfer,
            )
          ) {
            throw new Error("CCTP transfer recovery data changed in another tab.");
          }
          assertCurrentScope(expectedScope);
        },
      );
      if (scopeRef.current !== expectedScope) return;
      setAmountState("");
      setQuote(null);
      setStatus(null);
      setBurnTxHash(null);
      setError(null);
      setState("IDLE");
    } catch (caught) {
      if (scopeRef.current !== expectedScope) return;
      setError(messageFor(caught, "Unable to clear completed CCTP recovery data."));
    }
  }, [assertCurrentScope, burnTxHash, governedWalletAddress, scope, state, status, wagmiAddress]);

  const resumeWithHash = useCallback(
    async (value: string) => {
      if (
        IS_ARC_MAINNET ||
        !governedWalletAddress ||
        !wagmiAddress ||
        !isConnected ||
        !isStrictTransactionHash(value)
      ) {
        setError(
          "Enter a valid 32-byte burn transaction hash while the funding wallet is connected.",
        );
        return;
      }
      const expectedScope = scope;
      if (!expectedScope) return;
      try {
        await withFundingLock(
          browserLocks(),
          cctpFundingLockName(governedWalletAddress, wagmiAddress),
          async () => {
            assertCurrentScope(expectedScope);
            const storage = browserStorage();
            const snapshot = readFundingStorageSnapshot(
              storage,
              governedWalletAddress,
              wagmiAddress,
            );
            const existing = loadFundingStorage(storage, governedWalletAddress, wagmiAddress);
            if (
              (burnTxHash && burnTxHash.toLowerCase() !== value.toLowerCase()) ||
              (existing.kind === "active" &&
                existing.transfer.burnTxHash.toLowerCase() !== value.toLowerCase())
            ) {
              throw new Error(
                "Another CCTP transfer is active. It cannot be replaced by an imported hash.",
              );
            }
            // Status is bound to the requested recipient. Unknown hashes also require a
            // confirmed source burn whose sender was validated against this Wagmi account.
            const recoveredStatus = await requestStatus(value, governedWalletAddress, wagmiAddress);
            assertCurrentScope(expectedScope);
            if (!fundingSnapshotMatches(storage, governedWalletAddress, wagmiAddress, snapshot)) {
              throw new Error("CCTP recovery data changed in another tab. Import was not saved.");
            }
            if (existing.kind === "active") {
              // A hash already known to this scope may continue polling before source indexing.
              if (recoveredStatus.stage !== "source_pending") {
                assertStatusMatchesFundingIntent(
                  recoveredStatus,
                  existing.transfer,
                  governedWalletAddress,
                  wagmiAddress,
                );
              }
              assertCurrentScope(expectedScope);
              setBurnTxHash(value);
              setStatus(recoveredStatus);
              setState(fundingStateForStage(recoveredStatus.stage));
              setError(null);
              return;
            }
            assertImportableCctpStatus(recoveredStatus);
            const recoveredIntent = fundingIntentFromStatus(recoveredStatus);
            if (snapshot.pending) {
              const pendingIntent = pendingFundingIntent(
                snapshot.pending,
                governedWalletAddress,
                wagmiAddress,
              );
              if (!pendingIntent) {
                throw new Error(
                  "This legacy ambiguous wallet request has no burn identity and cannot be cleared automatically.",
                );
              }
              assertStatusMatchesFundingIntent(
                recoveredStatus,
                pendingIntent,
                governedWalletAddress,
                wagmiAddress,
              );
            }
            persistFundingTransferIfSnapshotMatches(
              storage,
              governedWalletAddress,
              wagmiAddress,
              value,
              recoveredIntent,
              snapshot,
            );
            if (snapshot.pending) {
              const linkedMarker = linkPendingFundingMarker(
                storage,
                governedWalletAddress,
                wagmiAddress,
                snapshot.pending,
                value,
              );
              if (
                !removeFundingStorageIfMatches(
                  storage,
                  cctpFundingPendingKey(governedWalletAddress, wagmiAddress),
                  linkedMarker,
                )
              ) {
                throw new Error("CCTP pending recovery data changed in another tab.");
              }
            }
            assertCurrentScope(expectedScope);
            setBurnTxHash(value);
            setStatus(recoveredStatus);
            setState(fundingStateForStage(recoveredStatus.stage));
            setError(null);
          },
        );
      } catch (caught) {
        if (scopeRef.current !== expectedScope) return;
        setState("RECOVERY_REQUIRED");
        setError(messageFor(caught, "Unable to validate and recover this CCTP burn hash."));
      }
    },
    [
      assertCurrentScope,
      burnTxHash,
      governedWalletAddress,
      isConnected,
      requestStatus,
      scope,
      wagmiAddress,
    ],
  );

  return {
    amount,
    burnTxHash,
    canResume: state === "IDLE" || state === "RECOVERY_REQUIRED",
    error,
    fetchQuote,
    isConnected,
    quote,
    reset,
    resumeWithHash,
    setAmount,
    state,
    status,
    submitFunding,
  };
}
