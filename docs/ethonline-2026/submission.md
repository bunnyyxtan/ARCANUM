# Showcase submission text (ETHOnline 2026)

Copy for the ETHGlobal project form. Fields marked _fill in_ are completed from
[`demo-evidence.md`](./demo-evidence.md) and the recorded video before
submitting. Everything else is final wording.

| Field | Value |
| --- | --- |
| Project name | ARCANUM |
| Category | Wallet/Payments |
| Emoji | 🛡️ |
| Track | Continuity: Extend Open Source |
| Partner prize | Arc |
| Repository | https://github.com/bunnyyxtan/ARCANUM (event branch `ethonline-2026`) |
| Live | https://thearcanum.in/verify (public), https://thearcanum.in/receipts (wallet sign-in) |
| Video | _fill in_ |

## Short description

Signed, offline-verifiable receipts of an agent wallet's policy verdict, tied to its Arc payment.

## Project description

Arcanum gives autonomous AI agents governed, non-custodial USDC wallets on Arc.
A `GuardedWallet` contract checks every spend against its owner's policy
before funds move and escalates risky payments to a human council. The
project, its repository and the production app at https://thearcanum.in
existed before ETHOnline 2026. This submission adds one feature to it:
**payment decision receipts**.

### What existed before the event

- Guarded wallets on Arc Testnet: `GuardedWallet`, `WalletFactory`,
  `PolicyEngine`, `VendorRegistry`, `EscalationManager`, `AnomalyOracle`, with
  spend caps, vendor allowlists and categories, freezes and onchain
  escalation to a council quorum.
- Agent-signed payment intents, a preflight endpoint, and an SDK that signs,
  preflights and executes payments.
- The approver portal, the indexer and read model, the operator dashboard,
  the public explorer and badge pages, the docs site, CI and tests.

The exact baseline is the `pre-ethonline-2026` tag; `PRE-EXISTING.md` in the
repository separates old from new, commit by commit.

### What was built during ETHOnline 2026

Before an agent pays, it can now ask Arcanum for a receipt: an issuer-signed
snapshot of what the wallet's policy decided about that exact signed payment
intent, evaluated at one pinned Arc Testnet block. The receipt carries the
verdict (allow, escalate, deny or freeze), the reason, the policy state it
was evaluated against, the block number and hash, and the agent's own request
signature. Anyone can verify it offline against a published issuer registry.

The agent puts the receipt id into the calldata of the transaction that acts
on it, and Arcanum later links the two: the transfer, the escalation hold and
the council's outcome, or the revert. An auditor can put the decision and its
consequence side by side, and see whether the chain agreed with the snapshot.

Built during the event, all on the `ethonline-2026` branch after the tag:

- Receipt format, canonical JSON, digests, EIP-191 issuer signing, the issuer
  registry and an offline verifier, in the shared package.
- Issuance in the API: pinned-block policy evaluation, idempotent issuance per
  reference, access rules for owners, agents and approvers, evidence linkage
  from transaction hashes, REST and tRPC routes, an immutable database table.
- SDK methods `requestPaymentReceipt`, `executePaymentIntentWithReceipt` and
  `attachPaymentReceiptEvidence`; the SDK verifies every receipt and binds it
  to the intent it signed before acting on it.
- Dashboard pages `/receipts` and `/receipts/[id]` with browser-side
  verification and an evidence timeline, and the public `/verify` page.
- Documentation, a testnet walkthrough and a demo runner.

A receipt never authorizes a transfer. The contract does not know receipts
exist and re-evaluates policy in the block that includes the transaction;
the receipt is the auditable record of the decision, not a permission slip.

### Demonstration

_fill in_ from `demo-evidence.md`: the allowed payment, the denied intent, the
escalated hold and the council decision, each with the receipt id, the Arc
Testnet transaction hash and the evidence entry.

## How it's made

The receipt body is a strict schema serialized with an RFC 8785 subset
(sorted keys, no whitespace, no floats) so the digest is stable across
languages. The issuer signs the SHA-256 digest with EIP-191; the issuer
registry (`GET /api/receipts/issuers`) publishes issuer addresses with their
validity windows so verification works offline and survives key rotation.

Issuance runs in the existing API package. It reads `GuardedWallet`,
`PolicyEngine`, `VendorRegistry` and `EscalationManager` at one pinned block
with the same spend-window arithmetic the contract uses, produces the verdict
and reason, and stores the envelope in a Supabase table made immutable by
trigger. Requests are idempotent per intent reference: a second request
returns the original receipt flagged as replayed. Evidence linkage re-reads
the transaction from the Arc Testnet RPC, records whether its calldata names
the receipt, and appends `execution/executed`, `execution/escalated`,
`execution/frozen` or `execution/reverted`, later `escalation/<status>`, each
with whether the onchain outcome matched the verdict.

The SDK (TypeScript) verifies the issuer signature, the digest and the
request signature, and checks that the receipt is bound to the intent it just
signed, before it will execute. It refuses to act on replayed receipts unless
told otherwise, because the contract has no notion of references and a second
`executeUSDC` is a second payment.

The web layer is the existing Next.js app: the dashboard pages verify
receipts in the browser with the same verifier the SDK uses, and `/verify`
accepts any pasted envelope without an account.

Stack: Solidity and Foundry (unchanged during the event), TypeScript, viem,
tRPC, Next.js, Supabase, Ponder, Arc Testnet.

## Disclosures

- **Continuity.** Arcanum predates the event. `PRE-EXISTING.md` lists what
  existed, what was built during the event, and the supporting commits. The
  event work is reviewable in one view at
  https://github.com/bunnyyxtan/ARCANUM/compare/pre-ethonline-2026...ethonline-2026
  and as review-only pull request
  https://github.com/bunnyyxtan/ARCANUM/pull/6.
- **AI use.** The event code, tests, migration and documentation were written
  by an AI agent directed by the maintainer from the plan in
  `docs/ethonline-2026/plan.md`; a second AI reviewer reviewed each slice.
  Design decisions, operation, deployment, the testnet demonstration and the
  video narration are the maintainer's. Details in `PRE-EXISTING.md`.
- **Arc.** The governed wallets hold and move USDC on Arc Testnet; receipts
  are evaluated against those contracts at pinned Arc blocks, and evidence is
  read back from Arc transactions.
