# Arcanum: ETHOnline 2026 Hackathon Plan

**Updated:** 7 September 2026  
**Timezone:** Asia/Kolkata (IST)  
**Track:** Extend Open Source, under the Continuity tracks  
**Submission deadline:** Sunday, 13 September 2026, 9:30 PM IST  
**Status:** Planning document. Implementation and deployment are not marked complete.

This is the current, narrowed plan. It replaces the earlier proposal to combine
denial-event changes, ERC-8004, x402, Circle Marketplace and mainnet deployment
in one submission. Those ideas are listed under **Deferred work**, not treated
as requirements for this build.

Updating this document does not start implementation, create project tasks,
change contracts, move funds or authorize publishing.

## 1. Project and submission identity

| Field | Value |
|---|---|
| Project name | ARCANUM |
| Category | Wallet/Payments |
| Project emoji | 🛡️ |
| Existing application | https://thearcanum.in |
| Public repository | https://github.com/bunnyyxtan/ARCANUM |
| Development strategy | Existing repository, with an `ethonline-2026` branch |
| New feature | Payment Decision Receipts |
| Demonstration network | Arc Testnet |
| Event dates | 4–16 September 2026 |
| Submission deadline | 13 September, 12:00 PM EDT, equivalent to 9:30 PM IST |

The event continues after the submission deadline. Do not mistake 16 September
for the deadline to upload the project.

The live event page explicitly offers **From Scratch**, **Extend Open Source**
and **Ship a Feature**. The generic “start from scratch” wording in the project
creation form does not describe every track.

Arcanum is an existing project. Use the Continuity route and disclose that
history. Copying existing Arcanum code into a new repository would not make it
a From Scratch submission.

## 2. What we are building

Add a complete receipt workflow around an agent's payment request:

1. The agent signs a request.
2. Arcanum evaluates it against the wallet's policy and chain state.
3. Arcanum saves and signs a receipt describing that evaluation.
4. The owner can inspect the request, verdict, reason and supporting state.
5. If the request is subsequently submitted onchain, the receipt can show
   validated execution or approval evidence.

The owner should be able to answer:

- What did the agent request?
- Which signer requested it?
- Why was it allowed, blocked, frozen or sent for review?
- Which policy and chain state were used for that evaluation?
- Was a payment actually submitted, and did funds move?
- Has the receipt been altered?

**Working description for the new feature:**

> Payment Decision Receipts preserve an agent's signed request, Arcanum's
> policy evaluation and any later execution evidence in one inspectable record.

This is new functionality on top of the existing wallet, not a claim that
wallet creation, spending limits, simulation or approvals were built during
this hackathon.

## 3. Existing code versus new work

These findings are based on source inspection. This planning pass did not
rerun the application, contracts or test suite.

| Area | Present in inspected code | New work in this plan |
|---|---|---|
| Guarded wallets | USDC custody, authorised signers and policy enforcement | Reuse without changing contract semantics |
| Spending policy | Caps, vendor controls and escalation decisions | Preserve the state used for each evaluation |
| Human review | Onchain approval and rejection paths | Link actual review evidence to the corresponding receipt |
| Payment preflight | Signed request verification and policy evaluation | Persistent, issuer-signed decision snapshots |
| Ledger and events | Existing read-model routes and transaction views | Receipt history and detail views |
| Request signing | An agent signature covers the payment-intent payload | Verify both request authenticity and receipt authenticity |
| Denied transfers | Contract DENY reverts without a persistent denial event | Explicitly offchain receipts for denied preflight requests |

The current `paymentIntents.create` endpoint evaluates a request and returns
a result. It does not itself execute a transfer or persist the new receipt
described here.

Before coding, establish the actual pre-event baseline from repository history.
Do not assume everything in the current checkout was created during the event.

## 4. Trust model and non-negotiable distinctions

### A. An agent signature is not a signature of Arcanum's verdict

The existing agent signature proves who signed the request and what was
requested. It does not prove that the API's policy evaluation is correct.

The new receipt should have a separate Arcanum issuer signature covering a
canonical, versioned decision snapshot. Verification must distinguish:

