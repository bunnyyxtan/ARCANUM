# Arcanum Final QA Report

Date: 2026-06-09

## Current Project Status

Arcanum is demo/testing ready for the recovered FOUNDRY governance-console web app. The npm workspace workflow is active, the web app typechecks/builds/lints, the Arc Testnet contract deployment addresses are wired into the frontend, and the request-storm regression remains fixed.

The visible app preserves the recovered FOUNDRY visual identity. No redesign or product-direction changes were made during final QA.

## Deployed Arc Testnet Contracts

Deployment artifact: `packages/contracts/deployments/arc-testnet.json`

| Contract | Address |
| --- | --- |
| WalletFactory | `0x1Da7E51b537F9E6CF5bB308b3B2d6fdc5D9E4750` |
| PolicyEngine | `0x767C95C3E914d63bD26a5f1cDE4d6DA950462112` |
| EscalationManager | `0x6E03e0030fCeE242E2cCB77Da8D7C6c93a36A37E` |
| AnomalyOracle | `0x7A80C967A69E1d1a6bb2286089BB5945f3274cf4` |
| VendorRegistry | `0x4A4d419292F2E374421B45907861BBB5adA6eF82` |
| USDC | `0x3600000000000000000000000000000000000000` |

Frontend `apps/web/.env.local` public contract values were checked and match the artifact above. `NEXT_PUBLIC_GUARDED_WALLET_IMPL` is obsolete and is not required for runtime gating.

## Local Run Commands

```powershell
npm install
npm run dev
```

The web dev server runs at `http://127.0.0.1:4173` via the npm workspace script.

## Build/Test Commands

```powershell
npm run typecheck
npm run build
npm run lint
cd packages/contracts
forge build
forge test
```

Production preview was smoke-tested with:

```powershell
npm run start --workspace @arcanum/web -- --hostname 127.0.0.1 --port 4174
```

## Command Results

| Command | Result |
| --- | --- |
| `npm install` | Passed; changed 2 packages, audited 1608 packages. npm audit reports 40 vulnerabilities: 33 moderate, 6 high, 1 critical. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed; Next.js generated 23 app routes. |
| `npm run lint` | Passed; Biome checked 134 files. |
| `forge build` | Passed; emitted existing `block.timestamp` manipulation warnings in contract lint output. |
| `forge test` | Passed; 71 tests passed, 0 failed, 0 skipped. |

## Pages Verified

The following routes loaded successfully with no 404, 500, console crash, page crash, or stale GuardedWallet implementation copy:

- `/`
- `/dashboard`
- `/agents`
- `/vendors`
- `/ledger`
- `/escalations`
- `/anomalies`
- `/docs`
- `/settings`
- `/dashboard/settings`
- `/agents/0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7`
- `/agents/0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7/policy`
- `/approve/0xeeee000000000000000000000000000000000000000000000000000000000001`
- `/explorer/0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7`
- `/badge/0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7`
- `/status`

Desktop width and narrower laptop width were checked for the main app routes. The badge route is intentionally a fixed-size embeddable badge.

## Interactions Verified

- Logo/home link opens `/dashboard`.
- Top nav links route correctly.
- Docs, Settings, and Status utility links work.
- Notification bell opens/closes.
- Search, time range, refresh, and utility controls show intentional feedback.
- Wallet trigger is safe and does not disconnect on menu open.
- Agents filters/search work.
- Agent detail and Doctrine/Policy links work.
- Deploy Governed Wallet modal opens, shows deployed contract modules, does not mention GuardedWallet implementation, and clearly states on-chain createWallet wiring is pending.
- Policy editor dry run and save/apply feedback are clear.
- Vendors filter/search work.
- Add Vendor modal opens, validates required fields, and remains predictable.
- Vendor row action menu gives clear local/demo feedback.
- Ledger filters work.
- Ledger row opens Decision Record drawer.
- Decision Record close X works.
- Flag Vendor gives clear feedback.
- Escalations search/sort/filter path works.
- RELEASE sends exactly one `escalations.approve` POST per explicit click.
- DENY sends exactly one `escalations.reject` POST per explicit click.
- Approver Portal route opens and local Release/Deny states are clear.
- Anomalies page loads and action feedback is clear.
- Docs sidebar/content are useful and npm-based.
- Settings tabs/actions work or show local disabled/demo feedback.
- Public Explorer and Badge routes open; embed copy feedback works.

## Request Storm Results

60-second idle checks were run on:

- `/dashboard`
- `/agents`
- `/vendors`
- `/ledger`
- `/escalations`
- `/anomalies`
- `/docs`
- `/settings`

Result for every route:

- `0` automatic POST requests
- `0` tRPC requests
- `0` `escalations.approve` requests
- `0` duplicate escalation-list batches
- No terminal crash or request spam observed during the idle windows

## What Is Real On-Chain

- Arc Testnet contract modules are deployed at the addresses listed above.
- Frontend public contract env values match the deployment artifact.
- Foundry build and tests pass against the current contract code.
- WalletFactory architecture deploys full `GuardedWallet` instances directly; no standalone implementation/proxy address exists.

## Local/Mock Fallbacks Still Used

- Dashboard metrics, agent rows, vendor rows, ledger rows, escalation cards, anomaly rows, public explorer cards, and badge content still use stable local/mock fallback data when API/indexer data is unavailable.
- Add Vendor is API/local-demo backed and does not claim blockchain success.
- Approver Portal uses local UI state for public demo transitions.
- Policy editor dry run is a local simulation.
- Arcscan is disabled or replaced with clear feedback for mock ledger rows without real transaction hashes.

## Routes Restored Previously

- `/agents/[walletId]`
- `/agents/[walletId]/policy`
- `/approve/[txHash]`
- `/explorer/[wallet]`
- `/badge/[wallet]`
- `/settings`
- `/dashboard/settings`
- `/docs`
- `/status`

## Placeholder-Only Routes

No restored route is a blank placeholder. Some routes intentionally render local/demo data until backend/indexer/on-chain write flows are fully wired.

## Known Disabled/Pending Items

- On-chain `WalletFactory.createWallet` frontend transaction wiring is pending.
- Policy save/apply requires a connected/authenticated wallet and real backend/on-chain write path.
- Vendor add/registry writes require authenticated API/on-chain integration for production use.
- Public explorer and badge data are read-only/local fallback for the demo.
- npm audit reports dependency vulnerabilities that should be triaged before production launch.

## Top 5 Recommended Next Tasks

1. Wire the Deploy Governed Wallet modal to a real `WalletFactory.createWallet` transaction, with one explicit click per transaction.
2. Replace local/mock dashboard, ledger, anomaly, vendor, and explorer read models with indexed Arc Testnet data behind stable adapters.
3. Complete authenticated on-chain/API write paths for vendor registry and policy updates.
4. Add regression tests for no auto-mutation/no request storm behavior.
5. Triage npm audit findings and upgrade vulnerable dependencies safely.

## Demo Blockers

No blocker for a UI/product demo or local testing. Production launch still requires the pending on-chain write integrations and dependency audit triage above.
