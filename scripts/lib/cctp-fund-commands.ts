import { http, type Address, type Hash, createWalletClient, encodeFunctionData } from "viem";

import {
  CCTP_ROUTE,
  type CctpQuote,
  type CctpStatus,
  buildCctpTransactions,
  getCctpQuote,
} from "../../packages/sdk/src/cctp";
import {
  WATCH_ATTEMPTS,
  WATCH_INTERVAL_MS,
  fetchStatus,
  identityFor,
  isQuoteExpired,
  parseAmount,
  printQuote,
  printStatus,
  resumeCommand,
  safeError,
  saveObservedError,
} from "./cctp-fund-io";
import {
  type SourceBurnAnchor,
  assertRecipientContract,
  assertSourceSepolia,
  destinationPublicClient,
  estimateSourceGas,
  funderAccount,
  prepareSourceBurnAnchor,
  recipientFromEnv,
  sepolia,
  simulateAndSend,
  sourcePublicClient,
  sourceRpcUrl,
  waitForReceipt,
} from "./cctp-fund-signing";
import {
  type CctpGasEstimate,
  type CctpSafetyCaps,
  assertCombinedSourceGasWithinCap,
  assertFeeWithinCctpCap,
  assertRefreshedCctpQuote,
  assertSequentialSourceNonces,
  deriveBurnGasCeiling,
  hasCctpSafetyCaps,
} from "./cctp-safety";
import {
  type CctpBurnIntent,
  type CctpFundingState,
  type CctpSafetyState,
  type CctpStateIdentity,
  type CctpStateLock,
  acquireCctpLock,
  acquireCctpSigningLock,
  archiveCctpState,
  bindCctpPendingMarker,
  clearCctpPendingMarker,
  hasCctpPendingMarker,
  isCctpTerminalPhase,
  isCctpUnresolvedPhase,
  readCctpPendingMarker,
  readCctpState,
  refreshCctpPendingMarkerQuote,
  updateCctpState,
  writeCctpState,
} from "./cctp-state";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

function quoteRecord(
  quote: CctpQuote,
): Pick<
  CctpFundingState,
  "amountBaseUnits" | "maxFeeBaseUnits" | "minimumReceivedBaseUnits" | "quoteExpiresAt"
> {
  return {
    amountBaseUnits: quote.amountBaseUnits,
    maxFeeBaseUnits: quote.maxFeeBaseUnits,
    minimumReceivedBaseUnits: quote.minimumReceivedBaseUnits,
    quoteExpiresAt: quote.expiresAt,
  };
}

function initialState(
  recipient: Address,
  sender: Address,
  quote: CctpQuote,
  caps?: CctpSafetyCaps,
  preflight?: {
    approvalNonce: number;
    burnNonce: number;
    approval?: CctpGasEstimate;
    burnGasCeiling?: string;
  },
): CctpFundingState {
  const safety: CctpSafetyState | undefined =
    preflight || hasCctpSafetyCaps(caps)
      ? {
          ...(caps?.maxFeeBaseUnits === undefined ? {} : { maxFeeBaseUnits: caps.maxFeeBaseUnits }),
          ...(caps?.maxSourceGasWei === undefined ? {} : { maxSourceGasWei: caps.maxSourceGasWei }),
          ...(hasCctpSafetyCaps(caps)
            ? { initialQuoteMaxFeeBaseUnits: quote.maxFeeBaseUnits }
            : {}),
          ...(preflight
            ? {
                approvalNonce: preflight.approvalNonce,
                burnNonce: preflight.burnNonce,
                ...(preflight.approval
                  ? {
                      approvalMaxCostWei: preflight.approval.maxCostWei.toString(),
                      approvalGasLimit: preflight.approval.gasLimit.toString(),
                      approvalMaxFeePerGasWei: preflight.approval.maxFeePerGasWei.toString(),
                      burnMaxFeePerGasWei: preflight.approval.maxFeePerGasWei.toString(),
                    }
                  : {}),
                ...(preflight.burnGasCeiling === undefined
                  ? {}
                  : { burnGasCeiling: preflight.burnGasCeiling }),
              }
            : {}),
        }
      : undefined;
  return {
    version: 1,
    recipient,
    sender,
    sourceChainId: CCTP_ROUTE.sourceChainId,
    destinationChainId: CCTP_ROUTE.destinationChainId,
    ...quoteRecord(quote),
    phase: "prepared",
    pollCount: 0,
    ...(safety === undefined ? {} : { safety }),
    updatedAt: Date.now(),
  };
}