- **Request signature:** the agent signed these request fields.
- **Receipt signature:** the configured Arcanum issuer attested to this snapshot.
- **Chain evidence:** the referenced transaction or event exists and matches
  the relevant wallet operation.

An issuer-signed receipt is an attestation, not a trustless onchain proof that
every calculation was correct. A digest by itself is not an authenticity proof.

### B. Preflight is not settlement

| Preflight result | Correct meaning | Must not imply |
|---|---|---|
| ALLOW | The evaluated request passed the checked policy at the recorded state | The vendor has been paid |
| DENY | The evaluated request was blocked, with a recorded reason | A denial event was emitted onchain |
| ESCALATE | The evaluated request needs human review | An onchain review request already exists |
| FREEZE | The evaluation reports a frozen/blocked wallet condition | This API call itself froze the wallet |
| Validation error | The request could not be evaluated successfully | A valid policy rejection |
| Unsupported | The requested chain/token/input is not supported | A completed or attempted payment |

The wallet reevaluates actual execution against its execution-time state.
Policy, balances or spending totals can change after a receipt is issued.
Preserve the original snapshot and display the later result separately.

### C. A revert does not preserve emitted logs

The current DENY path has no persistent denial event. A transaction that was
actually broadcast can still have a failed transaction receipt onchain; that
is different from a structured denial event or a saved preflight receipt.

Do not claim that every denied API request has an onchain record. Do not change
the wallet from reverting to returning success merely to produce a log.

### D. A receipt never authorizes a transfer

Receipts are evidence and inspection tools. They must not become a spending
credential, bypass signer checks or allow the API server to approve payments.

## 5. Functional scope

### 5.1 Receipt creation and policy snapshot

- Reuse the existing signed payment-intent format and policy-evaluation code.
- Add an explicit receipt-aware API/SDK operation. Preserve the existing
  read-only preflight endpoint's public behavior rather than silently turning
  every existing call into a database write.
- Verify the signature and the caller's right to create a wallet-scoped record.
- Pin all relevant chain reads and evaluation to one block.
- Record the block number, block hash and evaluation timestamp.
- Include the policy, vendor state and effective spending counters needed to
  explain the result, or a precise reference plus a retained snapshot.
- Check parity with the wallet's execution logic, including spending-window
  resets. A consistent block does not fix an incorrectly reconstructed policy.
- Return explicit errors when the RPC, database or signing service fails.
  Do not substitute an ALLOW or a synthetic valid DENY.

The existing `policyReference` containing only a wallet address is not enough
to identify the historical policy used in a receipt.

### 5.2 Receipt payload and signatures

The proposed payload includes:

- Receipt/schema version and receipt ID.
- Canonical request digest and the original signed request.
- Chain ID, wallet address, agent signer, vendor and token.
- Amount in exact integer base units, with its display amount.
- Request purpose and idempotency key.
- Decision, reason code and human-readable explanation.
- Evaluation timestamp, block number and block hash.
- Policy/state snapshot or its retained, verifiable reference and digest.
- Issuer key ID and receipt signature.

Use exact decimal handling. Arc's USDC ERC-20 interface uses six decimal
places; native gas-denominated values use a different convention. Do not mix
them, use floating-point money arithmetic or add new token support here.

Use a standard signing implementation, such as Node's Ed25519 support, with
deterministic canonical serialization. Do not invent a custom signature scheme.
Keep signing keys in secure configuration, separate from session secrets and
wallet private keys. Publish versioned verification keys and retain the public
keys needed to verify older receipts. Never commit or print private keys.

An unavailable signing key must produce an explicit failure, not an unsigned
receipt labelled verified.

### 5.3 Persistence and idempotency

- Use the existing persistence system and project conventions.
- Do not replace Supabase or introduce a different database for this feature.
- Keep issued decision snapshots immutable.
- Store later transaction and approval observations separately as lifecycle
  evidence; do not rewrite what the original evaluation said.
- Make retries idempotent within a chain/wallet/signer/request-key namespace.
- The same key and same canonical request return the same issued receipt.
- The same key with a different payload returns an explicit conflict.
- A fresh evaluation uses a new request key and produces a new snapshot.
- Never trigger a second payment while retrying receipt creation or lookup.
- A database failure must not be reported as “receipt saved.”

