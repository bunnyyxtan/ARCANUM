# ARCANUM — Full Production Test Blueprint

Complete test matrix for the global-launch proof pass. Target: **thearcanum.in** (prod)
plus Arc Testnet on-chain checks. Every scenario is tagged with the user type it
represents and what counts as PASS.

Verdict legend: **PASS** · **FAIL (bug)** · **KNOWN-LIMIT** (expected, user declined fix) · **BLOCKED** (needs input)

---

## 0. User types covered

| # | User | Description |
|---|------|-------------|
| U1 | Anonymous visitor | Lands on the site, no wallet, no account |
| U2 | Counterparty / vendor | Opens a shared badge or explorer link to verify an agent wallet |
| U3 | Operator (owner) | Signs in, manages doctrine, reviews ledger, approves escalations |
| U4 | AI agent (signer) | Executes payments through the GuardedWallet under doctrine |
| U5 | Anomaly oracle | Authorized key that reports anomalies / triggers freeze |
| U6 | Attacker / abuser | Tries to see or do things they shouldn't |

---

## A. Public surface (U1, U2)

| ID | Scenario | Expect |
|----|----------|--------|
| A1 | Landing page loads, light + dark (`wl-dark`) themes | Correct render, no console errors, fonts load (Fraunces/Schibsted/Plex Mono) |
| A2 | `/badge/<valid wallet>` | Badge renders from Supabase read model, posture score matches doctrine logic, back nav works |
| A3 | `/explorer/<valid wallet>` | Public ledger renders, values in USD, pagination/scroll works |
| A4 | `/badge/<garbage>` and `/explorer/<garbage>` (invalid address) | Graceful error/empty state, no crash, no stack trace |
| A5 | `/badge/<unknown-but-valid address>` | Clean "not found" state |
| A6 | `/approve/<txHash>` valid escalation link | Escalation details render for counterparty view |
| A7 | `/approve/<garbage txHash>` | Graceful failure |
| A8 | Frozen wallet's badge/explorer | FROZEN stamp visible; healthy wallet shows **no** restraint button (regression check) |
| A9 | Mobile viewport (390px) on all public pages | No overflow, readable, nav usable |
| A10 | OG/meta tags on badge + landing | Correct title/description for link sharing |
| A11 | Read model down (simulated in dev only) | "READ MODEL UNAVAILABLE" state, fails loud not blank |

## B. Auth & session (U3, U6)

| ID | Scenario | Expect |
|----|----------|--------|
| B1 | Visit `/dashboard`, `/ledger`, `/agents` etc. while signed out | Redirect to sign-in, never data leak |
| B2 | SIWE sign-in happy path | Session created, lands on dashboard |
| B3 | Dev session bypass attempted against prod | **Must be rejected** (`ARCANUM_REQUIRE_AUTH` enforced) |
| B4 | Session expiry / invalid cookie | Clean re-auth prompt, no 500 |
| B5 | Direct API route calls unauthenticated (tRPC endpoints) | 401/403, no data |

## C. Dashboard reads (U3)

| ID | Scenario | Expect |
|----|----------|--------|
| C1 | `/dashboard` — ACTION REQUIRED card | Shows only when real pending work exists (regression: no fake flag) |
| C2 | `/agents` list | All agent wallets, posture scores computed (not hardcoded 78) |
| C3 | `/agents/<id>` detail | Spending chart with value labels, signer pills aligned, doctrine summary correct |
| C4 | `/agents/<id>/policy` | Current doctrine renders: caps, allowlist, quorum, council, escalation threshold |
| C5 | `/ledger` | Rows match Supabase events; column alignment (regression: drift fix) |
| C6 | Ledger filters (status/agent/date pills) | Filtering correct, pill press feel (regression) |
| C7 | Ledger CSV export | File downloads, rows/values match on-screen data |
| C8 | Ledger print/report view | Renders printable report |
| C9 | `/escalations` | Counts correct (regression: 0-count bug), pending items listed |
| C10 | `/anomalies` | Event stream renders from read model |
| C11 | `/vendors` | Vendor list + allowlist status |
| C12 | `/status` | System/indexer health honest (no fake green) |
| C13 | `/settings`, `/docs`, `/glossary` | Render without errors |
| C14 | Whole dashboard in dark mode + mobile | Token-based theming holds, no unstyled patches |

## D. Governance writes (U3) — the doctrine lifecycle

| ID | Scenario | Expect |
|----|----------|--------|
| D1 | Edit policy: change per-tx cap → Sign & deploy | Doctrine version bumps on-chain, UI reflects new version (regression: no stuck spinner) |
| D2 | Add + remove allowlist vendor → deploy | On-chain allowlist updated, posture score shifts accordingly |
| D3 | Change quorum / council members → deploy | Reflected in policy view + posture |
| D4 | Escalation approve via `/approve/<txHash>` | Approval recorded, quorum counted, tx releases when quorum met |
| D5 | Escalation deny | Tx blocked, state final |
| D6 | Escalation expiry (time passes) | Expires cleanly, shown as expired |
| D7 | Register new agent | KNOWN-LIMIT in prod (ctx.db write) — verify it fails **loud**, not silently |
| D8 | Org settings write | KNOWN-LIMIT (dead prod DB) — fails loud |
| D9 | Vendor flag write / anomaly ack + dismiss | KNOWN-LIMIT — fails loud |

