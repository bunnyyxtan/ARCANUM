# ETHOnline 2026 build log: payment decision receipts

The working record kept while the feature was built, included as a planning
artifact for the submission. Slice status and the design decisions below are
the ones the code follows; [`plan.md`](./plan.md) is the brief they came from,
and [`../PAYMENT-RECEIPTS.md`](../PAYMENT-RECEIPTS.md) is the resulting
documentation.

Ground rules for the branch: real, incremental commits with real dates; no
new npm packages; every slice runs lint, typecheck and tests in the touched
workspaces and an independent code-review pass before it is committed.

## Feature: Payment Decision Receipts

An issuer-signed, immutable snapshot of one policy evaluation for one
agent-signed payment intent, pinned to one Arc block, with lifecycle evidence
appended later from verified chain data.

### Decisions

1. **Signing scheme.** Both signatures in a receipt are EIP-191
   `personal_sign` signatures verified with viem:
   - request signature: agent signer over `createPaymentIntentMessage(request)`
     (existing `ARCANUM_PAYMENT_INTENT_V1` format, unchanged);
   - receipt signature: issuer key over
     `ARCANUM_PAYMENT_RECEIPT_V1\n<receiptDigest>` where
     `receiptDigest = sha256(utf8(canonicalJson(receipt body)))`.
   Why: one standard scheme, verifiable with any EVM tooling (viem, ethers,
   cast) in browser, Node and Python; no WebCrypto Ed25519 availability
   question; issuer identity is an address that can later be registered
   onchain. The plan's Ed25519 mention was an example ("such as").
2. **Canonical serialization.** RFC 8785 (JCS) subset: object keys sorted by
   UTF-16 code units, no whitespace, strings escaped as `JSON.stringify`,
   numbers limited to safe integers, no `undefined`/NaN/bigint (throws).
   All uint256 values are decimal strings.
3. **Issuer key registry.** `packages/shared/src/receipts/issuers.ts` holds
   the public list `{ keyId, address, network, validFrom, retiredAt }`.
   Verifiers resolve the issuer by `keyId` from the trusted list and never
   trust an address embedded in the receipt. Private key env:
   `ARCANUM_RECEIPT_ISSUER_PRIVATE_KEY` (0x-prefixed secp256k1 key). If the
   configured key's address is not registered, issuance fails explicitly
   (`RECEIPT_ISSUER_NOT_REGISTERED`); no unsigned or "dev" receipts.
4. **Idempotency key = the signed `reference` field.** Namespace
   `(chain_id, wallet_address, agent_signer_address, reference)`. Same key +
   same request digest → the stored receipt is returned (`replayed: true`).
   Same key + different digest → `CONFLICT` (`REQUEST_KEY_CONFLICT`). A fresh
   evaluation needs a new reference and therefore a new agent signature, so a
   captured signed intent cannot be replayed into new receipts.
5. **Receipts are issued only for policy decisions** `allow | escalate | deny |
   freeze`. Input problems (bad chain/token/amount, signature mismatch) and
   infrastructure failures (RPC, DB, signing) are explicit errors and persist
   nothing. A signer that is not an authorised `agentSigners` entry at the
   pinned block gets `FORBIDDEN` (`AGENT_NOT_AUTHORIZED`) and no receipt: an
   unrelated caller must not be able to file receipts under someone's wallet.
   A wallet unknown to the read model gets `NOT_FOUND` (`WALLET_NOT_REGISTERED`).
6. **Pinned evaluation.** `getBlock(latest)` once → every `readContract` uses
   that `blockNumber`; record number, hash, timestamp. Spend counters are
   rolled the way `GuardedWallet._rollSpendWindow` does at the block
   timestamp (`day = ts / 86400`, `month = ts / (30*86400)`; counter is 0 when
   the stored index differs). Effective counters feed `PolicyEngine.evaluate`
   exactly as `executeUSDC` would. Snapshot records policy, policyVersion,
   module addresses, signer authorisation, frozen flag, vendor record,
   raw + effective counters + window indices, USDC balance.
7. **Storage.** Supabase tables `payment_receipts` (immutable: trigger rejects
   UPDATE/DELETE) and `payment_receipt_evidence` (append-only). RLS follows
   the repo convention, not the plan's member-SELECT idea: RLS enabled, all
   privileges revoked from `anon`/`authenticated`, service role only, and the
   API enforces access (there is no Supabase-auth JWT in this app, so a
   member policy would never match). FKs are `on delete restrict`. New client
   method `insertRows` (plain POST, no merge-duplicates) so a unique-key race
   surfaces as 409 instead of an overwrite.
