# arcanum-sdk

TypeScript SDK for Arc Testnet GuardedWallet integrations.

The SDK talks directly to Arc RPC through `viem`. It does not require an
Arcanum-hosted API, and it does not custody agent keys. Write examples below are
for Arc Testnet and local development only.

## Install

```bash
npm install arcanum-sdk viem
```

## Basic usage

```ts
import { ArcanumClient } from "arcanum-sdk";
import {
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  arcTestnet,
  usdcErc20,
} from "arcanum-sdk/chains";
import { privateKeyToAccount } from "viem/accounts";

const agentSigner = privateKeyToAccount(
  process.env.AGENT_PRIVATE_KEY as `0x${string}`,
);

const arcanum = new ArcanumClient({
  walletAddress: process.env.GUARDED_WALLET as `0x${string}`,
  agentSigner,
  chain: arcTestnet,
  rpcUrl: process.env.ARC_TESTNET_RPC ?? ARC_TESTNET_RPC_URL,
});

const simulation = await arcanum.simulate({
  to: process.env.VENDOR_ADDRESS as `0x${string}`,
  amount: usdcErc20(12),
});

if (simulation.verdict === "ALLOW") {
  await arcanum.executeUSDC({
    to: process.env.VENDOR_ADDRESS as `0x${string}`,
    amount: usdcErc20(12),
    reason: "Arc Testnet API invoice",
    metadata: { category: "API" },
  });
}
```

Never hard-code private keys or commit `.env` files. For production operators,
prefer managed signer infrastructure or user-controlled wallets over server-held
agent keys.

## Payment intent preflight and execution

`createPaymentIntent` is a read-only policy preflight for agent backends. It
validates the configured GuardedWallet, checks that the agent signer is
authorized, evaluates the current policy/vendor state on Arc Testnet, and
returns `allow`, `deny`, `escalate`, `freeze`, `validation_error`, or
`unsupported`. It does not submit a transfer and never returns a fake
transaction hash.

`executePaymentIntent` performs the same preflight first, then submits the real
`GuardedWallet.executeUSDC` transaction only when policy returns an executable
path:

- `allow` transfers real Arc Testnet USDC from the GuardedWallet.
- `escalate` creates an onchain escalation and does not transfer immediately.
- `freeze` submits the guarded wallet call so the contract can freeze/block the
  wallet without transferring funds.

`deny`, `validation_error`, and `unsupported` are returned without submitting a
transaction. EURC is intentionally reported as unsupported until the deployed
wallet contract supports a second token.

```ts
const intent = {
  governedWalletAddress: process.env.GUARDED_WALLET as `0x${string}`,
  agentSignerAddress: agentSigner.address,
  vendorAddress: process.env.VENDOR_ADDRESS as `0x${string}`,
  tokenAddress: ARC_TESTNET_USDC_ADDRESS,
  tokenSymbol: "USDC" as const,
  amount: "12.50",
  purpose: "Arc Testnet API invoice",
  reference: "invoice-2026-0001",
};

const signedIntent = await arcanum.signPaymentIntent(intent);
const decision = await arcanum.createPaymentIntent(intent);

console.log(signedIntent.signature);
console.log(decision.decision, decision.reason);

if (decision.decision === "allow" || decision.decision === "escalate") {
  const result = await arcanum.executePaymentIntent(intent);

  console.log(result.decision, result.txHash, result.escalationId);
}
```

`reference` is descriptive metadata, not an idempotency guarantee. If receipt
waiting times out, do not submit the transfer again: keep the transaction hash
and call `await arcanum.confirm(txHash)`. Resubmission can transfer funds twice.

Use the signed intent when calling the Arcanum API from an agent service. The
signature proves that the authorized agent signer approved the exact request;
the API still evaluates policy from chain state and does not custody keys. Use
the SDK execution method only from an agent runtime that controls the authorized
testnet signer.

## Payment decision receipts

`requestPaymentReceipt` asks the Arcanum API for a signed receipt: the verdict
the wallet's policy gives the intent, evaluated at one pinned block and signed
by the published Arcanum issuer key. Nothing moves onchain. The receipt is an
offline-verifiable record of a preflight, not an authorization; the contract
still decides at execution time. The client verifies every receipt it
receives (issuer signature, digest, its own request signature, and that the
receipt answers the intent it just signed) before returning it; a receipt
that fails is a `RECEIPT_UNVERIFIED` or `RECEIPT_MISMATCH` error, never a
result; a response that is not a receipt envelope is a `ReceiptRequestError`
(`MALFORMED_RESPONSE`). Pass `receiptIssuers` in the config to trust a
self-hosted issuer.

`executePaymentIntentWithReceipt` obtains the receipt first, submits
`executeUSDC` only for `allow` and `escalate` with the receipt id in the reason
metadata, then links the transaction hash back to the receipt. When execution
returns a hash, the result carries it even if linking fails (`evidenceError`
sits next to it). If the RPC drops out while waiting for inclusion, the
execution error has no hash; link the transaction later with
`attachPaymentReceiptEvidence`.

```ts
const arcanum = new ArcanumClient({
  walletAddress,
  agentSigner,
  chain: arcTestnet,
  rpcUrl: ARC_TESTNET_RPC_URL,
  apiUrl: "https://thearcanum.in",
});

const { receipt, replayed } = await arcanum.requestPaymentReceipt(intent);
console.log(receipt.receipt.decision.verdict, receipt.receipt.decision.reasonCode);

const outcome = await arcanum.executePaymentIntentWithReceipt(intent);
console.log(outcome.result.txHash, outcome.evidence?.map((row) => row.outcome));

const verification = await verifyPaymentReceipt(receipt);
console.log(verification.ok, verification.issuer.status);
```

`verifyPaymentReceipt` runs entirely offline against the issuer registry
bundled in the SDK. The same `reference` returns the same receipt
(`replayed: true`); reusing a reference for a different payment is rejected.
`executePaymentIntentWithReceipt` does not act on a replayed receipt, since
the earlier attempt may already have paid and the contract does not
deduplicate references: it returns `errorCode: "RECEIPT_REPLAYED"` unless
called with `{ executeReplayedReceipt: true }` or a fresh reference.
See the repository's `docs/PAYMENT-RECEIPTS.md` for the format, the trust
model and the API.

## Public exports

- `ArcanumClient`
- `createPaymentIntentMessage`
- `encodeExecuteUSDC`
- SDK error classes such as `PolicyDeniedError` and `EscalationRequiredError`
- Domain types such as `PolicyEnvelope`, `ExecuteUSDCInput`, and
  `SimulationResult`
- Payment intent types such as `PaymentIntentInput`, `SignedPaymentIntentInput`,
  and `PaymentIntentResult`
- Receipt helpers `verifyPaymentReceipt`, `paymentReceiptDigest`,
  `paymentReceiptEnvelopeSchema`, `PAYMENT_RECEIPT_ISSUERS`, the `ReceiptApi`
  REST client, `ReceiptRequestError`, and types such as
  `PaymentReceiptEnvelope`, `PaymentReceiptEvidence`, and
  `PaymentIntentWithReceiptResult`
- Arc Testnet helpers from `arcanum-sdk/chains`, including `arcTestnet`,
  `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_USDC_ADDRESS`, `usdcErc20`, and `usdcGas`
