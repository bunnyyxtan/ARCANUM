# @arcanum/sdk

TypeScript SDK for Arc Testnet GuardedWallet integrations.

The SDK talks directly to Arc RPC through `viem`. It does not require an
Arcanum-hosted API, and it does not custody agent keys. Write examples below are
for Arc Testnet and local development only.

## Install

```bash
npm install @arcanum/sdk viem
```

## Basic usage

```ts
import { ArcanumClient } from "@arcanum/sdk";
import {
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  arcTestnet,
  usdcErc20,
} from "@arcanum/sdk/chains";
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
- `escalate` creates an on-chain escalation and does not transfer immediately.
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
  idempotencyKey: "invoice-2026-0001",
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

Use the signed intent when calling the Arcanum API from an agent service. The
signature proves that the authorized agent signer approved the exact request;
the API still evaluates policy from chain state and does not custody keys. Use
the SDK execution method only from an agent runtime that controls the authorized
testnet signer.

## Public exports

- `ArcanumClient`
- `createPaymentIntentMessage`
- `encodeExecuteUSDC`
- SDK error classes such as `PolicyDeniedError` and `EscalationRequiredError`
- Domain types such as `PolicyEnvelope`, `ExecuteUSDCInput`, and
  `SimulationResult`
- Payment intent types such as `PaymentIntentInput`, `SignedPaymentIntentInput`,
  and `PaymentIntentResult`
- Arc Testnet helpers from `@arcanum/sdk/chains`, including `arcTestnet`,
  `ARC_TESTNET_RPC_URL`, `ARC_TESTNET_USDC_ADDRESS`, `usdcErc20`, and `usdcGas`