8. **Evidence linkage.** Contracts carry no receipt id. Evidence is attached
   by transaction hash: the server fetches the tx + receipt, requires
   `tx.to == wallet`, `tx.from == agent signer`, decodes `executeUSDC`
   calldata (`to`, `amount` must match) and the wallet's
   `TransferExecuted` / `TransferEscalated` / freeze event (wallet, signer,
   recipient, amount must match). The SDK puts `receiptId` in the reason
   metadata so the calldata names the receipt; recorded as
   `calldataNamesReceipt: true|false`, described honestly (contract does not
   validate it). No amount-similarity matching, ever. Escalation outcomes are
   read from `EscalationManager.getEscalation` and appended as evidence when
   terminal. Indexer rows (`ledger_events` by chain/tx) are a cross-check
   shown as "indexed" vs "pending indexing".
9. **Access.** `create` and `attachEvidence`: public + rate limited,
   authenticated by chain facts (agent signature + onchain signer authority /
   onchain tx facts); responses to `attachEvidence` contain only linkage
   status. `list`: session required; wallets the caller owns or is a
   workspace member of, plus receipts whose agent signer is the caller.
   `get`/`export`: same, plus escalation council members verified onchain
   (`isRequiredSigner`) for that wallet. `verify`: stateless, public.
10. **API surface.** tRPC router `receipts` for the dashboard; REST for
    machines: `POST /api/receipts` (issue), `POST /api/receipts/{id}/evidence`
    (attach), `GET /api/receipts/issuers`. Both delegate to
    `packages/api/src/receipts/` service functions; no duplicated logic.
11. **SDK.** `ArcanumClientConfig.apiUrl?`; methods `requestPaymentReceipt`,
    `attachPaymentReceiptEvidence`, `executePaymentIntentWithReceipt`;
    standalone `verifyPaymentReceipt` re-exported from shared. tsup builds
    happen in CI only.
12. **Not in scope.** Public receipt sharing, new invitations, EURC/other
    tokens, retroactive receipts for old ledger rows, server-side approval.
13. **Wallet-local escalation manager.** `GuardedWallet.rotateModule` can
    swap a wallet's manager, so the wallet's own `escalationManager()` is the
    authority: council access for `get` reads the current manager; evidence
    reads the manager at the block of the transaction. The manifest manager
    is only a default (the older `escalations` router still uses it; left
    unchanged, noted in docs). Found in code review of slice b/d.
14. **Evidence has no deny gate.** A denied receipt can still be linked: a
    reverted call = the agent ignored the verdict; an executed call = policy
    loosened after issuance (`verdictMatches: false`).
    `EVIDENCE_NOT_APPLICABLE` was removed. Unused `RECEIPT_ACCESS_DENIED`
    removed too. Amended by decision 20: a revert no longer counts as
    `verdictMatches: true` for a deny.
15. **Input rejection order.** Zero vendor address → `INVALID_RECIPIENT`
    (400) before evaluation (the contract reverts `ZeroAddress`, a receipt
    would attest nothing). Side effect: the legacy `paymentIntents.create`
    preflight now reports `validation_error` for a zero vendor instead of
    running policy; disclosed in PRE-EXISTING.md. tokenSymbol≠USDC is
    rejected only on the receipt path (`UNSUPPORTED_TOKEN`); the legacy
    preflight keeps its lenient behaviour.
16. **Timestamps.** PostgREST renders `timestamptz` as `+00:00` with a
    variable fraction; the store normalizes to `Z` at the boundary so shared
    `.datetime()` schemas (evidence `observedAt`, list cursor) accept them.
    The test fake emits PostgREST-shaped values.
17. **`orgId` is non-null.** Production `governed_wallets.organization_id`
    is NOT NULL; a wallet row without a workspace is `WALLET_NOT_REGISTERED`.

Decisions 18–23 come from the hardening pass on 2026-09-10, an adversarial
review of the finished feature that asked where the trust claims in the docs
were not enforced by the code. Each finding became its own commit with a
failing test first.

18. **The SDK verifies what it is handed.** `requestPaymentReceipt` ran
    `verifyPaymentReceipt` nowhere and executed on whatever the API
    returned. It now verifies issuer signature, digest and request signature
    and requires `requestDigest` to equal the digest of the intent it just
    signed (`RECEIPT_UNVERIFIED`, `RECEIPT_MISMATCH`). `receiptIssuers` in
    the client config overrides the bundled registry for self-hosting and
    tests. The API is a transport for receipts, not the authority on them.
19. **Replayed receipts are not executed by default.** The contract has no
    notion of a reference, so re-running `executePaymentIntentWithReceipt`
    after a replay was a second payment. A `replayed: true` receipt now
    yields `validation_error` / `RECEIPT_REPLAYED` unless the caller passes
    `executeReplayedReceipt: true`. Protection is client-side only; the doc
    says so under limitations.
