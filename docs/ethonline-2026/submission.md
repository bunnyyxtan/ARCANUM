# Showcase submission text (ETHOnline 2026)

Copy for the ETHGlobal project form. Demonstration details below come from
[`demo-evidence.md`](./demo-evidence.md). No submission video URL is recorded
or available in this repository.

| Field | Value |
| --- | --- |
| Project name | ARCANUM |
| Category | Wallet/Payments |
| Emoji | 🛡️ |
| Track | Continuity: Extend Open Source |
| Partner prize | Arc |
| Repository | https://github.com/bunnyyxtan/ARCANUM (event branch `ethonline-2026`) |
| Live | https://thearcanum.in/verify (public), https://thearcanum.in/receipts (wallet sign-in) |
| Video | Not recorded or available |

## Short description

Signed, offline-verifiable receipts of an agent wallet's policy verdict, tied to its Arc payment.

## Project description

Arcanum gives autonomous AI agents governed, non-custodial USDC wallets on Arc.
A `GuardedWallet` contract checks every spend against its owner's policy
before funds move and escalates risky payments to a human council. The
project, its repository and the production app at https://thearcanum.in
existed before ETHOnline 2026. This submission adds one feature to it,
**payment decision receipts**. On the event's last day the existing contracts
and event receipt implementation were also deployed to **Arc Mainnet**. That
is deployment work, not a second new feature.

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
intent, evaluated at one pinned Arc block. The receipt carries the
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
- A Circle signer: `arcanum-sdk/circle` lets the agent sign its payment
  intents and transactions with a Circle developer-controlled wallet instead
  of a key file on the host, with every Circle answer verified before use;
  the governed wallet, its policy and the receipts are unchanged.
