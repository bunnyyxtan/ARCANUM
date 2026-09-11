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
| Event work in one view | [compare `pre-ethonline-2026...ethonline-2026`](https://github.com/bunnyyxtan/ARCANUM/compare/pre-ethonline-2026...ethonline-2026); the same diff as review-only pull request [#6](https://github.com/bunnyyxtan/ARCANUM/pull/6), whose base branch is frozen at the tag |
| Existing application | https://thearcanum.in |
| Deployed feature | [`/receipts`](https://thearcanum.in/receipts) (dashboard, wallet sign-in), [`/verify`](https://thearcanum.in/verify) (public verifier), [`/api/receipts/issuers`](https://thearcanum.in/api/receipts/issuers) (issuer registry) |
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
| `1a3168d` `docs: payment decision receipts` | `docs/PAYMENT-RECEIPTS.md`, README and SDK README sections, docs-site concept page, `.env.example` entries, `docs/ethonline-2026` planning artifacts, this file |
| `de3b12d`, `0b488d0`, `19a6b7c` `docs: …` | deployment record, the AI-use disclosure below, the version-control note |
| `46aa164` `fix: verify receipts in the sdk before acting on them` | the SDK verifies issuer signature, digest and request signature and binds the receipt to the intent it just signed; `receiptIssuers` config; `RECEIPT_UNVERIFIED` / `RECEIPT_MISMATCH` |
| `440674e` `fix: fail closed on replayed receipts during execution` | a replayed receipt is not executed unless `executeReplayedReceipt` is passed |
| `7ddaed0` `fix: resolve the issuer after the replay check` | replays no longer need the signing key |
| `5a1706d` `fix: confirm the pinned block after reading wallet state` | block hash re-checked after the pinned reads; a reorg is `CHAIN_READ_FAILED` |
| `62f29ba` `fix: match wallet events and named receipts when linking evidence` | exactly one wallet event with matching args; SDK metadata naming another receipt rejected; one transaction links to one receipt (`EVIDENCE_CONFLICT`); `deny` + revert is `verdictMatches: null`; stored rows re-digested on read |
| `52e9745` `fix: gate the receipts list on the signed-in workspace` | list waits for SIWE like the detail page |
| `67af2fb` `fix: confirm the pinned block after the policy call` | the block-hash check moved after the last pinned read, plus mismatch tests for `TransferEscalated` and `Frozen` events |
| `2941f40` `fix: require a boolean replayed flag from the receipt api` | a missing `replayed` flag is `MALFORMED_RESPONSE`, not "not replayed"; malformed envelopes surface as `ReceiptRequestError` |
| `98323f7` `chore: add the receipts testnet demo runner`, `1fc5398` `fix: stop the demo runner when the verdict differs from the scenario`, `06d408a` `fix: act on the inspected receipt in the demo runner` | `scripts/receipts-demo.ts`: the agent-runtime side of the testnet walkthrough; with `--execute` it pays only when the receipt is newly issued and its verdict is the one the scenario expects, and the transaction acts on that inspected receipt rather than on a second request |
| `efc9302` `feat: sign as the agent with a circle developer-controlled wallet` | `packages/sdk/src/circle.ts`, `circle-api.ts` and tests: the `arcanum-sdk/circle` subpath, a viem local account whose `signMessage`, `signTransaction` and `signTypedData` are delegated to a Circle developer-controlled wallet, with every answer verified before use; package exports and build entries for the subpath |
| `ee0cfed` `feat: add the circle wallet setup script` | `scripts/circle-wallet-setup.ts` (create the Circle wallet, authorize it on a governed wallet, fund gas) and the demo runner's signer switch |
| later `docs:` commits | the testnet evidence record ([`docs/ethonline-2026/demo-evidence.md`](./docs/ethonline-2026/demo-evidence.md)), the showcase submission text ([`docs/ethonline-2026/submission.md`](./docs/ethonline-2026/submission.md)), the README event section and this file; every one of them is in the compare view above |

The `fix:` commits are the hardening pass of 2026-09-10, described as
decisions 18–23 in [`docs/ethonline-2026/build-log.md`](docs/ethonline-2026/build-log.md).
The two Circle commits of 2026-09-11 are decision 24: a Circle
developer-controlled wallet becomes the agent's signer and nothing else;
custody, policy and evidence are unchanged ([`docs/CIRCLE-WALLETS.md`](./docs/CIRCLE-WALLETS.md)).

Nothing in `packages/contracts` changed. Receipts sit beside the existing
preflight: the contract still decides at execution time and the receipt
records what the policy said at a pinned block beforehand. The existing
`paymentIntents.create` preflight gained one correction as a side effect
(a zero vendor address is now reported as a validation error instead of being
sent on to policy evaluation); its behaviour is otherwise unchanged.

## Version control and dependencies

- The repository history is the original one: the baseline tag points at the
  genuine pre-event commit, nothing was squashed or rewritten, and the
  timestamps are the real ones. Later commits on the branch (deployment
  record, disclosure, demo links, fixes) continue that history.
- The five feature commits are one per slice, made after that slice's tests
  and review pass, which is why they are large. Everything after them is one
  commit per change: one fix per review finding with its failing test first,
  one docs change per topic, one evidence entry per testnet run, and the
  Circle signer as one commit for the adapter and one for its setup script. The
  slice sequence and its decisions are in
  [`docs/ethonline-2026/build-log.md`](./docs/ethonline-2026/build-log.md).
- `main` was fast-forwarded to the branch tip so the deployed application
  matches it.
- No new third-party dependency was added. The feature uses libraries the
  repository already depended on (viem for EIP-191 signatures and chain
  reads, zod, tRPC, Next.js, Supabase), all declared in the package manifests;
  the Circle adapter talks to Circle's REST API with `fetch` and `node:crypto`.
  The only manifest change is `vitest` added to `packages/shared`'s
  devDependencies, at the version already in the lockfile, so that workspace's
  tests run. No starter kit or boilerplate was used.

## AI-use disclosure

Arcanum is a maintainer-owned product that was built, before and during the
event, by the maintainer directing an AI coding agent (Replit Agent). This
section answers the event's three questions in order: what the maintainer
contributed, which files the agent wrote, and where the directing artifacts
are.

### Maintainer's involvement

- **Product and scope.** The maintainer owns Arcanum: the contracts (v2
  deployed on 7 September), API, indexer, SDKs, dashboard, production
  database, deployment and domain. The maintainer chose Payment Decision
  Receipts as the one feature to build for the event, with the constraints
  that it must not change the contracts and must never become a spending
  gate.
- **Trust model and rules.** The maintainer's brief
  ([`docs/ethonline-2026/plan.md`](./docs/ethonline-2026/plan.md)) fixes the
  rules the feature is built on: an agent signature is a signature over the
  intent, not the verdict; preflight is not settlement; a revert leaves no
  logs; a receipt never authorizes a transfer; nothing is claimed that the
  API or the chain does not actually provide.
- **Direction and review.** Work was done in slices under ground rules set by
  the maintainer: no new dependencies, no scope expansion, real incremental
  commits, and lint, typecheck, tests plus a separate code-review pass before
  each commit. The maintainer reviewed each slice's result and directed the
  changes. Every design decision was made or approved by the maintainer,
  including the ones reversed after review (wallet-local escalation manager
  resolution, no deny gate on evidence, zero-recipient rejection); they are
  numbered, with reasons, in
  [`docs/ethonline-2026/build-log.md`](./docs/ethonline-2026/build-log.md).
- **Operation and demonstration.** The issuer key, the production migration
  and the deployment live on the maintainer's infrastructure and were rolled
  out under the maintainer's authority. The testnet demonstration referenced
  by the submission is run by the maintainer against the deployed API; its
  transactions are real Arc Testnet transactions. The submission video is
  narrated by the maintainer.

### Attribution: what the agent wrote

All code, tests, migration and documentation changed on the event branch
(`git diff pre-ethonline-2026..ethonline-2026`) were written by the AI agent
under the direction described above. The maintainer did not hand-write files
in this diff. Specifically:

- `packages/shared/src/receipts/**`: schema, canonical JSON, digests, EIP-191
  signing, issuer registry, verifier and their tests.
- `packages/api/src/receipts/**` and `packages/api/src/routers/receipts.ts`,
  plus the touched `chain.ts`, `router.ts`, `server.ts`, `trpc.ts`,
  `supabase/client.ts`, `routers/payment-intents.ts` and the test adjustments
  in `routers/*.test.ts`.
- `apps/web/app/api/receipts/**` (REST routes),
  `apps/web/app/(dashboard)/receipts/**`, `apps/web/app/(public)/verify/**`,
  `apps/web/lib/receipts.ts` and the navigation entries in
  `apps/web/components/**`.
- `packages/sdk/src/receipts.ts` and the touched `client.ts`, `errors.ts`,
  `index.ts`, `types.ts`, `receipts.test.ts`.
- `packages/sdk/src/circle.ts`, `circle-api.ts`, `circle.test.ts`, the
  `./circle` entries in the SDK manifest, tsup config and `rewrite-dts.mjs`;
  `scripts/circle-wallet-setup.ts` and the signer switch in
  `scripts/receipts-demo.ts`.
- `supabase/migrations/20260910120000_payment_receipts.sql`.
- Documentation: `docs/PAYMENT-RECEIPTS.md`, `docs/CIRCLE-WALLETS.md`,
  `docs/ethonline-2026/*`, the README and SDK README sections,
  `apps/docs/pages/concepts/receipts.mdx`, `apps/docs/pages/api-reference.mdx`,
  `apps/docs/pages/sdk/typescript.mdx`, the `.env.example` entries, the CI
  workflow change, and this file.

The code-review pass on each slice was performed by a second AI reviewer
working from the diff, and its findings were fixed before commit. Unit and
API tests (shared, api, sdk), Biome and TypeScript were run before each
commit; the migration was applied to production before the feature was
deployed. The pre-existing codebase listed above was developed the same way.

### Spec-driven artifacts

The feature was directed through two documents that are included in the
repository as required:

- [`docs/ethonline-2026/plan.md`](./docs/ethonline-2026/plan.md): the brief,
  with scope, trust model, out-of-scope list and submission requirements.
- [`docs/ethonline-2026/build-log.md`](./docs/ethonline-2026/build-log.md):
  the working record, with the numbered design decisions and their reasons,
  the receipt envelope and the slice status.

Direction between those documents happened in interactive sessions with the
agent; those conversational prompts are not reproduced verbatim in the
repository, and the two documents are the written record of that direction.
No credentials, hidden instructions or private material are included in the
repository.

## Licence

New code follows the repository's existing split: the hosted application
(`apps/*`, `packages/api`, `packages/shared`, `packages/db`, `packages/auth`,
`packages/indexer`) is AGPL-3.0 under the root `LICENSE`; `packages/contracts`
and the SDKs are Apache-2.0 under their own `LICENSE` files so they stay
importable. Nothing was relicensed.