function sourceIntentFromState(state: CctpFundingState): CctpBurnIntent | undefined {
  if (
    !state.sender ||
    state.sourceNonce === undefined ||
    state.sourceBlockNumber === undefined ||
    !state.burnTxHash
  ) {
    return undefined;
  }
  return {
    sender: state.sender,
    recipient: state.recipient,
    amountBaseUnits: state.amountBaseUnits,
    maxFeeBaseUnits: state.maxFeeBaseUnits,
    sourceNonce: state.sourceNonce,
    sourceBlockNumber: state.sourceBlockNumber,
  };
}

function preparedIntentFromState(state: CctpFundingState): CctpBurnIntent | undefined {
  if (!state.sender) return undefined;
  return {
    sender: state.sender,
    recipient: state.recipient,
    amountBaseUnits: state.amountBaseUnits,
    maxFeeBaseUnits: state.maxFeeBaseUnits,
  };
}

export function assertTerminalStateProofSafe(state: CctpFundingState): void {
  const sourceIntent = sourceIntentFromState(state);
  if (
    (state.phase === "source_failed" || state.phase === "completed") &&
    (!state.sourceProofVerified || !sourceIntent)
  ) {
    throw new Error(
      `Terminal ${state.phase} state lacks a verified source identity proof; recover it with status/watch before archiving or starting another run.`,
    );
  }
}

export function assertTerminalArchiveSafe(
  identity: ReturnType<typeof identityFor>,
  state: CctpFundingState,
  directory?: string,
): void {
  assertTerminalStateProofSafe(state);
  if (hasCctpPendingMarker(identity, directory)) {
    const marker = readCctpPendingMarker(identity, directory);
    if (!marker?.intent) {
      throw new Error(
        "Legacy CCTP pending marker has no durable identity; refusing to clear or archive it.",
      );
    }
    const sourceIntent = sourceIntentFromState(state);
    const intent = sourceIntent ?? preparedIntentFromState(state);
    if (!intent) throw new Error("Terminal CCTP state has no durable sender/quote intent.");
    if (
      marker.intent.sender.toLowerCase() !== intent.sender.toLowerCase() ||
      marker.intent.recipient.toLowerCase() !== intent.recipient.toLowerCase() ||
      marker.intent.amountBaseUnits !== intent.amountBaseUnits ||
      marker.intent.maxFeeBaseUnits !== intent.maxFeeBaseUnits
    ) {
      throw new Error("Terminal CCTP pending marker does not match the archived intent.");
    }
    if (sourceIntent) bindCctpPendingMarker(identity, sourceIntent, directory);
  }
}

function approvalData(amountBaseUnits: string): `0x${string}` {
  return encodeFunctionData({
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [CCTP_ROUTE.sourceTokenMessenger, BigInt(amountBaseUnits)],
  });
}

function assertRouteTransactions(
  transactions: ReturnType<typeof buildCctpTransactions>,
  amountBaseUnits: string,
): void {
  if (transactions.approval.to.toLowerCase() !== CCTP_ROUTE.sourceUsdc.toLowerCase()) {
    throw new Error("CCTP SDK returned an approval target outside the approved route.");
  }
  if (transactions.approval.data.toLowerCase() !== approvalData(amountBaseUnits).toLowerCase()) {
    throw new Error(
      "CCTP SDK returned approval calldata that does not authorize the exact quoted amount.",
    );
  }
  if (transactions.burn.to.toLowerCase() !== CCTP_ROUTE.sourceTokenMessenger.toLowerCase()) {
    throw new Error("CCTP SDK returned a burn target outside the approved route.");
  }
}