- An inbound CCTP V2 funding flow: Sepolia USDC is burned with Circle's
  Forwarding Service hook and minted to an Arc Testnet governed wallet.
  The dashboard and CLI expose fee quotes, source-hash recovery and
  onchain-verified settlement status. Funding is separate from payment
  receipts and leaves spending policy unchanged; see
  [`CCTP-FUNDING.md`](../CCTP-FUNDING.md). A live 5 USDC burn and Arc mint are
  recorded in [`demo-evidence.md`](./demo-evidence.md#cctp-inbound-funding-2026-09-11);
  this run completed through an explicitly approved manual relay after
  automatic forwarding did not finish during observation. It proves CCTP
  settlement, not successful automatic forwarding.
- **Arc Mainnet, on launch day.** Arc's public mainnet (chain 5042) opened on
  16 September; the same day the contracts were deployed to it
  (`packages/contracts/deployments/arc-mainnet.json`, first indexed block
  21,141,720), https://thearcanum.in was switched from Arc Testnet to Arc
  Mainnet in place, and a governed wallet with 0.02 USDC caps was put through
  a denied intent (receipt only), an allowed 0.01 USDC payment whose receipt
  is named in its calldata ([`0xda45ae3b…c32a9c`](https://explorer.arc.io/tx/0xda45ae3b4f0ae0de24406ddaff2e698cbe1b8daac5c5abac94de6954e1c32a9c), evidence `execution/executed`,
  verdict matched) and an owner freeze. The receipts are signed by the new
  `arc-mainnet-2026-09` issuer and verify offline. Every transaction is in
  [`demo-evidence.md`](./demo-evidence.md#arc-mainnet-pilot-16-september-2026).
  The contracts are unaudited, so the live terms call this a limited pilot
  with small caps.

A receipt never authorizes a transfer. The contract does not know receipts
exist and re-evaluates policy in the block that includes the transaction;
the receipt is the auditable record of the decision, not a permission slip.

### Demonstration

The recorded Arc Testnet proof starts with allowed receipt
`e68e068d-90b0-4366-940d-700b1b1c8c60`: 5 USDC executed in
[`0x214b1ddb…62fc781c`](https://testnet.arcscan.app/tx/0x214b1ddba2b8018eda6d4692d9c1647907d79b0046bdb2b8bd80c3cf62fc781c)
and produced `execution/executed`. Receipt
`8d050a43-82a9-4c69-88a3-8ea7436f1749` records an escalated 12 USDC
payment. The contract held it in
[`0x4cf0dd6a…11221b`](https://testnet.arcscan.app/tx/0x4cf0dd6a21401b242fc4d8ba0a4348a51d722cdda9260e76b4d9879feb11221b),
producing `execution/escalated` and `escalation/pending`. The council then
released that same hold in
[`0x6e9e123c…56b4b7c`](https://testnet.arcscan.app/tx/0x6e9e123cbcdcc9d0e20336bb3239d36f95d01df13ece4d03922fc760556b4b7c);
re-linking the original hold appended `escalation/released` to the same
receipt. Denied receipt `3fb578b8-454d-4f3d-bf2f-64407e8b88ed` has no
transaction and no evidence row because the denied intent was not sent.

The recorded Arc Mainnet pilot uses chain 5042 and issuer
`arc-mainnet-2026-09` at
`0xee52de6c75b868e919999c08691a9b648f8c61dd`. Denied receipt
`902fe3ae-2ec2-4623-bc6e-64987f18bafa` likewise has no transaction. Allowed
receipt `947dcb81-9de4-4c99-b85e-16682ab32ef0` paid 0.01 USDC in
[`0xda45ae3b…c32a9c`](https://explorer.arc.io/tx/0xda45ae3b4f0ae0de24406ddaff2e698cbe1b8daac5c5abac94de6954e1c32a9c);
its calldata names the receipt and its recorded `execution/executed` row has
`verdictMatches: true`. The owner froze the pilot wallet in
[`0x021c0446…018dc7`](https://explorer.arc.io/tx/0x021c04465a4aae37550cb17af38c16dbe5cf2b9309c83fec0d0bf049ff018dc7).
No screenshot or video URL is recorded or available.

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
the transaction from the configured Arc RPC, records whether its calldata names
the receipt, and appends `execution/executed`, `execution/escalated`,
`execution/frozen` or `execution/reverted`, later `escalation/<status>`, each
with whether the onchain outcome matched the verdict. Network selection is
one switch: the deployment manifest, chain constants, explorer links and the
receipt issuer all follow `NEXT_PUBLIC_ARC_NETWORK`, which is how the same
code moved from Arc Testnet to Arc Mainnet on 16 September.

The SDK (TypeScript) verifies the issuer signature, the digest and the
request signature, and checks that the receipt is bound to the intent it just
signed, before it will execute. It refuses to act on replayed receipts unless
told otherwise, because the contract has no notion of references and a second
`executeUSDC` is a second payment.

The web layer is the existing Next.js app: the dashboard pages verify
receipts in the browser with the same verifier the SDK uses, and `/verify`
accepts any pasted envelope without an account.

The Circle signer is a viem local account backed by Circle's
developer-controlled wallets API (`sign/message`, `sign/transaction`,
`sign/typedData` with the entity-secret ciphertext). Circle holds the agent's
key and only signs; the SDK builds the transaction, checks that every
signature recovers to the wallet address and that a signed transaction parses
back to exactly the requested fields, then broadcasts to Arc itself. The wallet's address is
authorized on the governed wallet like any other signer, so nothing in the
contracts, the policy or the receipts knows or cares that Circle is behind
it. The wallet has to be created on Circle's generic `EVM-TESTNET`
identifier, since Circle's transaction signing is not offered for named
chains such as `ARC-TESTNET`.

Stack: Solidity and Foundry (unchanged during the event), TypeScript, viem,
tRPC, Next.js, Supabase, Ponder, Circle Developer-Controlled Wallets, Arc.
The hosted product has run on Arc Mainnet since 16 September 2026; the
receipt runs recorded in the demonstration above are on Arc Testnet.

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
  Design decisions, operation, deployment and the recorded demonstrations are
  the maintainer's. A text-to-speech voiceover script was written and approved
  by the maintainer, but no video URL is recorded or available. Details in
  `PRE-EXISTING.md`.
- **Arc.** The governed wallets hold and move USDC on Arc: on Arc Mainnet
  since 16 September 2026 (the pilot in `demo-evidence.md`), on Arc Testnet
  before that; receipts are evaluated against those contracts at pinned Arc
  blocks, and evidence is read back from Arc transactions.
- **Later maintenance.** Subsequent private mainnet operational hardening is
  maintenance, not the newly developed event receipt feature and not a formal
  audit. Receipt, API, SDK and operational repairs were implemented and
  source-tested locally. An independent source review caught an unbound
  escalation evidence display gap; the helper and label were corrected for
  every evidence kind and two guard tests were added. The recorded combined
  checks passed 187 API, 207 web and 106 SDK tests, with additional real
  PostgreSQL, receipt CLI, backup/load and production-mode build checks listed
  in the build log. The targeted web receipt suite then passed 4 of 4,
  including the two new escalation cases; final web typecheck and the
  three-file Biome check passed. No full 209-test web rerun is claimed. At the
  local-verification snapshot the maintenance had not yet been committed,
  published or deployed, and no production migration had been applied. Source
  publication alone does not require it; deployment of the stricter API does.
