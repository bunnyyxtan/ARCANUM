# Arc Builders Fund Application

## 1. Project Name

Arcanum

## 2. One-Liner

Open, non-custodial protocol-layer infrastructure for autonomous AI agent money on Arc.

## 3. Category

Infrastructure / Developer Tools / DeFi Primitives

## 4. What Is The Project?

Arcanum is open-source infrastructure for teams building AI agents that hold and spend USDC on Arc. It gives every agent a governed wallet with on-chain policy envelopes, human escalation, anomaly defense, and vendor allowlists enforced inside smart contracts.

The starting point is a practical gap. AI agents can already sign transactions, call DeFi venues, pay API vendors, and run treasury workflows. When those agents hold stablecoins, teams need guardrails that travel with the wallet itself: per-transaction caps, daily spend ceilings, approved counterparties, escalation for larger transfers, and automatic containment when behavior moves outside expected patterns.

Arcanum implements those primitives in six contracts: GuardedWallet, PolicyEngine, EscalationManager, AnomalyOracle, VendorRegistry, and WalletFactory. The dashboard, SDK, indexer, and tRPC API make the system easier to run, but they do not move funds. Policy enforcement happens on-chain.

Arcanum is built native to Arc, optimized for USDC velocity, and designed for crypto-native operators: DAO treasuries, DeFi protocols, DePIN networks, and on-chain agent builders. The entire stack is MIT-licensed, permissionless to deploy, and self-hostable from day one.

## 5. Why Now / Why Arc?

Arc is the chain where autonomous AI agents will hold, move, and earn stablecoins. Circle and the Arc team have created a permissionless L1 for stablecoin finance, and that unlocks a new class of software: agents that can settle, rebalance, subcontract, pay vendors, and earn yield directly on-chain.

That economy needs governance primitives that match Arc's speed and openness. Agent money cannot depend only on dashboards, message approvals, or off-chain records. When the transfer happens on Arc, the policy should live on Arc too.

Arcanum is built as a native contribution to that ecosystem. It gives builders a reusable on-chain governance layer for agent wallets: deployable by anyone, auditable by anyone, forkable by anyone, and compatible with self-hosted operations. The protocol is not a custodian and does not require teams to hand over signing authority. It helps Arc builders give agents real USDC wallets while keeping budgets, counterparties, and escalation paths enforced at the contract level.

The timing is right because agent builders are moving from experiments into production workflows. DAO treasury bots, DeFi keeper agents, DePIN subcontracting agents, and research agents all need reliable stablecoin execution. Arc provides the settlement layer. Arcanum provides the guardrails.

## 6. Current State

- Live Arc testnet deployment: `[TO-FILL: packages/contracts/deployments/arc-testnet.json addresses]`
- Demo video: `[TO-FILL: demo video URL]`
- GitHub: `https://github.com/bunnyyxtan/ARCANUM`
- Dashboard: `[TO-FILL: deployed Vercel URL]`
- Docs: `apps/docs` in this repository
- SDK: TypeScript and Python SDKs implemented and ready for package release
- Contracts: Foundry suite with 90%+ coverage target and invariants for non-custodial guarantees
- Self-hosting: docker-compose path verified for a single-tenant deployment

## 7. Team

Founder: Ranbir Kapoor

- Background: `[TO-FILL: founder background]`
- Prior shipping record: `[TO-FILL: shipped products, repositories, or protocols]`
- GitHub: `[TO-FILL]`
- Twitter: `[TO-FILL]`
- Discord: `[TO-FILL]`

## 8. Traction / Community

- GitHub stars: `[TO-FILL after launch]`
- Discord members: `[TO-FILL after launch]`
- Integration partners in conversation: `[TO-FILL]`
- Podcast, writeup, or ecosystem coverage: `[TO-FILL]`
- Early builder feedback: `[TO-FILL]`

## 9. Roadmap: Next 6 Months

- v1.1: Agent framework recipes for ElizaOS, Virtuals, and Coinbase AgentKit users.
- v1.2: Arc-native deployment patterns for teams running multiple governed agent fleets.
- v1.3: Multi-signer anomaly oracle with transparent score attestations.
- v1.4: Arc mainnet deployment with formal audit and public bug bounty scope.

## 10. Funding Request

Request: **$250,000**

Breakdown:

- Formal smart contract audit: **$90,000**
- Six months of full-time engineering: **$110,000**
- Developer relations, docs, and community programs: **$35,000**
- Infrastructure, monitoring, security tooling, and launch operations: **$15,000**

This funding accelerates the path from Arc testnet to a hardened mainnet launch. The largest allocation goes to audit and protocol engineering because user-deployed wallets must be safe by construction.

## 11. What Success Looks Like

Within six months of Arc mainnet readiness:

- Three named DAO, DeFi, or DePIN teams use Arcanum to govern agent wallets on Arc.
- 500 GitHub stars.
- 10 contributor PRs merged.
- A public Arc Builders showcase demo.
- At least one agent framework recipe maintained with community feedback.

## 12. How This Strengthens Arc

Arcanum gives builders shipping agent products on Arc a governance primitive they would otherwise have to build themselves. That lowers the activation energy for serious agent workloads: treasury agents, keeper agents, subcontracting agents, and research agents can hold USDC while respecting on-chain policy.

Because Arcanum is open-source and MIT-licensed, improvements compound for the whole Arc ecosystem. Every team can fork it, audit it, self-host it, and adapt it to their own workflow. The result is more safe, permissionless, USDC-native agent activity on Arc.