Do not retroactively manufacture signed receipts for historical events. Old
ledger records are not evidence that this new feature existed previously.

### 5.4 Access control and privacy

- Receipts are private by default.
- Reuse the application's existing authentication and wallet-role checks.
- Define and test access for owners, relevant signers and configured reviewers;
  do not grant every authenticated account access to every wallet.
- Roles may share an address. Do not assume three distinct people are enforced.
- Invalid signatures or unrelated unauthorised callers must not create trusted,
  user-visible receipts for someone else's wallet.
- Preserve rate limits and fail-closed behavior.
- Do not leak private purposes, signatures or wallet activity through an
  unauthenticated lookup or easily guessed receipt identifier.

Public sharing, anonymous receipt directories and a new invitation system are
not required for this submission.

### 5.5 Receipt history, detail and verification

Build a usable frontend, not only an API:

- Receipt list with wallet, amount, verdict, time and later payment status.
- Detail view showing the signed request, decision explanation and state used.
- Separate indicators for request-signature verification, receipt-signature
  verification and any available chain evidence.
- Clear states for loading, no receipts, errors, invalid signatures, stale
  evaluations and unavailable chain evidence.
- Authorised JSON export containing the verification payload.
- A verification function usable independently of the rendered receipt page.

Verification must report tampering or an unknown issuer key honestly. Do not
silently trust a public key supplied inside an untrusted receipt.

### 5.6 Execution and approval linkage

- Use the existing wallet execution and reviewer flows.
- Capture the actual transaction/escalation reference produced by the request's
  execution flow.
- Verify chain, wallet, caller, recipient, amount and relevant decoded call or
  event data before attaching evidence.
- Do not search for a similar amount and assume it is the matching payment.
- Do not claim the receipt ID is cryptographically committed onchain unless
  the deployed contract interface actually provides that binding.
- Describe the association method accurately when existing contracts do not
  include a receipt identifier.
- Show submitted, pending, held for review, rejected, expired, failed and
  confirmed payment states separately where applicable.
- Treat delayed indexing as pending evidence, not an empty or successful result.
- A successful transaction may create an escalation or freeze rather than
  transfer USDC. Mark a payment paid only after validating settlement evidence.

Approval/rejection must still happen through authorised onchain paths. The
receipt API must not introduce a server-side substitute for reviewer approval.

## 6. Repository and architecture touchpoints

Start with these existing files:

| Path | Purpose |
|---|---|
| `arcanum/packages/api/src/routers/payment-intents.ts` | Existing signature checks and preflight evaluator |
| `arcanum/packages/shared/src/schemas/payment-intents.ts` | Signed input format and verdict/result schema |
| `arcanum/packages/api/src/routers/ledger.ts` | Existing ledger read-model behavior |
| `arcanum/packages/api/src/routers/escalations.ts` | Existing review reads and onchain-write boundaries |
| `arcanum/packages/contracts/src/GuardedWallet.sol` | Reference for actual execution and revert semantics |
| `arcanum/packages/contracts/src/EscalationManager.sol` | Reference for approvals, rejection and execution |
| `arcanum/packages/contracts/src/libraries/Events.sol` | Existing event evidence available to link |
| `arcanum/packages/sdk/README.md` | Existing preflight/execution distinction |
| `arcanum/apps/web` | Locate and extend current wallet, ledger and execution views |

Locate the actual database schema, auth helpers, SDK implementation and tests
before choosing new filenames. Keep new receipt modules focused instead of
putting the entire feature into an existing large router or component.

The architecture diagram should distinguish these paths:

```text
Agent-signed request
        |
Receipt-aware API
        |
Pinned-block policy evaluation
        |
Issuer-signed snapshot -> Existing database -> Receipt UI / verifier

Separate existing execution path:
Authorised signer -> GuardedWallet -> USDC transfer OR onchain review
                                          |
                             Verified execution/review evidence
                                          |
                              Receipt lifecycle observations
```

Mark the API, database and issuer attestation as offchain. Mark wallet execution
and reviewer transactions as onchain.

## 7. Work sequence and target dates

