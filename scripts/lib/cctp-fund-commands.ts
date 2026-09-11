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
  assertRecipientContract,
  assertSourceSepolia,
  destinationPublicClient,
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
  type CctpBurnIntent,
  type CctpFundingState,
  acquireCctpLock,
  archiveCctpState,
  bindCctpPendingMarker,
  clearCctpPendingMarker,
  hasCctpPendingMarker,
  isCctpTerminalPhase,
  isCctpUnresolvedPhase,
  readCctpPendingMarker,
  readCctpState,
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

function initialState(recipient: Address, sender: Address, quote: CctpQuote): CctpFundingState {
  return {
    version: 1,
    recipient,
    sender,
    sourceChainId: CCTP_ROUTE.sourceChainId,
    destinationChainId: CCTP_ROUTE.destinationChainId,
    ...quoteRecord(quote),
    phase: "prepared",
    pollCount: 0,
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

export async function quote(amount: string): Promise<void> {
  const quoteResult = await getCctpQuote(parseAmount(amount));
  printQuote(quoteResult);
}

export async function start(amount: string, confirm: boolean): Promise<void> {
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

  const quoteResult = await getCctpQuote(parseAmount(amount));
  const account = funderAccount();
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: http(sourceRpcUrl()),
  });
  const transactions = buildCctpTransactions({ recipient, quote: quoteResult });
  if (transactions.approval.to.toLowerCase() !== CCTP_ROUTE.sourceUsdc.toLowerCase()) {
    throw new Error("CCTP SDK returned an approval target outside the approved route.");
  }
  if (
    transactions.approval.data.toLowerCase() !==
    approvalData(quoteResult.amountBaseUnits).toLowerCase()
  ) {
    throw new Error(
      "CCTP SDK returned approval calldata that does not authorize the exact quoted amount.",
    );
  }
  if (transactions.burn.to.toLowerCase() !== CCTP_ROUTE.sourceTokenMessenger.toLowerCase()) {
    throw new Error("CCTP SDK returned a burn target outside the approved route.");
  }

  const lock = acquireCctpLock(identity, undefined, {
    sender: account.address,
    recipient,
    amountBaseUnits: quoteResult.amountBaseUnits,
    maxFeeBaseUnits: quoteResult.maxFeeBaseUnits,
  });
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
      writeCctpState(initialState(recipient, account.address, quoteResult));
    } catch (error) {
      keepMarker = true;
      throw new Error(
        `CCTP state could not be initialized (${safeError(error)}). Keep the pending marker and do not rebroadcast.`,
      );
    }

    const state = readCctpState(identity);
    if (!state) throw new Error("CCTP state disappeared before approval; refusing to write.");
    console.log(`recipient   ${recipient}`);
    console.log(`funder      ${account.address}`);
    printQuote(quoteResult);

    updateCctpState(identity, { phase: "approval_pending" });
    let approvalAttempted = false;
    let approvalHash: Hash;
    try {
      approvalHash = await simulateAndSend(source, wallet, account, transactions.approval, () => {
        mayHaveBroadcasted = true;
        approvalAttempted = true;
      });
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
      throw error;
    }
    if (approvalStatus !== "success") {
      updateCctpState(identity, {
        phase: "approval_failed",
        lastError: `Approval transaction reverted: ${approvalHash}`,
      });
      release();
      throw new Error(`Approval reverted in ${approvalHash}; no burn was sent.`);
    }
    updateCctpState(identity, { phase: "approval_confirmed" });

    if (isQuoteExpired(quoteResult.expiresAt)) {
      updateCctpState(identity, {
        phase: "quote_expired",
        lastError: "Quote expired after approval; obtain a fresh quote before trying again.",
      });
      release();
      throw new Error(
        `Quote expired before burn. Approval succeeded in ${approvalHash}; requote and run an explicit new start. The fee was not increased and no burn was sent.`,
      );
    }

    updateCctpState(identity, { phase: "burn_pending" });
    const burnAnchor = await prepareSourceBurnAnchor(source, account.address);
    const burnIntent: CctpBurnIntent = {
      sender: account.address,
      recipient,
      amountBaseUnits: quoteResult.amountBaseUnits,
      maxFeeBaseUnits: quoteResult.maxFeeBaseUnits,
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
      );
    } catch (error) {
      if (!burnAttempted) {
        try {
          updateCctpState(identity, {
            phase: "burn_failed",
            lastError: `Burn simulation failed: ${safeError(error)}`,
          });
          release();
        } catch {
          keepMarker = true;
        }
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
