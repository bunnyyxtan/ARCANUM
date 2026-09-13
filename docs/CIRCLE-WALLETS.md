# Circle Wallets as the agent signer

Arcanum's agent signer is an ordinary Arc address that the governed wallet's
owner has authorized with `GuardedWallet.addSigner`. Until now the only
shipped way to hold that address's key was a private key on the agent host
(`AGENT_PRIVATE_KEY`). `arcanum-sdk/circle` adds a second way: a
[Circle developer-controlled wallet](https://developers.circle.com/wallets/developer-controlled-wallets),
whose key is generated and held inside Circle's MPC infrastructure and never
exists on the agent host. The agent asks Circle to sign; everything else in
Arcanum stays as it is.

## What changes, and what does not

The adapter is a [viem local account](https://viem.sh/docs/accounts/local).
`ArcanumClient` accepts it exactly where it accepted `privateKeyToAccount`:

```ts
import { ArcanumClient } from "arcanum-sdk";
import { arcTestnet, ARC_TESTNET_RPC_URL } from "arcanum-sdk/chains";
import { circleWalletAccount } from "arcanum-sdk/circle";

const agentSigner = circleWalletAccount({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
  walletId: process.env.CIRCLE_WALLET_ID!,
  address: process.env.CIRCLE_WALLET_ADDRESS as `0x${string}`,
});

const arcanum = new ArcanumClient({
  walletAddress: process.env.GUARDED_WALLET as `0x${string}`,
  agentSigner,
  chain: arcTestnet,
  rpcUrl: ARC_TESTNET_RPC_URL,
  apiUrl: "https://thearcanum.in",
});
```

Unchanged:

- **Custody and policy.** Funds stay in the `GuardedWallet`. The Circle wallet
  holds only a little native USDC for gas and has no more rights than any
  other agent signer: every `executeUSDC` still passes the policy engine,
  escalation and freeze logic onchain. Removing it is `removeSigner`.
- **Transaction flow.** viem prepares the transaction (nonce, gas, EIP-1559
  fees) against your Arc RPC and broadcasts the signed bytes itself. Circle
  only signs; it does not choose gas, does not broadcast and does not see
  your RPC.
- **Receipts and evidence.** Payment intents are signed as EIP-191 messages,
  the same format the receipt API verifies, so `requestPaymentReceipt` and
  `executePaymentIntentWithReceipt` work unchanged. Evidence linkage checks
  `tx.from` against the intent's signer address as before.

Changed:

- **Who can produce the agent's signature.** Anyone holding the Circle API
  key and the entity secret can sign as the agent, within whatever the
  governed wallet's policy allows. Those two values replace the private key
  as the secret to protect; Circle's own policy features are not used.
- **Availability.** Signing now depends on Circle's API being reachable. A
  Circle outage stops the agent from paying; it cannot cause a payment.
- **Privacy.** Circle sees every payload it signs: payment-intent messages
  (amount, vendor, purpose, reference) and transaction calldata, which for a
  receipt-first payment carries the receipt id in the reason bytes. It does
  not see the receipt envelope or the policy evaluation, and it never talks
  to the Arcanum API.

## What the adapter verifies

Circle is treated as a signing oracle, not as a trusted source of
transactions. Every answer is checked before it is used:

- A message or typed-data signature must recover to the configured wallet
  address, otherwise `CircleSignerError` with code `SIGNATURE_MISMATCH`.
- A signed transaction is parsed back and compared field by field with the
  request: chain id, nonce, recipient, value, calldata, gas limit and both
  fee caps must match, the type must be EIP-1559 and the access list empty
  (`TRANSACTION_MISMATCH`), and the sender must recover to the wallet
  address (`SIGNATURE_MISMATCH`). Only then does viem broadcast it.
- Transactions the adapter cannot express in Circle's request format (legacy
  gas price, access lists, blob or authorization lists, or a request viem has
  not fully prepared) are refused with `UNSUPPORTED_TRANSACTION` instead of
  being sent with fields silently dropped.
- The entity secret is encrypted freshly for every request with Circle's
  entity public key (RSA-OAEP, SHA-256), and a request body is never retried,
  because Circle rejects a reused ciphertext. The public key is cached only
  after a successful fetch.
- Errors from Circle carry the HTTP status, Circle's error code and message,
  and nothing else: no request body, no headers, no API key, no entity secret.

What none of this proves: the chain records only the signer address, so a
receipt or an evidence row shows that the authorized address signed, not
that Circle produced the signature. Circle provenance is an operational fact
about where that address's key lives; receipts do not attest it.

## Setup

1. In the [Circle developer console](https://console.circle.com), create a
   **testnet API key** and register an **entity secret** (Wallets →
   Developer Controlled → Configurator). Keep the recovery file; Circle
   cannot restore a lost entity secret. Both values are secrets: pass them to
   the agent runtime as environment variables, never commit them.
2. Create the wallet. `scripts/circle-wallet-setup.ts create` makes a wallet
   set and one `EVM-TESTNET` EOA in it and prints the `CIRCLE_WALLET_ID` and
   `CIRCLE_WALLET_ADDRESS` to export. Doing the same in the console works too.
   `EVM-TESTNET` is Circle's generic EVM identifier, not a named chain:
   Circle's transaction-signing endpoint is only available for the generic
   ids (`EVM`, `EVM-TESTNET`, and the Solana/NEAR ones), while a wallet
   created on `ARC-TESTNET` can sign messages and typed data but answers
   `sign/transaction` with error 156027. All EVM wallets in one wallet set
   share the same address, so the `EVM-TESTNET` wallet is the same Arc
   address the console shows for an `ARC-TESTNET` wallet in that set.
   Each run creates new objects (fresh idempotency keys), so do not repeat it
   blindly after an ambiguous failure: check the console, and pass
   `CIRCLE_WALLET_SET_ID` to reuse a set that already exists.
3. Authorize it as a signer. As the governed wallet's owner, run
   `scripts/circle-wallet-setup.ts authorize` (`OWNER_PRIVATE_KEY`,
   `GUARDED_WALLET`, `CIRCLE_WALLET_ADDRESS`): it calls `addSigner` and sends
   the wallet a little native USDC for gas (`GAS_USDC`, default 0.5). Both
   steps are skipped when already done. The dashboard keeps its own signer
   list for the wallet page; a signer added by script is fully authorized
   onchain, and appears in the dashboard once its state is synced from an
   owner session (the dashboard's add-signer flow does this itself).
4. Run the agent with the four `CIRCLE_*` variables set. `scripts/receipts-demo.ts`
   picks the Circle signer when all four are present, uses `AGENT_PRIVATE_KEY`
   when none is, and stops with an error on a partial set rather than falling
   back silently.

Mainnet is the same with a mainnet API key and the `EVM` blockchain
identifier; nothing in the adapter is testnet-specific.

## Limits

- **Node.js only.** Encrypting the entity secret uses `node:crypto`; the
  subpath is not for browsers. The rest of `arcanum-sdk` is unaffected.
- **EIP-1559 transactions only**, which is what viem prepares for Arc.
- **Generic EVM wallets only.** Transaction signing needs a wallet created on
  `EVM-TESTNET` or `EVM` (see Setup); named-chain wallets such as
  `ARC-TESTNET` get `CircleSignerError` with Circle code 156027 on the first
  payment, after the receipt was issued and before anything is broadcast.
- **No Circle policy layer.** Circle's transaction screening, contract
  allowlists and console policies are not configured or relied on; Arcanum's
  onchain policy is the control. Adding Circle-side controls on top is
  possible and independent.
- **One wallet per account object.** `circleWalletAccount` binds one
  `walletId` to one address; run several for several agents.
- **Not a smart-contract account.** The wallet is created as an EOA so that
  `msg.sender` is the signer address the `GuardedWallet` checks. Circle's
  SCA wallets would need the account-abstraction path, which Arcanum does not
  have.