This schedule assumes implementation starts on 7 September. It is a target,
not a claim that any milestone has already been completed.

| Dates | Work | Exit condition |
|---|---|---|
| 7–8 September | Establish baseline and branch; define canonical receipt; implement signing, storage and API | A supported signed request creates one persistent, verifiable receipt; tampering and conflicts are detected |
| 9–10 September | Receipt history/detail, verification UI, SDK and execution/review associations | The complete user journey works in the app with real testnet evidence |
| 11 September | Security, integration and failure-case checks; fix issues | No false paid/reviewed/verified states; negative cases pass |
| 12 September | Architecture diagram, setup documentation, disclosure and demo recording | Submission package is complete and understandable without assistance |
| 13 September | Final link/access/video checks and submission | Submitted before 9:30 PM IST, preferably with several hours of buffer |

Write the new-versus-existing notes and demo outline alongside development,
not after the feature is finished.

If implementation starts later or a dependency is blocked, reassess scope
explicitly. Do not silently drop signature verification, access control,
truthful status handling or disclosure to meet the date.

## 8. Test and acceptance checklist

### Unit and API checks

- [ ] Canonical serialization is deterministic.
- [ ] Altering the request, amount, recipient, chain, verdict or reason breaks
      the corresponding verification.
- [ ] Agent signatures and issuer signatures are checked independently.
- [ ] Unknown issuer keys are not silently trusted.
- [ ] Exact integer USDC amounts survive request, storage, signing and display.
- [ ] Pinned-state preflight agrees with contract behavior, including window
      reset boundaries and frozen-wallet conditions.
- [ ] Same-key retries return one receipt; conflicting payloads fail.
- [ ] Invalid signatures and unauthorised wallet access fail.
- [ ] RPC, database and signing failures do not create false success states.

### Execution and UI checks

- [ ] ALLOW preflight is not shown as paid.
- [ ] ESCALATE preflight is not shown as an already-created review.
- [ ] DENY preserves a receipt without moving funds.
- [ ] A later policy change does not rewrite the original receipt.
- [ ] Actual reviewer approval/rejection and execution are reflected correctly.
- [ ] A wrong transaction, wallet, recipient or amount cannot be attached as
      matching evidence.
- [ ] A successful non-payment transaction is not displayed as a payment.
- [ ] Rejected/failed transactions and delayed indexing remain distinguishable.
- [ ] Private receipts cannot be read by unrelated users.
- [ ] JSON export verifies independently; modified exports fail verification.
- [ ] Existing stateless preflight and wallet execution remain compatible.

Use the existing project lint, typecheck, tests and build checks. Validate the
materially changed end-to-end payment/approval journey in one focused pass.
No checks are recorded as passed until they have actually run.

## 9. Demonstration and video

Use real Arc Testnet requests and transactions. Do not use production funds,
invent transaction hashes or pass off seeded UI data as chain activity.

### Required demonstration

1. **Allowed:** an agent request gets a receipt, then actually settles through
   the existing wallet path. Show separate evaluation and payment evidence.
2. **Denied:** a request is blocked. Show its saved reason, verified receipt
   and that the flow did not transfer funds.
3. **Escalated:** a request requires review, is submitted to the onchain queue,
   is approved by the configured quorum, and then settles.

If verification is demonstrated by altering an exported receipt, label that
alteration as a tamper test, not a second real payment request.

### Suggested recording outline

| Time | Content |
|---|---|
| 0:00–0:20 | Problem and a brief introduction |
| 0:20–0:40 | What already existed and what was built during this event |
| 0:40–1:15 | Allowed request and confirmed payment |
| 1:15–1:50 | Denied request and saved decision receipt |
| 1:50–2:45 | Review-required request, approval and settlement |
| 2:45–3:15 | Receipt verification and the offchain/onchain distinction |
| 3:15–3:40 | Architecture, Arc/USDC usage and where to inspect the source |

### Official video constraints

- Between 2 and 4 minutes.
- At least 720p.
- Human narration; no text-to-speech or AI voiceover.
- Do not speed up the recording to fit the limit.
- Do not record the submission using a mobile phone.
- Do not replace narration with music and explanatory text.
- Waiting can be edited out.
- If using slides, keep to at most four bullet points per slide.

