# SDK transaction outcomes and recovery

`executeUSDC`, `executePaymentIntent`, and `executePaymentIntentWithReceipt`
use simulation/attestation only as preflight, not as evidence of the mined
outcome. A successful receipt must contain exactly one recognized outcome log
emitted by the configured wallet and naming that wallet. Executed/escalated
events must match recipient and amount. The transaction must match the original
`executeUSDC` calldata (including reason/metadata); this also binds a `Frozen`
event, which has no recipient or amount. Unrelated-contract logs are ignored.
Missing, ambiguous, malformed or inconsistent outcomes fail explicitly.

After submission, confirmation/RPC errors throw `TransactionRecoveryError`,
not a denial or a “not submitted” result. This error is exported by the SDK and
contains `txHash`, `code`, `cause`, and (for execution/reconciliation)
`submission`: wallet, chain ID when available, and original input. It has no
policy verdict. This applies to both intent wrappers as well as `executeUSDC`.
A mined revert remains `TransferRevertedError`; receipt-first execution can
return that definitive revert as a deny result with its hash.

## Persist before waiting; reconcile without submitting

```ts
import { TransactionRecoveryError } from "arcanum-sdk";

try {
  const result = await client.executeUSDC(input, {
    onSubmitted: async (submission) => {
      // Implement this with your durable store. JSON needs a bigint codec:
      // store submission.input.amount as a decimal string and restore BigInt.
      await storeSubmission(submission);
    },
  });
  // result.verdict is the observed outcome, not the earlier simulation.
} catch (error) {
  if (!(error instanceof TransactionRecoveryError)) throw error;
  await recordUncertainSubmission(error.txHash, error.submission);
  // Do not call an execute method again.
}

// Later, using the same chain/wallet and exact persisted input:
const result = await readOnlyClient.reconcileUSDC(saved.txHash, saved.input);
```

`onSubmitted` is awaited immediately after the signer returns a hash, before
waiting for confirmation. It also works as an execution option on either intent
method. Receipt-first inputs include `metadata.receiptId` and `metadata.reference`.
Callback failure throws `SUBMISSION_PERSISTENCE_FAILED` with the hash: it does
not cancel or roll back the transaction. The callback must not send payments.

`reconcileUSDC` is read-only: it requires no signer, performs no preflight,
and never resubmits. Repeated attempts use the same hash. `confirm` remains a
lower-level receipt/status method, not a payment-outcome classifier. A receipt
for a replacement hash is rejected; investigate replacements explicitly rather
than assuming their calldata or outcome matches.

For receipt-first payments, evidence attachment after a known outcome remains
best-effort: failure preserves the result/hash and returns `evidenceError`.
After recovering an uncertain payment, retry only
`attachPaymentReceiptEvidence(receiptId, saved.txHash)` if linkage is needed;
attachment does not execute a payment. An issuer receipt is a preflight
attestation, not proof of settlement.

## Limits

There is no exactly-once guarantee. References and receipt IDs are not onchain
deduplication keys. Never recover by changing the reference, enabling
`executeReplayedReceipt`, or resubmitting the same input. A crash between broadcast
and hash persistence, or a signer/RPC error before it returns a hash, cannot be
resolved by this callback. Investigate account/nonce/provider history without
sending another payment. Persistence and cross-process coordination belong to
the caller.

Outcomes rely on the configured RPC and contract ABI; one receipt is not a
finality guarantee. Reorgs, unavailable/pruned transaction data, replacements,
and malformed logs can leave reconciliation unresolved. Escalation means queued,
not paid; a later council release is a separate transaction. Current helpers
handle direct `executeUSDC`, not batched/proxied calls or escalation releases.