function assertPersistedNonce(
  identity: CctpStateIdentity,
  field: "approvalNonce" | "burnNonce",
  expected: number,
): void {
  const state = readCctpState(identity);
  if (state?.safety?.[field] !== expected) {
    throw new Error(
      `Persisted ${field} ${state?.safety?.[field] ?? "missing"} does not match required nonce ${expected}; refusing to sign.`,
    );
  }
}

export async function quote(amount: string): Promise<void> {
  const quoteResult = await getCctpQuote(parseAmount(amount));
  printQuote(quoteResult);
}

export async function start(
  amount: string,
  confirm: boolean,
  safetyCaps?: CctpSafetyCaps,
): Promise<void> {
  if (!confirm) throw new Error("start is write-enabled only with the exact --confirm flag.");
  const recipient = recipientFromEnv();
  const identity = identityFor(recipient, CCTP_ROUTE.sourceChainId);
  const source = sourcePublicClient();
  const destination = destinationPublicClient();

  // Chain and contract checks happen before obtaining a signer or creating a
  // pending marker. A wrong RPC cannot consume an approval or burn.
  await assertSourceSepolia(source);
  await assertRecipientContract(destination, recipient);

  const existing = readCctpState(identity);
  if (existing && isCctpUnresolvedPhase(existing.phase)) {
    throw new Error(
      `An unresolved CCTP run already exists in phase ${existing.phase}${existing.burnTxHash ? ` (${existing.burnTxHash})` : ""}; inspect it with status/watch and do not rebroadcast.`,
    );
  }
  // A verified terminal state is safe to start over. If a previous process
  // crashed after recording that terminal result but before removing its
  // marker, clear only that marker; a marker without a terminal state is
  // never stale-cleaned.
  if (existing && isCctpTerminalPhase(existing.phase)) {
    assertTerminalArchiveSafe(identity, existing);
    if (hasCctpPendingMarker(identity)) clearCctpPendingMarker(identity);
  }

  const parsedAmount = parseAmount(amount);
  const safetyEnabled = hasCctpSafetyCaps(safetyCaps);
  const quoteResult = await getCctpQuote(parsedAmount);
  assertFeeWithinCctpCap(quoteResult.maxFeeBaseUnits, safetyCaps?.maxFeeBaseUnits);
  const account = funderAccount();
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(sourceRpcUrl()),
  });
  let transactions = buildCctpTransactions({ recipient, quote: quoteResult });
  assertRouteTransactions(transactions, quoteResult.amountBaseUnits);

  let preflightAnchor: SourceBurnAnchor | undefined;
  let preflight:
    | {
        approvalNonce: number;
        burnNonce: number;
        approval?: CctpGasEstimate;
        burnGasCeiling?: string;
      }
    | undefined;
  const signingLock = acquireCctpSigningLock(account.address, CCTP_ROUTE.sourceChainId);
  let signingReleased = false;
  const releaseSigning = (): void => {
    if (!signingReleased) {
      signingLock.release();
      signingReleased = true;
    }
  };
  try {
    preflightAnchor = await prepareSourceBurnAnchor(source, account.address);
    const burnNonce = preflightAnchor.sourceNonce + 1;
    assertSequentialSourceNonces(preflightAnchor.sourceNonce, burnNonce);
    preflight = {
      approvalNonce: preflightAnchor.sourceNonce,
      burnNonce,
    };
    if (safetyCaps?.maxSourceGasWei !== undefined) {
      const approvalEstimate = await estimateSourceGas(
        source,
        account,
        transactions.approval,
        preflightAnchor.sourceNonce,
      );
      const burnGasCeiling = deriveBurnGasCeiling(approvalEstimate, safetyCaps.maxSourceGasWei);
      preflight.approval = approvalEstimate;
      preflight.burnGasCeiling = burnGasCeiling;
    }
  } catch (error) {
    releaseSigning();
    throw error;
  }

  let lock: CctpStateLock;
  try {
    lock = acquireCctpLock(identity, undefined, {
      sender: account.address,
      recipient,
      amountBaseUnits: quoteResult.amountBaseUnits,
      maxFeeBaseUnits: quoteResult.maxFeeBaseUnits,
    });
  } catch (error) {
    releaseSigning();
    throw error;
  }
  let mayHaveBroadcasted = false;
  let keepMarker = false;
  let lastBroadcastHash: Hash | undefined;
  let lastBroadcastKind: "approval" | "burn" | undefined;
  let released = false;
  const release = (): void => {
    if (!released) {
      lock.release();
      released = true;
    }
  };
  try {
    const afterLock = readCctpState(identity);
    if (afterLock && isCctpUnresolvedPhase(afterLock.phase)) {
      throw new Error(
        `An unresolved CCTP run already exists in phase ${afterLock.phase}; inspect it with status/watch and do not rebroadcast.`,
      );
    }
    if (afterLock) {
      // The lock owns a new marker for the fresh quote. Validate the archived
      // terminal state independently; never compare its old quote/nonce to
      // the new run's marker.
      assertTerminalStateProofSafe(afterLock);
      const archived = archiveCctpState(identity);
      if (archived) console.log(`archived    ${archived}`);
    }
    try {
      writeCctpState(initialState(recipient, account.address, quoteResult, safetyCaps, preflight));
    } catch (error) {
      keepMarker = true;
      releaseSigning();
      throw new Error(
        `CCTP state could not be initialized (${safeError(error)}). Keep the pending marker and do not rebroadcast.`,
      );
    }

    const state = readCctpState(identity);
    if (!state) throw new Error("CCTP state disappeared before approval; refusing to write.");
    if (!preflightAnchor || !preflight) {
      throw new Error(
        "CCTP signing nonce reservation disappeared before approval; refusing to sign.",
      );
    }
    const reservedApprovalNonce = preflightAnchor.sourceNonce;
    console.log(`recipient   ${recipient}`);
    console.log(`funder      ${account.address}`);
    printQuote(quoteResult);

    updateCctpState(identity, { phase: "approval_pending" });
    let approvalAttempted = false;
    let approvalHash: Hash;
    try {
      approvalHash = await simulateAndSend(
        source,
        wallet,
        account,
        transactions.approval,
        () => {
          mayHaveBroadcasted = true;
          approvalAttempted = true;
        },
        reservedApprovalNonce,
        preflight?.approval?.maxCostWei,
        () => assertPersistedNonce(identity, "approvalNonce", reservedApprovalNonce),
      );
    } catch (error) {
      if (!approvalAttempted) {
        try {
          updateCctpState(identity, {
            phase: "approval_failed",
            lastError: `Approval simulation failed: ${safeError(error)}`,
          });
          release();
        } catch {
          keepMarker = true;
        }
        releaseSigning();
      }
      throw error;
    }
    lastBroadcastHash = approvalHash;
    lastBroadcastKind = "approval";
    // Persist the hash before waiting or doing anything else.
    updateCctpState(identity, { approvalTxHash: approvalHash, phase: "approval_pending" });
    console.log(`approval    ${approvalHash}`);

    let approvalStatus: "success" | "reverted";
    try {
      approvalStatus = await waitForReceipt(source, approvalHash);
    } catch (error) {
      try {
        updateCctpState(identity, {
          lastError: `Approval receipt wait failed: ${safeError(error)}`,
        });
      } catch {
        keepMarker = true;
      }
      releaseSigning();
      throw error;
    }
    if (approvalStatus !== "success") {
      updateCctpState(identity, {
        phase: "approval_failed",
        lastError: `Approval transaction reverted: ${approvalHash}`,
      });
      releaseSigning();
      release();
      throw new Error(`Approval reverted in ${approvalHash}; no burn was sent.`);
    }
    updateCctpState(identity, { phase: "approval_confirmed" });

    let activeQuote = quoteResult;
    let burnAnchor: SourceBurnAnchor | undefined;
    try {
      burnAnchor = await prepareSourceBurnAnchor(source, account.address);
      assertSequentialSourceNonces(reservedApprovalNonce, burnAnchor.sourceNonce);
      if (burnAnchor.sourceNonce !== preflight.burnNonce) {
        throw new Error(
          `Planned burn nonce ${preflight.burnNonce} changed to ${burnAnchor.sourceNonce}; refusing to continue.`,
        );
      }
    } catch (error) {
      try {
        updateCctpState(identity, {
          phase: "safety_failed",
          lastError: `Post-approval nonce guard failed: ${safeError(error)}`,
        });
      } catch {
        keepMarker = true;
      }
      keepMarker = true;
      releaseSigning();
      throw new Error(
        `Post-approval nonce guard failed after approval ${approvalHash}; no burn was sent and the pending record is retained. ${safeError(error)}`,
      );
    }
    if (safetyEnabled) {
      try {
        const refreshedQuote = await getCctpQuote(parsedAmount);
        assertRefreshedCctpQuote(quoteResult, refreshedQuote, safetyCaps?.maxFeeBaseUnits);
        activeQuote = refreshedQuote;
        transactions = buildCctpTransactions({ recipient, quote: activeQuote });
        assertRouteTransactions(transactions, activeQuote.amountBaseUnits);

        if (safetyCaps?.maxSourceGasWei !== undefined) {
          if (!preflight.approval || preflight.burnGasCeiling === undefined) {
            throw new Error("Capped source-gas run has no persisted approval gas reservation.");
          }
          const refreshedBurnEstimate = await estimateSourceGas(
            source,
            account,
            transactions.burn,
            burnAnchor.sourceNonce,
          );
          if (refreshedBurnEstimate.gasLimit > BigInt(preflight.burnGasCeiling)) {
            throw new Error(
              `Post-approval burn gas limit ${refreshedBurnEstimate.gasLimit} exceeds the reserved ceiling of ${preflight.burnGasCeiling}.`,
            );
          }
          const combinedMaxGasWei = assertCombinedSourceGasWithinCap(
            preflight.approval,
            refreshedBurnEstimate,
            safetyCaps.maxSourceGasWei,
          );
          refreshCctpPendingMarkerQuote(identity, activeQuote.maxFeeBaseUnits);
          updateCctpState(identity, {
            ...quoteRecord(activeQuote),
            safety: {
              ...(readCctpState(identity)?.safety ?? {}),
              refreshedQuoteMaxFeeBaseUnits: activeQuote.maxFeeBaseUnits,
              burnNonce: burnAnchor.sourceNonce,
              burnGasLimit: refreshedBurnEstimate.gasLimit.toString(),
              burnMaxFeePerGasWei: refreshedBurnEstimate.maxFeePerGasWei.toString(),
              combinedMaxGasWei,
            },
          });
        } else {
          refreshCctpPendingMarkerQuote(identity, activeQuote.maxFeeBaseUnits);
          updateCctpState(identity, {
            ...quoteRecord(activeQuote),
            safety: {
              ...(readCctpState(identity)?.safety ?? {}),
              refreshedQuoteMaxFeeBaseUnits: activeQuote.maxFeeBaseUnits,
            },
          });
        }
      } catch (error) {
        try {
          updateCctpState(identity, {
            phase: "safety_failed",
            lastError: `Capped pre-burn safety check failed: ${safeError(error)}`,
          });
        } catch {
          keepMarker = true;
        }
        releaseSigning();
        keepMarker = true;
        throw new Error(
          `Capped pre-burn safety check failed after approval ${approvalHash}; no burn was sent and the pending record is retained. ${safeError(error)}`,
        );
      }
    } else if (isQuoteExpired(quoteResult.expiresAt)) {
      updateCctpState(identity, {
        phase: "quote_expired",
        lastError: "Quote expired after approval; obtain a fresh quote before trying again.",
      });
      releaseSigning();
      release();
      throw new Error(
        `Quote expired before burn. Approval succeeded in ${approvalHash}; requote and run an explicit new start. The fee was not increased and no burn was sent.`,
      );
    }

    updateCctpState(identity, { phase: "burn_pending" });
    if (!burnAnchor) {
      throw new Error("CCTP planned burn nonce disappeared before signing; refusing to write.");
    }
    const burnIntent: CctpBurnIntent = {
      sender: account.address,
      recipient,
      amountBaseUnits: activeQuote.amountBaseUnits,
      maxFeeBaseUnits: activeQuote.maxFeeBaseUnits,
      ...burnAnchor,
    };
    // Bind both durable records before the first burn broadcast. The exact
    // nonce is passed below; simulateAndSend must not prepare a fresh nonce.
    try {
      bindCctpPendingMarker(identity, burnIntent);
      updateCctpState(identity, {
        sender: account.address,
        sourceNonce: burnAnchor.sourceNonce,
        sourceBlockNumber: burnAnchor.sourceBlockNumber,
      });
    } catch (error) {
      keepMarker = true;
      releaseSigning();
      throw new Error(
        `CCTP burn identity could not be durably bound (${safeError(error)}); no burn was sent and the pending marker must be inspected before retrying.`,
      );
    }
    let burnAttempted = false;
    let burnHash: Hash;
    try {
      burnHash = await simulateAndSend(
        source,
        wallet,
        account,
        transactions.burn,
        () => {
          mayHaveBroadcasted = true;
          burnAttempted = true;
        },
        burnAnchor.sourceNonce,
        safetyCaps?.maxSourceGasWei && preflight?.approval
          ? BigInt(safetyCaps.maxSourceGasWei) - preflight.approval.maxCostWei
          : undefined,
        () => assertPersistedNonce(identity, "burnNonce", burnAnchor.sourceNonce),
      );
    } catch (error) {
      if (!burnAttempted) {
        try {
          updateCctpState(identity, {
            phase: safetyEnabled ? "safety_failed" : "burn_failed",
            lastError: `Burn simulation failed: ${safeError(error)}`,
          });
          if (safetyEnabled) keepMarker = true;
          else release();
        } catch {
          keepMarker = true;
        }
        releaseSigning();
      }
      throw error;
    }
    lastBroadcastHash = burnHash;
    lastBroadcastKind = "burn";
    // This is intentionally the first operation after send: if this write
    // fails, the marker remains and the operator gets the returned hash.
    try {
      updateCctpState(identity, {
        burnTxHash: burnHash,
        phase: "source_pending",
        lastError: undefined,
      });
      releaseSigning();
    } catch (error) {
      throw new Error(
        `Burn broadcast returned ${burnHash}, but durable state could not be saved (${safeError(error)}). Keep the pending marker, inspect the source hash, and do not rebroadcast.`,
      );
    }
    console.log(`burn        ${burnHash}`);

    let burnStatus: "success" | "reverted";
    try {
      burnStatus = await waitForReceipt(source, burnHash);
    } catch (error) {
      try {
        updateCctpState(identity, { lastError: `Source receipt wait failed: ${safeError(error)}` });
      } catch {
        keepMarker = true;
      }
      throw error;
    }
    if (burnStatus !== "success") {
      updateCctpState(identity, {
        phase: "source_failed",
        sourceError: `Source burn transaction reverted: ${burnHash}`,
        lastError: undefined,
      });
      release();
      throw new Error(`Source burn reverted in ${burnHash}; no destination forwarding will occur.`);
    }

    try {
      const observed = await fetchStatus(identity, burnHash);
      printStatus(observed.status);
      if (
        (observed.status.stage === "source_failed" || observed.status.stage === "completed") &&
        !observed.recovery.terminalVerified
      ) {
        throw new Error(
          `CCTP reported ${observed.status.stage}, but did not provide the exact source identity proof; keep the pending marker and resume with ${resumeCommand(burnHash)}.`,
        );
      }
      if (observed.recovery.terminalVerified) {
        clearCctpPendingMarker(identity);
        released = true;
      } else {
        console.log(`resume      ${resumeCommand(burnHash)}`);
      }
    } catch (error) {
      saveObservedError(identity, burnHash, error);
      console.error(`status      unavailable: ${safeError(error)}`);
      console.log(`resume      ${resumeCommand(burnHash)}`);
      // The source burn is known to have succeeded, but forwarding is not.
      // Keep the marker and return a non-zero result so this cannot look done.
      throw new Error(
        `Burn succeeded but status could not be verified; resume with ${resumeCommand(burnHash)}.`,
      );
    }
  } catch (error) {
    if (!signingReleased && !mayHaveBroadcasted && lastBroadcastKind !== "burn") {
      releaseSigning();
    }
    if (!released && !mayHaveBroadcasted && !keepMarker) {
      release();
    }
    if (!released && (mayHaveBroadcasted || keepMarker)) {
      const current = readCctpState(identity);
      const burnHash =
        current?.burnTxHash || (lastBroadcastKind === "burn" ? lastBroadcastHash : undefined);
      if (burnHash) {
        console.error(`safe       inspect ${burnHash}; do not rebroadcast.`);
        console.error(`resume     ${resumeCommand(burnHash)}`);
      } else if (current?.approvalTxHash || lastBroadcastKind === "approval") {
        const approvalHash = current?.approvalTxHash || lastBroadcastHash;
        console.error(
          `safe       approval ${approvalHash ?? "may"} have been broadcast; do not rebroadcast.`,
        );
        console.error("           inspect the source chain before an explicit new start.");
      } else {
        console.error(
          "safe       pending marker retained; inspect the state directory before retrying.",
        );
      }
    }
    throw error;
  }
}