For live judging, prepare a four-minute demonstration and three minutes of
questions. Explain design tradeoffs, the new work and actual tool usage.

### What judges evaluate

- **Technicality:** the difficulty of the problem and the quality of the solution.
- **Originality:** what is genuinely new or a useful new approach.
- **Practicality:** whether the feature actually works for its intended user.
- **Usability:** whether the UI and developer workflow are understandable.
- **Wow factor:** a memorable, demonstrable result rather than unsupported claims.

For most asynchronous events, an initial asynchronous round screens projects
for live judging; the guidance says typically the top 20% advance. That is not
a guarantee of this project's selection. The initial screening does not
determine partner-prize eligibility, and partners judge asynchronously.

## 10. Prize strategy

### Primary target to assess

**Arc: Best DeFi or Agentic Application, Continuity track.**

The listed prize pool is **$1,666**, not a guaranteed payout to this project.
The page includes conditional payments, automation, payments and treasury
infrastructure using Arc and USDC. A working governed-payment receipt journey
is a reasonable submission direction to assess against those requirements.

Qualification still depends on the actual implementation and organizer review.
Required materials include:

- A functional frontend and backend.
- An architecture diagram.
- A video demonstration/presentation.
- Detailed documentation.
- An accessible repository.
- Continuity Project registration for this particular prize.

Do not claim eligibility or an award merely because the base app runs on Arc.

### Other tracks and partners

- The separate **Best Agentic Economy Application with Circle Agent Stack**
  prize expects actual qualifying Agent Stack use. USDC usage alone is not
  proof of that integration.
- Mainnet launch prizes have separate conditions. Mainnet deployment is not
  part of this feature or a universal requirement for every Arc prize.
- Do not add Chainlink, ENS or another partner purely to fill submission slots.
  Their actual qualifying functionality would need a separately scoped build.
- ETHGlobal permits up to **three partner selections**. Multiple prize tracks
  under one partner count as one partner selection, not multiple slots.
- Name only the prize tracks the delivered work actually addresses.
- Decide Finalist consideration versus Partner Prizes Only based on the final
  submission and applicable rules. Continuity status alone does not justify
  assuming automatic finalist ineligibility or guaranteed partner eligibility.

Do not reuse the earlier plan's unsupported estimates of competition,
placement odds or expected winnings.

## 11. Repository history, disclosure and submission hygiene

### Repository strategy

- Use the existing public repository and an `ethonline-2026` branch.
- Verify the checkout's actual repository identity before making changes.
- Preserve the existing history.
- Record the actual pre-event baseline commit and document what existed.
- If creating a baseline tag, point it to the genuine historical commit.
  Do not label today's tip as if it existed before the event.
- Make incremental commits as work happens, with real dates.
- Do not squash everything into a final code dump or rewrite history to make
  pre-existing work appear newly built.

The project's previous public-export/replay convention is not suitable as
proof of development chronology. For this submission, preserve authentic
provenance and accurate attribution rather than re-authoring a public replay.
Do not export secrets or unrelated private material.

### Written disclosure

Prepare a pre-existing-work document, such as `PRE-EXISTING.md`, containing:

- Existing application and repository links.
- The actual historical baseline.
- Wallets, policy enforcement, preflight and review functionality that existed.
- A separate list of the receipt functionality built during the event.
- Relevant source paths and commits supporting the distinction.

Explain old and new work in the submission description and demo as well.
The general rules also require written disclosure of pre-existing work to the
ETHGlobal team. Complete that organizer-facing disclosure; a README alone is
not a substitute.

### AI usage and open source

- Disclose which code, files or assets were AI-assisted and how.
- Explain the team's actual design, implementation and verification
  contributions. Do not invent manual authorship.
- Projects relying entirely on AI without meaningful team contributions may
  be ineligible for partner prizes or finalist consideration.
- If a spec-driven workflow is used, include relevant specs, prompts and
  planning artifacts required by the rules.
- Never include credentials, hidden system instructions, unrelated private
  conversations or other sensitive material in the submission.
- Keep new work open source and follow the repository's existing licence split.
  Do not relicense unrelated components as part of this feature.