20. **A revert proves nothing about why.** `verdictMatches` for a reverted
    call was `true` whenever the verdict was `deny`, which credited the
    policy for reverts caused by gas, balance or anything else. It is now
    `null` for `deny` + revert and `false` for any other verdict + revert.
21. **Evidence matches the event, not just the calldata.** The first parsed
    wallet event was accepted as-is. A successful call must now emit exactly
    one `TransferExecuted` / `TransferEscalated` / `Frozen`, and its args
    must name the receipt's wallet, signer, vendor and amount (as far as the
    event carries them). Reason bytes that carry SDK metadata naming a
    *different* receipt are rejected; free-text reasons remain neutral, per
    decision 8 (`calldataNamesReceipt` is recorded, not required).
22. **One transaction, one receipt.** Two receipts with the same wallet,
    signer, vendor and amount under different references could both claim
    the same hash. Linking now looks up existing execution rows by hash and
    answers `EVIDENCE_CONFLICT` (409) when another receipt holds it. This is
    a lookup, not a unique index: a partial unique index over
    `(tx_hash, kind)` would turn a cross-receipt race into a silently
    swallowed "duplicate" inside the idempotent insert path, which is worse
    than two visible rows. The race window is documented.
23. **Reorg check on the pinned block.** `eth_call` pins by number, so the
    snapshot could straddle a reorg with no trace. After the last pinned read
    (the policy call, not just the wallet reads; the second review caught the
    first placement) the block is fetched again by number and its hash
    compared; a mismatch is `CHAIN_READ_FAILED` and nothing is signed. The
    second review also caught that the SDK turned a missing `replayed` flag
    into `false`, which would have paid; the flag is now required to be a
    boolean and a body that is not an envelope is `MALFORMED_RESPONSE`
    instead of a raw parser error. Also from the same pass: the
    issuer key is resolved after the idempotency lookup so a replay works
    while the key is rotated; `storedReceiptFromRow` recomputes the digest
    and the store comment no longer claims a re-verification it did not do;
    the receipts list waits for SIWE like the detail page instead of showing
    a connected-but-unsigned wallet "NO RECEIPTS YET". Kept as-is:
    `ReceiptRequestError` stays a separate class from `ArcanumError` because
    API domain codes are open-ended strings and folding them into the closed
    `ArcanumErrorCode` union would loosen it for every existing caller.
24. **Circle Wallets is the agent's signer, nothing more.** A Circle
    developer-controlled wallet (EOA on the generic `EVM-TESTNET` identifier;
    Circle's `sign/transaction` refuses named-chain wallets such as
    `ARC-TESTNET` with code 156027, found on the first live run, while the
    same wallet set gives the same address on both) holds the agent's key;
    its address is authorized with `addSigner` like any other. Funds, policy,
    escalation and evidence stay where they were; no Circle policy features,
    no Circle-side broadcast, no Agent Wallets, no smart-contract account.
    The SDK adapter (`arcanum-sdk/circle`) is a viem local account that
    delegates `signMessage`, `signTransaction` and `signTypedData` to Circle
    and verifies every answer: signatures must recover to the wallet, a
    signed transaction must parse back to exactly the requested fields, and
    anything the Circle request shape cannot carry is refused rather than
    dropped. Trust model written down honestly in `docs/CIRCLE-WALLETS.md`:
    the signer's compromise surface moves from a host key to an API key plus
    entity secret, availability now depends on Circle, Circle sees signing
    payloads, and receipts cannot attest Circle provenance.

25. **CCTP funding is inbound and separate from spending.** One testnet route:
    Ethereum Sepolia to Arc, standard CCTP V2 with Circle forwarding. Quotes
    disclose the fee cap and minimum received. The source burn hash is the
    recovery identifier; status refresh never submits a second burn.
    Settlement is verified on Arc, not inferred from attestation completion.
    Browser/CLI submission guards survive ambiguous responses and reloads.
    No new custody account, contract, policy or database schema is introduced.
    Circle signs agent payments through the existing adapter; Circle
    forwarding broadcasts only the separate CCTP mint.
    If forwarding has not completed, an explicitly approved operator relay
    may submit the same attestation on Arc, without another source burn.
    The demo relay caps destination gas at 0.01 native USDC, journals the
    signed hash before broadcast and never automatically resubmits.
    Operator-supplied mint hashes are candidates for the same full settlement
    verification, not overrides of Circle or onchain evidence. Demo claims
    distinguish manual settlement from automatic forwarding.

### Receipt envelope (v1)

