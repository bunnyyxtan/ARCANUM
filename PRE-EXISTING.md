# Pre-existing work disclosure (ETHOnline 2026)

Arcanum is an existing, open-source project. This submission enters under the
continuity route: the repository, its history and its production deployment
predate the event, and one new feature, **payment decision receipts**, was
built during it. This document separates the two so judges can see exactly
what is new.

## Links

| | |
| --- | --- |
| Public repository | https://github.com/bunnyyxtan/ARCANUM |
| Event branch | [`ethonline-2026`](https://github.com/bunnyyxtan/ARCANUM/tree/ethonline-2026) |
| Baseline tag | [`pre-ethonline-2026`](https://github.com/bunnyyxtan/ARCANUM/releases/tag/pre-ethonline-2026) at commit `d2cdb33` |
| Existing application | https://thearcanum.in |
| New feature documentation | [`docs/PAYMENT-RECEIPTS.md`](./docs/PAYMENT-RECEIPTS.md) |

## Baseline

The repository's first commit is `6204a3e` (11 June 2026). The event window is
4–16 September 2026.

The event branch was cut from `main` at `d2cdb33` (7 September 2026, tagged
`pre-ethonline-2026`). Commits on `main` between the event start and that tag
are the protocol v2 release and routine hardening that were already in flight
and are unrelated to receipts: `feat: protocol v2`, `chore: testnet v2
deployment`, `feat: mainnet config`, `feat: synced-through height`, the
Supabase and dashboard refactors, CI widening and test coverage. None of that
is claimed as hackathon work. The last commit before the event opened is
`f1e6746` (2 September 2026). Everything that touches receipts is on the event
branch, after the tag, with real commit dates.

## What existed before the event

Everything below was live at https://thearcanum.in and in the repository
before receipts were started.

- **Guarded wallets.** `GuardedWallet`, `WalletFactory`, `PolicyEngine`,
  `VendorRegistry`, `EscalationManager`, `AnomalyOracle` on Arc Testnet
  (`packages/contracts`), including the v2 deployment of 7 September. USDC
  custody, authorized agent signers, spend caps, vendor categories and
  allowlists, freezes, and onchain escalation with a council quorum.
- **Payment intents.** The agent-signed payment intent format
  (`ARCANUM_PAYMENT_INTENT_V1`), the `paymentIntents.create` preflight in
  `packages/api/src/routers/payment-intents.ts`, and the SDK's
  `signPaymentIntent`, `createPaymentIntent`, `executePaymentIntent` and
  `executeUSDC` in `packages/sdk`.
- **Human review.** The approver portal, `escalations` router and onchain
  approval, rejection and release paths.
- **Read model and UI.** The Ponder indexer, Supabase read models, SIWE
  sessions, the dashboard (agents, vendors, ledger, escalations, anomalies,
  settings, status), the public explorer and badge pages, the docs site.
- **Tooling.** CI (lint, typecheck, test, build), Biome, Foundry tests and
  analyzers, the deployment manifest convention, the Python SDK.

## What was built during the event

All of it is on `ethonline-2026` after `pre-ethonline-2026`:

| Commit | Scope |
| --- | --- |
| `3f69f88` `feat: payment receipt primitives` | `packages/shared/src/receipts`: strict receipt schema, RFC 8785-subset canonical JSON, digests, EIP-191 issuer signing, the issuer registry, and the offline verifier `verifyPaymentReceipt`, with tests |
| `6724ca3` `feat: payment receipt issuance and evidence api` | `packages/api/src/receipts`: pinned-block evaluation with spend-window parity, issuance, idempotency, access rules, evidence linkage from transaction hashes; tRPC `receipts` router; REST routes under `apps/web/app/api/receipts`; the `payment_receipts` / `payment_receipt_evidence` migration; tests |
| `12c527c` `feat: receipt-first payments in sdk` | `packages/sdk`: `requestPaymentReceipt`, `attachPaymentReceiptEvidence`, `executePaymentIntentWithReceipt`, the REST client, re-exported verifier; tests |
| `80cccd5` `feat: payment receipt pages` | `apps/web`: dashboard `/receipts` and `/receipts/[id]` (browser-side verification, evidence timeline), public `/verify`, navigation entries |
| `docs: payment decision receipts` | `docs/PAYMENT-RECEIPTS.md`, README and SDK README sections, docs-site concept page, `.env.example` entries, `docs/ethonline-2026` planning artifacts, this file |

Nothing in `packages/contracts` changed. Receipts sit beside the existing
preflight: the contract still decides at execution time and the receipt
records what the policy said at a pinned block beforehand. The existing
`paymentIntents.create` preflight gained one correction as a side effect
(a zero vendor address is now reported as a validation error instead of being
sent on to policy evaluation); its behaviour is otherwise unchanged.

## AI-use disclosure

The receipts feature was designed and built by the maintainer working with an
AI coding agent (Replit Agent) in a pair-programming loop, which is also how
the pre-existing codebase was developed. Concretely:

- **Planning.** The maintainer wrote the feature brief and the trust model
  (an agent signature is not a signature over the verdict; preflight is not
  settlement; a revert leaves no logs; a receipt never authorizes a transfer)
  and reviewed every design decision, including the ones that were changed
  after review (wallet-local escalation manager resolution, no deny gate on
  evidence, zero-recipient rejection). The planning document
  [`docs/ethonline-2026/plan.md`](./docs/ethonline-2026/plan.md) and the build
  log [`docs/ethonline-2026/build-log.md`](./docs/ethonline-2026/build-log.md)
  are included as required.
- **Implementation.** Code in `packages/shared/src/receipts`,
  `packages/api/src/receipts`, `packages/sdk/src/receipts.ts`, the receipt
  routes, the migration, the receipts UI and the documentation was written
  with AI assistance under the maintainer's direction, then read, run and
  adjusted by the maintainer. Each slice went through an independent
  code-review pass whose findings were fixed before commit.
- **Verification.** Unit and API tests (shared, api, sdk), Biome, TypeScript
  and the production migration were run before each commit. The testnet
  demonstration referenced by the submission is run by the maintainer against
  the deployed API; its transactions are real Arc Testnet transactions.
- **Not AI-generated.** The submission video is narrated by the maintainer.
  No credentials, hidden instructions or private material are included in the
  repository.

## Licence

New code follows the repository's existing split: the hosted application
(`apps/*`, `packages/api`, `packages/shared`, `packages/db`, `packages/auth`,
`packages/indexer`) is AGPL-3.0 under the root `LICENSE`; `packages/contracts`
and the SDKs are Apache-2.0 under their own `LICENSE` files so they stay
importable. Nothing was relicensed.
