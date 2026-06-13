# ARCANUM

**Open, non-custodial governance for autonomous AI-agent money on Arc.**

![MIT License](https://img.shields.io/badge/license-MIT-ff5a1f)
![Solidity / Foundry](https://img.shields.io/badge/Solidity%20%2F%20Foundry-0.8.24-2f3542)
![Next.js](https://img.shields.io/badge/Next.js-15-111827)
![Arc Testnet](https://img.shields.io/badge/Arc-Testnet-6e9e7c)
![USDC](https://img.shields.io/badge/USDC-enabled-2775ca)
![AI Agents](https://img.shields.io/badge/AI%20Agents-governed-e0a04a)

Arcanum is an open governance layer for autonomous AI-agent money on Arc. It lets builders give AI agents real USDC wallets with contract-enforced policy limits, vendor controls, human escalation, anomaly protection, public badge and explorer views, and a dashboard for monitoring governed wallet activity.

AI agents are starting to make payments, buy APIs, rent compute, call tools, and route funds. A normal wallet gives an agent too much freedom. Arcanum gives agents governed wallets where every spend can be checked before money moves.

GuardedWallet contracts on Arc enforce policy envelopes, vendor allowlists, spend caps, anomaly checks, and human quorum escalation. The dashboard, SDKs, indexer, and API make the system usable. The wallet contracts keep the critical rules on-chain.

Public app: [https://thearcanum.in](https://thearcanum.in)

For local development, use the quickstart below.

## Current Status at a Glance

Arcanum is a **working Arc Testnet public review build**. It is not audited, not mainnet, and not intended for production funds.

What is real today:

- Arc Testnet contracts are deployed and listed below.
- The web console builds and runs with npm workspaces.
- Wallet sign-in, dashboard routes, public explorer/badge routes, and approver routes are implemented.
- The app has read-model adapters for agents, vendors, ledger events, escalations, anomalies, notifications, and public wallet profiles.
- TypeScript and Python SDK packages exist for direct Arc RPC integrations.
- Demo data is gated to the configured demo wallet; random wallets and disconnected visitors see empty, live workspace states — not seeded demo rows.

Currently being hardened:

- Some advanced write paths and indexer reconciliation flows are still being hardened for broader testnet usage.
- The read model and indexer are undergoing additional resilience and recovery improvements.
- The contracts are testnet code. A formal audit is required before any mainnet or production-funds use.

## Why Arcanum Exists

AI agents should not hold unrestricted wallets.

Teams, users, DAOs, DePIN networks, and on-chain agent builders need programmable money controls that live where the funds live. Stablecoin payments need governance at the wallet layer, not only in an off-chain dashboard that can be bypassed.

Arcanum makes the wallet itself enforce rules. An operator can give an agent spending authority without giving it unlimited discretion. If a payment is normal, it can pass through. If it violates a doctrine, exceeds a cap, targets an unapproved vendor, or looks anomalous, the wallet can deny, freeze, or escalate to humans.

## How It Works

1. Connect a wallet.
2. Deploy a GuardedWallet through `WalletFactory`.
3. Attach a Doctrine, which is Arcanum's policy envelope for the wallet.
4. An agent attempts a USDC payment.
5. `PolicyEngine` approves, denies, freezes, or escalates the action to a human quorum.
6. Human approvers release or reject sensitive transfers when quorum is required.
7. The indexer, API, dashboard, explorer, and badge routes display the resulting evidence.

## Key Features

### GuardedWallets

Each agent receives a non-custodial wallet controlled by smart-contract rules. The operator keeps ownership and governance authority. The agent receives constrained spending ability.

### Policy Envelopes / Doctrine

A Doctrine defines what the agent is allowed to do. It can include daily caps, per-transaction caps, per-vendor limits, approved categories, vendor allowlists, anomaly thresholds, and quorum requirements.

### Vendor Allowlists and Categories

Operators can organize vendors by category, such as API, data, compute, subcontracting, or other spend types. This makes it easier to let an agent pay known infrastructure providers while blocking unknown destinations.

### Spend Limits

Arcanum supports policy controls for normal payment limits, sensitive thresholds, and escalation boundaries. The goal is not to slow every payment down, but to make risky payments reviewable.

### Human Escalation Quorum

When a payment crosses a policy boundary, it can be escalated to human approvers. This lets teams combine autonomous execution with explicit review for sensitive actions.

### Anomaly Detection / Freeze Defense

The anomaly layer is designed to catch behavior that deviates from expected agent activity. High-risk events can be flagged, restrained, or frozen until reviewed.

### Public Badge / Explorer

Arcanum includes public, shareable surfaces for governed wallets. Builders can show that an agent is governed, explain its posture, and link to wallet-specific explorer views.

### Dashboard and Event Stream

The web app provides an operator console for agents, vendors, ledger activity, escalations, anomalies, settings, docs, public explorer routes, badge routes, and an approver portal.

### SDKs

The repository includes TypeScript and Python SDK packages for builders who want to integrate Arcanum into their own agent stacks.

### Self-Hostable Stack

The app is structured as an open monorepo with contracts, web UI, API, auth helpers, database schema, indexer, SDKs, and shared packages.

## Deployed Arc Testnet Contracts

Network: **Arc Testnet**

Explorer: [https://testnet.arcscan.app](https://testnet.arcscan.app)

| Module | Address |
| --- | --- |
| WalletFactory | `0x1Da7E51b537F9E6CF5bB308b3B2d6fdc5D9E4750` |
| PolicyEngine | `0x767C95C3E914d63bD26a5f1cDE4d6DA950462112` |
| EscalationManager | `0x6E03e0030fCeE242E2cCB77Da8D7C6c93a36A37E` |
| AnomalyOracle | `0x7A80C967A69E1d1a6bb2286089BB5945f3274cf4` |
| VendorRegistry | `0x4A4d419292F2E374421B45907861BBB5adA6eF82` |
| USDC | `0x3600000000000000000000000000000000000000` |

These are testnet contracts. Do not treat them as audited mainnet infrastructure.

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/web` | Next.js app, dashboard, landing page, docs route, public explorer, badge route, and approver portal. |
| `apps/docs` | Documentation site workspace. |
| `packages/contracts` | Solidity contracts, Foundry tests, ABIs, and deployment scripts. |
| `packages/sdk` | TypeScript SDK package. |
| `packages/sdk-py` | Python SDK package. |
| `packages/indexer` | Ponder indexer package for contract events and read models. |
| `packages/api` | tRPC/API layer for app data, session-aware reads, and safe local fallbacks. |
| `packages/db` | Database schema, migrations, and seed helpers. |
| `packages/auth` | SIWE and session helper package. |
| `packages/shared` | Shared chain config, addresses, and types. |
| `packages/ui` | Shared UI package. |

## Smart Contract Modules

### WalletFactory

Deploys new GuardedWallet instances on Arc Testnet. This is the entry point for creating governed wallets from the app.

### GuardedWallet

The agent-facing wallet. It holds funds and routes spend attempts through the governance and policy checks before assets move.

### PolicyEngine

Evaluates Doctrine rules, spend caps, vendor status, category limits, and escalation thresholds.

### EscalationManager

Coordinates sensitive actions that require human review. It tracks approvals, quorum, release decisions, and related escalation state.

### AnomalyOracle

Provides anomaly signals used by the policy layer. It is intended to help detect behavior that falls outside expected agent spending patterns.

### VendorRegistry

Stores vendor controls such as allowlist status, category, and policy metadata. Advanced write paths for VendorRegistry are being hardened for broader testnet usage.

## Quickstart

```bash
git clone https://github.com/bunnyyxtan/ARCANUM.git
cd ARCANUM
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Open [http://127.0.0.1:4173](http://127.0.0.1:4173). If your local dev server selects another port, use the URL printed by Next.js.

The project currently keeps the web app environment example at `apps/web/.env.example`.

## Required Environment Variables

Minimum web development variables are documented in `apps/web/.env.example`.

### Arc and Contracts

| Variable | Purpose |
| --- | --- |
| `ARC_TESTNET_RPC` | Server/API RPC URL for Arc Testnet. |
| `NEXT_PUBLIC_ARC_CHAIN_ID` | Arc Testnet chain id. |
| `NEXT_PUBLIC_ARCSCAN_URL` | Arcscan base URL for explorer links. |
| `NEXT_PUBLIC_USDC` | Arc Testnet USDC address. |
| `NEXT_PUBLIC_WALLET_FACTORY` | Deployed WalletFactory address. |
| `NEXT_PUBLIC_POLICY_ENGINE` | Deployed PolicyEngine address. |
| `NEXT_PUBLIC_ESCALATION_MANAGER` | Deployed EscalationManager address. |
| `NEXT_PUBLIC_ANOMALY_ORACLE` | Deployed AnomalyOracle address. |
| `NEXT_PUBLIC_VENDOR_REGISTRY` | Deployed VendorRegistry address. |

### App Data and Auth

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Client-safe Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client-safe Supabase anon key. |
| `NEXT_PUBLIC_APP_URL` | Public canonical app URL. Production should use `https://thearcanum.in`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service role key. Never expose this to client code. |
| `SIWE_SECRET` | Server-side session secret for wallet authentication. |
| `NEXTAUTH_SECRET` / `NEXTAUTH_URL` | Not required by this repo today. If a fork adds NextAuth, use `NEXTAUTH_URL=https://thearcanum.in` in production and keep secrets server-only. |
| `DATABASE_URL` | Not used by the Vercel web/API runtime. Optional only for legacy local DB tooling outside the Supabase read-model path. |
| `ARCANUM_DEMO_OWNER_WALLET` | Optional wallet address allowed to see seeded demo data. |
| `ARCANUM_DEMO_ORG_SLUG` | Optional demo organization slug. |
| `ARCANUM_DEMO_ORG_NAME` | Optional demo organization name. |

Never commit `.env.local`, private keys, service-role keys, deployment keys, or wallet secrets.

`NEXT_PUBLIC_*` variables are visible in the browser. Only put public chain, contract, explorer, and anon-key values there.

## Local Development Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm run build
npm --workspace @arcanum/web run build
```

Contracts:

```bash
cd packages/contracts
forge build
forge test
```

Contract deployment requires private keys and RPC configuration. Keep those values local and never paste them into issues, pull requests, screenshots, or public logs.

Reviewer checklist before a PR:

- Run `npm run typecheck`, `npm run build`, and `npm run lint`.
- Run `npm --workspace @arcanum/web run build`.
- For contract changes, run `forge build` and `forge test` from `packages/contracts`.
- Confirm no `.env.local`, private key, service-role key, generated cache, or build artifact is staged.
- For UI/data changes, confirm demo data does not appear for disconnected or random wallets.

## Demo / Current Stage

Current stage: **Arc Testnet public review build**.

The app is prepared for Vercel deployment and local development through npm workspaces. Demo data is gated to a designated demo wallet. Disconnected visitors and non-demo wallets see empty, live, or onboarding states — not seeded ACME demo activity.

Real on-chain WalletFactory deployment is wired for Arc Testnet. Some advanced write paths and indexer reconciliation flows are still being hardened for broader testnet usage. Public explorer and badge routes are available, with fallback data kept honest when a wallet has no indexed rows.

Arc Testnet remains the proving ground before any production-funds or mainnet path.

## Security Model

- Arcanum is non-custodial.
- The server does not need to hold agent private keys.
- Policies are enforced by contracts before guarded funds move.
- Sensitive actions can require human quorum.
- Demo data is separated from live wallet data.
- Supabase service-role keys are server-only.
- `NEXT_PUBLIC_*` variables are visible in the browser — only public chain, contract, explorer, and anon-key values belong there.
- Private keys must never be committed.
- A formal audit is required before any mainnet or production-funds use.

This repository is not an audit report. Treat the contracts as testnet code unless and until a formal audit is published.

## What Arcanum Is Not

- Not a custodian.
- Not a centralized exchange.
- Not a token sale.
- Not a fiat on-ramp or off-ramp.
- Not a hosted wallet provider.
- Not financial advice.
- Not audited. Not mainnet. Not intended for production funds.

## Roadmap

Arcanum is currently focused on making governed AI-agent wallets reliable, inspectable, and safe on Arc Testnet before any mainnet path.

### Testnet Hardening

- Harden wallet-scoped Supabase read models for agents, vendors, policies, ledger events, escalations, anomalies, and public profiles.
- Improve event-indexer recovery, stale-indexer reporting, and contract-event reconciliation.
- Add stronger wallet/signer consistency checks across refreshes, wallet switching, and multi-signer states.
- Expand failure-state handling for RPC errors, delayed indexing, failed transaction sync, and stale read-model data.

### Policy and Governance

- Expand Doctrine templates for API spend, model inference, compute rental, data access, treasury operations, and security monitoring.
- Add richer per-signer and per-vendor policy controls.
- Improve escalation workflows for quorum approvals, release/reject decisions, and approver review history.
- Strengthen anomaly posture scoring and restraint logic for unusual agent behavior.

### Developer Experience

- Add deeper TypeScript and Python SDK examples for agent backends.
- Publish example integrations for tool payments, vendor onboarding, policy simulation, and public badge embeds.
- Improve self-hosting documentation for builders running their own API, indexer, and read model.
- Add clearer local development, deployment, and verification guides.

### Public Trust Surfaces

- Improve wallet-specific explorer pages with clearer policy, signer, vendor, and activity evidence.
- Expand public badges for governed agents, signer status, vendor policy, and escalation posture.
- Add shareable proof pages for agent wallets used in demos, hackathons, and ecosystem reviews.

### Security and Audit Path

- Continue internal security reviews across contracts, API authorization, signer permissions, and read-model boundaries.
- Add more automated tests for signer authorization, policy enforcement, vendor scoping, and escalation flows.
- Prepare contracts and infrastructure for external audit review before any production-funds or mainnet usage.
- Keep Arc Testnet as the proving ground until the system is mature enough for a formal mainnet path.

### Arc Ecosystem Path

- Run controlled testnet pilots with builders experimenting with autonomous AI payments.
- Collect feedback from agent developers, wallet operators, and infrastructure vendors.
- Explore mainnet deployment only after testnet reliability, security review, and ecosystem guidance are complete.

## Contributing

Issues and pull requests are welcome. Please keep changes focused, documented, and easy to review.

Security reports should follow [SECURITY.md](./SECURITY.md).

## License

MIT. See [LICENSE](./LICENSE).