```
{
  "receipt": {
    "schema": "arcanum.payment-receipt.v1",
    "receiptId": uuid,
    "issuedAt": ISO-8601 UTC,
    "issuer": { "keyId": string, "address": 0x… },
    "request": { chainId, governedWalletAddress, agentSignerAddress, vendorAddress,
                 tokenAddress, tokenSymbol, amount, purpose, reference, signature },
    "requestDigest": 0x… (EIP-191 hashMessage of the intent message),
    "amountBaseUnits": decimal string,
    "decision": { "verdict": allow|escalate|deny|freeze, "reasonCode": string,
                  "explanation": string },
    "evaluation": {
      "blockNumber": decimal string, "blockHash": 0x…, "blockTimestamp": int,
      "evaluatedAt": ISO-8601,
      "policyVersion": string, "policyEngine": 0x…, "vendorRegistry": 0x…,
      "escalationManager": 0x…,
      "policy": { perTxCap, daily24hCap, monthlyCap, allowedCategories,
                  escalationThreshold, requireAllowlist, freezeOnBlockedVendor },
      "signerAuthorized": bool, "frozen": bool,
      "vendor": { allowed, blocked, category, perVendorCap },
      "spend": { spendDay, spendMonth, dailySpent, monthlySpent,
                 effectiveDailySpent, effectiveMonthlySpent, blockDay, blockMonth },
      "usdcBalance": decimal string
    }
  },
  "receiptDigest": 0x…,
  "signature": 0x…
}
```

## Slices and status

| # | Slice | Status |
| --- | --- | --- |
| 0 | Baseline branch + tag on both remotes | done 2026-09-10 |
| a | shared: canonical JSON, receipt schema, digest, sign/verify, issuer registry, tests | done, `3f69f88` |
| b | api: pinned evaluator, receipt service, router, REST routes, rate limits, tests | done, `6724ca3` (reviewed; findings → decisions 13–17) |
| c | supabase migration (tables, trigger, RLS, indexes); applied to prod via session pooler 2026-09-10; tracker row `20260910120000 payment_receipts` | done |
| d | evidence linkage (attach, escalation outcome), tests | done, `6724ca3`; indexer cross-check dropped (no value over chain reads, out of time) |
| e | web: receipts list/detail/verify, nav, export, states | done, `80cccd5` (reviewed; auth gating, verifier hardening and stale-result fixes applied before commit) |
| f | sdk: apiUrl, receipt methods, tests | done, `12c527c`; tsup/size-limit not runnable here (deps blocked), CI builds web only |
| g | docs: PRE-EXISTING.md, docs/PAYMENT-RECEIPTS.md (Mermaid, trust model, walkthrough, limitations), AI disclosure, .env.example sync, README + SDK README sections, docs/ethonline-2026 planning artifacts | done (reviewed; overclaims on tx-hash retention, key retirement and demo status corrected) |
| h | production: issuer key in Vercel env (done 2026-09-10); branch commits on `main`; production build verified 2026-09-10 (`/receipts`, `/verify`, `GET /api/receipts/issuers` on thearcanum.in) | done |
| i | demo runs on testnet (recorded in [`demo-evidence.md`](./demo-evidence.md) as each row is verified), video, submission form | runs done 2026-09-10, all rows and the tamper test recorded 2026-09-11; video and form need user |
| j | hardening pass: adversarial review of a–g, decisions 18–23, one commit per finding with a failing test first | done 2026-09-10 |
| k | Circle Wallets as the agent signer (decision 24): `arcanum-sdk/circle` adapter + tests, `scripts/circle-wallet-setup.ts`, demo runner signer switch, `docs/CIRCLE-WALLETS.md`; a Circle-signed allowed run recorded in `demo-evidence.md` | done 2026-09-11: wallet `0xbf4be36c…675c39` authorized in `0x0069221c…7a89a2`, receipt `d6cd633b-…` paid in `0x7e62f73b…d619a3` |
| l | CCTP V2 inbound funding (decision 25): browser-safe SDK, read-only quote/status API, wallet funding panel, CLI, intent-bound recovery and `docs/CCTP-FUNDING.md` | live 5 USDC settled on 2026-09-11: Sepolia burn `0xe53412c4…a28bbd9`, manually relayed Arc mint `0xe0e35685…2219103`; wallet 0.5 → 5.5 USDC, CCTP fee 0, separate relay gas 0.003565276 USDC; no reburn; automatic forwarding not proven; fixes tested and reviewed; code in `c7ea5ba`, `d7918c7`, `3f5631a`; production deployment is separate |

Test state after slices a–g: shared 18/18, api 94/94, sdk 18/18; biome +
tsc clean in shared/api/sdk/web; web `next build` passes. After slice j:
shared 18/18, api 98/98, sdk 22/22, web 34/34. Code-review subagent had two
internal failures this session before a retry succeeded; budget time for
that.

Each slice: implement → lint/typecheck/test in touched workspaces → code
review pass → fix severe findings → commit → push both remotes.
