# Arcanum Demo Video Script

Length: 2 minutes 30 seconds  
Format: screen recording with voiceover, single-take feel, no cuts mid-thought

## 2:30 Main Cut

### 0:00-0:15 — Cold Open

**On-screen:** Arcanum landing page hero.

**VO:** AI agents are about to hold and spend trillions of dollars in stablecoins. On Arc, that is already starting. The question is not if. It is how we govern it without giving up custody and without asking for permission.

### 0:15-0:35 — The Problem, Fast

**On-screen:** Split-screen. Left: a compact code snippet showing a typical agent calling `USDC.transfer(...)`. Right: dashboard event showing `$847.00 REJECTED` to `evil-data-broker.com` at `02:47:18Z`.

**VO:** Right now, many agent wallets are EOAs. The agent has the key. The agent has the budget. The agent makes the call. There is no review, no ceiling, no allowlist, until something goes wrong.

### 0:35-0:55 — The Arcanum Introduction

**On-screen:** GuardedWallet contract on Arc testnet explorer, then the contract architecture diagram from docs.

**VO:** Arcanum is open-source, non-custodial protocol-layer infrastructure for AI agent money on Arc. Your agent gets a real wallet, but every transfer flows through an on-chain policy envelope, with caps, allowlists, escalations, and anomaly defense baked into the contract itself.

### 0:55-1:25 — Live Demo: Helix DAO

**On-screen:** Open the deployed dashboard URL. Connect wallet. Sign in. Show Helix DAO context.

**VO:** Here is Helix DAO's treasury agent on Arc. It rebalances positions across Aave, Compound, and Morpho. Spend cap: five thousand dollars per transaction. Daily ceiling: five thousand dollars. Anything over one thousand dollars requires two-of-three council signature. Vendors are allowlisted on-chain.

**On-screen action:** Trigger a sub-threshold rebalance.

**VO:** Four hundred twenty-five dollars to Aave. Within policy. Executes on Arc. Indexed in seconds.

**On-screen action:** Trigger an escalation. Show `$73.42` AWS Bedrock example, then switch to a larger transfer.

**VO:** Now an agent compute payment. Seventy-three dollars to AWS Bedrock stays inside the envelope. To show escalation, we push one over the line. Twelve hundred fifty dollars to Anthropic for the inference workload. That is above the escalation threshold. The contract holds it. Council members get notified. One approves.

**On-screen action:** Approve from the second council seat. Quorum reached. Transfer executes on-chain.

**VO:** Quorum. The wallet executes the transfer on Arc. The protocol never touched the funds.

### 1:25-1:50 — The Anomaly

**On-screen:** Simulated DevAgent-01 attempt to pay `evil-data-broker.com`.

**VO:** Now the safety path. An agent tries to pay a counterparty on the blocklist. The contract blocks the transfer and moves the wallet into frozen review. The DAO gets a danger event in the stream. Unfreeze requires explicit owner action on-chain.

### 1:50-2:15 — The Non-Custodial Point

**On-screen:** `/architecture` page. Highlight four commitments and links to Foundry invariant tests.

**VO:** Four commitments are encoded in Solidity and enforced by Foundry invariants on every CI run. The protocol cannot move your funds. There is no upgrade key on your wallet. Policy enforcement is on-chain, always. Anyone can deploy: no permission, no KYC, no gatekeeper. This is governance for autonomous money on Arc.

### 2:15-2:30 — Close

**On-screen:** GitHub repo, docs site, install command, then closing card.

**VO:** Arcanum is MIT-licensed, self-hostable from day one, and live on Arc testnet right now. Built for the builders shipping the agent economy on Arc. GitHub, docs, three-line SDK, docker-compose, full source. Let's build.

**Closing card:** Arcanum · Open Protocol · Built on Arc

## 60-Second Cut

### 0:00-0:10

**On-screen:** Landing hero.

**VO:** Arc is the chain where autonomous AI agents will hold, move, and earn stablecoins. Arcanum is the on-chain governance layer that makes it safe.

### 0:10-0:22

**On-screen:** `USDC.transfer(...)` snippet, then rejected `evil-data-broker.com` event.

**VO:** Agent wallets need real guardrails: spend ceilings, vendor allowlists, human escalation, and anomaly defense that live on-chain.

### 0:22-0:45

**On-screen:** Helix DAO dashboard. Execute `$425` to Aave, then escalate `$1,250` to Anthropic.

**VO:** Helix DAO gives its treasury agent a governed wallet on Arc. Within-policy transfers execute immediately. Larger transfers are held for council quorum. Every decision is enforced by the GuardedWallet contract.

### 0:45-0:55

**On-screen:** Architecture page commitments.

**VO:** Arcanum is non-custodial, immutable at the wallet layer, permissionless to deploy, and enforced by Foundry invariants.

### 0:55-1:00

**On-screen:** GitHub and docs.

**VO:** MIT, self-hostable, live on Arc testnet. Open protocol. Built on Arc.

## 30-Second Teaser

### 0:00-0:08

**On-screen:** Landing hero.

**VO:** AI agents are coming on-chain with real stablecoin wallets. On Arc, that future needs native guardrails.

### 0:08-0:20

**On-screen:** Dashboard event stream, policy card, escalation approval.

**VO:** Arcanum gives agents governed wallets with on-chain caps, allowlists, escalations, and anomaly defense. The protocol never touches user funds.

### 0:20-0:30

**On-screen:** GitHub repo, docs, closing card.

**VO:** Open-source. MIT. Self-hostable. Live on Arc testnet. Built for the builders shipping autonomous money on Arc.
