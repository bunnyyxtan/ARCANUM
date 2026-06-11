# Twitter Launch Thread

## 12-Tweet Thread

### Tweet 1

AI agents are about to hold and move trillions in stablecoins.

On Arc, that future is already starting.

Today we're shipping Arcanum: open, non-custodial protocol-layer infrastructure for autonomous AI agent money. 🧵

### Tweet 2

Right now, many agent wallets are EOAs.

The agent has the key. The agent has the budget. The agent makes the call.

No review. No ceiling. No allowlist.

Until something goes wrong.

### Tweet 3

Arcanum gives every agent a real wallet on Arc with on-chain policy envelopes, human escalation, anomaly defense, and vendor allowlists enforced by the contract itself.

The protocol never touches your funds. Ever.

### Tweet 4

Four commitments, encoded in Solidity, enforced by Foundry invariants on every CI run:

✦ Non-custodial. Always.
✦ No upgrade key on user wallets.
✦ On-chain policy enforcement.
✦ Permissionless. Anyone can deploy.

### Tweet 5

Arc is the chain where autonomous AI agents will hold, move, and earn stablecoins.

USDC at agent speed. Permissionless. Native settlement.

Arcanum is built native to Arc because governance for autonomous money must live where the money lives.

### Tweet 6

Three-line integration.

Drop it alongside any agent stack. Replace one USDC transfer call site. Get policy caps, vendor allowlists, escalation, and anomaly defense at the wallet layer.

[screenshot of TS snippet]

### Tweet 7

Live dashboard. Posture index. Event stream. Pending escalations. Anomaly register.

All from on-chain events on Arc, indexed in seconds.

Self-hostable in under 5 minutes with docker-compose.

[GIF of dashboard]

### Tweet 8

A DAO treasury agent rebalancing positions on Arc.

Per-tx cap: $5K. Daily: $5K. Anything > $1K needs 2-of-3 council signature.

Vendor allowlist on-chain. Anomaly oracle opt-in. Manual unfreeze by owner.

All in 6 contracts.

### Tweet 9

Everything is MIT.

Contracts. Indexer. tRPC API. Dashboard. SDKs for TypeScript and Python. Docs.

Self-host on docker-compose, Helm, or Railway.

No SaaS dependency. No phone-home. No vendor lock.

### Tweet 10

Massive credit to @circle and the @arc team for building the L1 that makes this possible.

Arc's permissionless ethos is the reason Arcanum can exist as a fork-safe, gatekeeper-free protocol.

Honored to ship on it.

### Tweet 11

If you're building:
✦ DAO treasury agents
✦ DeFi keepers or liquidators
✦ DePIN subcontracting bots
✦ Anything that holds USDC and signs txs

Drop into Discord. Send a PR. Fork the repo. Let's harden the agent economy on Arc together.

### Tweet 12

Live now on Arc testnet:

App: https://thearcanum.in
Docs: https://thearcanum.in/docs
🛠 https://github.com/bunnyyxtan/ARCANUM
💬 discord.gg/arcanum
🎥 [demo video link]

Open protocol. Built on Arc. MIT. Forever.

## One-Tweet Teaser

Arc is the chain where autonomous AI agents will hold, move, and earn stablecoins.

Arcanum is the open, non-custodial governance layer that makes it safe: on-chain policy envelopes, escalation, anomaly defense, vendor allowlists.

MIT. Self-hostable. Built on Arc.

## LinkedIn Long-Form Version

AI agents are moving from chat windows into wallets.

That shift becomes especially powerful on Arc, the L1 built for stablecoin finance. Arc gives builders the settlement layer for autonomous agents that hold, move, and earn USDC at on-chain speed. Arcanum exists because that future needs governance primitives that live at the same layer as the money.

Today we are shipping Arcanum: open, non-custodial protocol-layer infrastructure for autonomous AI agent money on Arc.

The core idea is simple. Give an AI agent a real wallet, but route every USDC transfer through a GuardedWallet contract. That contract enforces a policy envelope before funds move. It can check spend ceilings, daily budgets, vendor allowlists, escalation thresholds, and anomaly signals. The dashboard, indexer, API, and SDK make the system easier to operate, but enforcement happens inside Solidity.

That design matters because agent money is not a dashboard problem. It is a custody and execution problem. If an agent signer can move funds directly, the review process lives outside the path of execution. If review happens only in a database, the chain cannot enforce it. If the server holds signing power, the system becomes an operational trust problem.

Arcanum keeps the enforcement where it belongs: on-chain, in the wallet that holds the funds.

The first demo scenario is Helix DAO. Helix runs a treasury rebalancer agent on Arc. The agent has a per-transaction cap, a daily ceiling, an allowlist of approved DeFi venues, and a threshold that escalates larger transfers to a two-of-three council approval flow. A transfer inside policy executes immediately. A transfer above the threshold is held by the escalation manager until quorum is reached. A transfer to a blocked counterparty is denied and routed into a frozen review path.

Every event is emitted on Arc and indexed into the dashboard. Operators see posture index, governed value, event stream, pending escalations, anomaly register, vendors, and ledger. The same data can be self-hosted from day one with docker-compose, Helm, or Railway.

Four commitments shape the protocol:

Non-custodial. The protocol cannot move user funds.

No upgrade key on user wallets. GuardedWallet bytecode is immutable after deployment.

On-chain policy enforcement. The dashboard is observability, not authority.

Permissionless deployment. Anyone can deploy a governed wallet on Arc.

Those are not only docs claims. They are enforced by Foundry invariant tests in CI.

We are grateful to Circle and the Arc team for building the stablecoin L1 that makes this possible. Arc's permissionless foundation gives agent builders a clean settlement layer for the next era of USDC-native software. Arcanum is our contribution to that ecosystem: a set of open primitives that DAO treasuries, DeFi protocols, DePIN networks, and agent framework users can fork, self-host, audit, and extend.

The repo includes contracts, indexer, tRPC API, dashboard, TypeScript SDK, Python SDK, docs, and self-hosting paths.

Live on Arc testnet now:

App: https://thearcanum.in
Docs: https://thearcanum.in/docs
https://github.com/bunnyyxtan/ARCANUM  
discord.gg/arcanum  
[demo video link]

Open protocol. Built on Arc. MIT. Forever.