## 12. Submission package checklist

- [ ] Project identity, category and emoji entered.
- [ ] Correct Continuity/Extend Open Source registration.
- [ ] Public repo and event branch available to judges.
- [ ] Genuine baseline and pre-existing/new-work disclosure.
- [ ] Setup instructions and a reproducible testnet walkthrough.
- [ ] Receipt trust model and limitations documented.
- [ ] Architecture diagram with clear onchain/offchain boundaries.
- [ ] Working frontend and backend for the new feature.
- [ ] Real, accessible testnet evidence from the demonstration.
- [ ] 2–4 minute human-narrated video at 720p or higher.
- [ ] Accurate AI-use disclosure and required planning artifacts.
- [ ] Applicable Arc prize track named with an explanation of actual usage.
- [ ] Finalist/partner selection checked against current eligibility rules.
- [ ] All links, access permissions and video playback checked.
- [ ] Submission completed before 13 September, 9:30 PM IST.

Deployment, transaction and video links for the new feature must be filled
from real completed work. The existing app URL does not prove that the planned
receipt feature is deployed.

## 13. Deferred work and explicit exclusions

| Item | Why it is outside this submission scope |
|---|---|
| Non-reverting `TransferDenied` contract path | Changes established contract/caller semantics and would require separate deployment and compatibility work |
| ERC-8004 agent identity and reputation | Separate product integration; not needed to deliver receipts |
| x402 payment execution | Additional payment protocol, settlement and vendor-service work |
| Circle Agent Marketplace listing | External integration/approval dependency; not proof of functionality by itself |
| Circle Agent Wallets beneath GuardedWallet | Adds an unnecessary custody/control layer. (A Circle developer-controlled wallet as the agent's *signer*, with funds and policy still in GuardedWallet, was added later as `arcanum-sdk/circle`; see `docs/CIRCLE-WALLETS.md`) |
| Arc mainnet deployment | Separate operational and security decision; this demo uses testnet |
| Chainlink/ENS or other partner integration | Must solve a real additional need and qualify independently |
| Invoice/merchant onboarding product | Adds another user and payment lifecycle |
| Expiring signer/session-key delegation | New contract permission design and security review |
| Public receipt directory and anonymous sharing | Extra privacy, abuse-prevention and access-control surface |
| UI redesign or framework/database migration | Not needed for the focused feature |

These ideas are deferred, not claimed to be implemented or required before
submitting this receipt workflow.

## 14. Definition of done

This feature is ready for submission when a reviewer can:

1. Use a supported, authorised agent request to produce a persistent receipt.
2. Verify the request signature and the Arcanum receipt signature separately.
3. Inspect the reason and historical state behind the preflight verdict.
4. Distinguish the preflight decision from actual review and settlement.
5. Follow validated evidence for a completed or reviewed request.
6. See tampering, access failures and unavailable evidence reported correctly.
7. Reproduce the allowed, denied and escalated testnet demonstrations.
8. Identify exactly which work existed before the event and which work is new.

No contract rewrite, mainnet transaction, prize award or additional integration
is required by this definition of done.

## 15. Sources and reference material

Official sources checked on 7 September 2026:

- Event dates and available tracks:
  https://ethglobal.com/events/ethonline2026
- Submission, judging, AI and video requirements:
  https://ethglobal.com/events/ethonline2026/info/details
- General rules:
  https://ethglobal.com/rules
- Arc prize requirements:
  https://ethglobal.com/events/ethonline2026/prizes/arc
- Chainlink prize requirements, relevant only if future scope changes:
  https://ethglobal.com/events/ethonline2026/prizes/chainlink
- ENS prize requirements, relevant only if future scope changes:
  https://ethglobal.com/events/ethonline2026/prizes/ens

The extracted submission page and its eight example-project links are saved at:

`research/ethonline2026/submission-and-judging-details.md`

Wallet-related examples listed by the organizer:

- Splits: https://ethglobal.com/showcase/splits-u1zjx
- Umbra: https://ethglobal.com/showcase/umbra-wsugm

Use examples to understand presentation, not as a claim that their code or
features belong to this submission. Recheck current official rules before
submission; this plan does not guarantee eligibility or override organizers.