export async function status(burnTxHash: Hash): Promise<void> {
  const recipient = recipientFromEnv();
  const identity = identityFor(recipient, CCTP_ROUTE.sourceChainId);
  try {
    const observed = await fetchStatus(identity, burnTxHash);
    printStatus(observed.status);
    if (
      (observed.status.stage === "source_failed" || observed.status.stage === "completed") &&
      !observed.recovery.terminalVerified
    ) {
      throw new Error(
        `CCTP reported ${observed.status.stage}, but its source identity proof did not match the durable intent; the pending marker remains locked.`,
      );
    }
    if (observed.recovery.terminalVerified) {
      clearCctpPendingMarker(identity);
    }
  } catch (error) {
    saveObservedError(identity, burnTxHash, error);
    throw new Error(`CCTP status could not be verified: ${safeError(error)}.`);
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export async function watch(burnTxHash: Hash): Promise<void> {
  const recipient = recipientFromEnv();
  const identity = identityFor(recipient, CCTP_ROUTE.sourceChainId);
  for (let attempt = 1; attempt <= WATCH_ATTEMPTS; attempt += 1) {
    let observed: CctpStatus;
    try {
      const result = await fetchStatus(identity, burnTxHash);
      observed = result.status;
      if (
        (observed.stage === "source_failed" || observed.stage === "completed") &&
        !result.recovery.terminalVerified
      ) {
        throw new Error(
          `CCTP reported ${observed.stage}, but its source identity proof did not match the durable intent.`,
        );
      }
    } catch (error) {
      saveObservedError(identity, burnTxHash, error);
      throw new Error(
        `CCTP status could not be verified (attempt ${attempt}); resume with ${resumeCommand(burnTxHash)}. ${safeError(error)}`,
      );
    }
    console.log(`poll        ${attempt}/${WATCH_ATTEMPTS}`);
    printStatus(observed);
    if (observed.stage === "source_failed" || observed.stage === "completed") {
      clearCctpPendingMarker(identity);
      return;
    }
    if (attempt < WATCH_ATTEMPTS) await sleep(WATCH_INTERVAL_MS);
  }
  throw new Error(
    `CCTP transfer is unsettled after the bounded watch window; resume with ${resumeCommand(burnTxHash)}.`,
  );
}