## E. On-chain enforcement (U4) — Arc Testnet, the heart of the proof

### Amount strategy — build real volume, not toy numbers

The landing page and explorer show **real** data from these tests, so test payments are
sized to produce a credible ledger, not dust:

- Use **two-digit amounts** — 40, 70, 80 USDC per payment. Never 2–4 USDC.
- Run the **maximum number of payments** the funded balance allows, spread across
  several vendors and both agent wallets, so the ledger has depth and the charts have shape.
- Vary amounts within the two-digit band so the spending chart is not a flat line.
- Cap-boundary cases still get their required sizes (over-cap → escalation, daily-cap
  exhaustion) — those double as volume.

**Funding note:** payments leave the **GuardedWallet contract**, not the operator EOA.
Arc uses USDC as the native gas token, so the ERC-20 view at `0x3600…0000` and the native
balance are the same money. Before section E runs, the target governed wallet must be
topped up from the operator wallet.


| ID | Scenario | Expect |
|----|----------|--------|
| E1 | Payment within per-tx cap to allowlisted vendor | Executes; appears in ledger + explorer within indexer lag |
| E2 | Payment **over per-tx cap** | Blocked → escalation created, visible in `/escalations` and approve link works |
| E3 | Daily cap exhaustion (multiple payments) | Payment that crosses daily cap blocked/escalated |
| E4 | Payment to **non-allowlisted** vendor | Rejected by contract |
| E5 | Escalated tx approved by quorum → executes | Funds move, ledger status transitions pending → settled |
| E6 | Escalated tx denied → never executes | No fund movement |
| E7 | Freeze via anomaly oracle (U5) | Wallet frozen on-chain; FROZEN stamp on badge/agent page; posture −15 |
| E8 | Frozen wallet attempts payment | Rejected |
| E9 | Unfreeze (on-chain only) | UI never offers freeze/unfreeze as a button (hard rule); state clears after on-chain unfreeze |
| E10 | Indexer restart mid-test | Resumes from checkpoint, no duplicate/missing ledger rows |

## F. Read-model integrity (cross-cutting)

| ID | Scenario | Expect |
|----|----------|--------|
| F1 | Every on-chain event from section E appears in Supabase read model | 1:1, correct amounts (USD), no drift |
| F2 | Posture score recomputation | Matches `computePostureScore` spec for each doctrine state tested |
| F3 | Ledger totals vs sum of events | Consistent |
| F4 | Doctrine version shown everywhere matches chain | Badge, policy page, explorer all agree |

## G. Security & abuse (U6)

| ID | Scenario | Expect |
|----|----------|--------|
| G1 | IDOR: access another operator's agent/ledger by editing IDs | Denied |
| G2 | XSS probes in vendor name / memo fields rendered on public pages | Escaped, no execution |
| G3 | Client bundle scan | No secrets (service-role key, session secret) in JS payloads |
| G4 | Anomaly oracle endpoint with wrong key | Rejected |
| G5 | tRPC/API fuzzing with malformed input | 4xx, no 500 leaks with stack traces |

## H. Resilience & performance

| ID | Scenario | Expect |
|----|----------|--------|
| H1 | Page load times (landing, dashboard, ledger) | Reasonable TTFB/LCP on prod |
| H2 | Large ledger pagination | No jank / unbounded fetch |
| H3 | RPC hiccup during dashboard use | Errors surfaced honestly, no silent wrong data |
| H4 | Concurrent sessions (2 browsers) | No session bleed |

---

## Prerequisites — what I need from you

| # | Item | Needed for | How |
|---|------|-----------|-----|
| P1 | **Go-ahead** | Everything | Say "start" |
| P2 | **Anomaly oracle private key** | E7–E9, G4 (freeze drill) | I'll request it via the secure secrets prompt — never in chat |
| P3 | **Funded Arc Testnet agent wallet key** (small test funds) | All of section E (real payments) | Secure secrets prompt |
| P4 | **A way into the prod dashboard** (U3) | Sections B–D | Either you sign in once and run the flows with me guiding, or we test auth-gated flows against the dev environment while prod covers public surface — your call |
| P5 | *(Optional)* Working prod database URL | Turns D7–D9 from KNOWN-LIMIT into real tests | Update the secret if you want these covered |

Without P2/P3, sections E–G run partially (I'll mark BLOCKED). Everything in A, C, F, H runs with zero input from you.

## Deliverable

One test report: every scenario ID above with PASS / FAIL / KNOWN-LIMIT / BLOCKED,
screenshots or transaction hashes as evidence for on-chain steps, and a prioritized
bug list (if any) at the top.
