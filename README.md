<h1 align="center">ARCANUM</h1>

<p align="center">
  Onchain policy for AI-agent money on Arc.<br />
  Every USDC payment an agent makes is checked by the wallet contract before it moves.
</p>

<p align="center">
  <a href="https://thearcanum.in">App</a> ·
  <a href="https://thearcanum.in/docs">Docs</a> ·
  <a href="https://thearcanum.in/verify">Verify a receipt</a> ·
  <a href="./.github/SECURITY.md">Security</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache--2.0-2f3542" alt="Apache-2.0" />
  <img src="https://img.shields.io/badge/network-Arc%20Mainnet%20pilot-ff5a1f" alt="Arc Mainnet pilot" />
  <a href="https://www.npmjs.com/package/arcanum-sdk"><img src="https://img.shields.io/npm/v/arcanum-sdk?label=arcanum-sdk" alt="npm" /></a>
</p>

## What this repository is

This is the open protocol layer of Arcanum:

| Path | What it is | Licence |
| --- | --- | --- |
| `packages/contracts` | Solidity contracts, Foundry tests (unit, invariant, adversarial, mainnet fork), ABIs, deployment manifests | Apache-2.0 |
| `packages/sdk` | TypeScript SDK, published as [`arcanum-sdk`](https://www.npmjs.com/package/arcanum-sdk) | Apache-2.0 |
| `packages/sdk-py` | Python SDK | Apache-2.0 |
| `packages/shared` | Chain config, payment-intent schemas, payment receipt signing and offline verification | Apache-2.0 |
| `apps/docs` | Documentation site | Apache-2.0 |

The hosted operator app at [thearcanum.in](https://thearcanum.in) is built on this protocol. It includes the dashboard, approver portal, explorer, API and indexer, and its source is not in this repository.

## How it works

1. An owner deploys a **GuardedWallet** for an agent through the permissionless `WalletFactory`.
2. The owner attaches a **doctrine**, which sets:
   - per-transaction, daily and monthly USDC caps;
   - allowed vendor categories;
   - whether vendors must be on an allowlist;
   - per-vendor caps;
   - the amount above which a human must approve.
3. The agent calls `executeUSDC`. The `PolicyEngine` returns one verdict:
   - **ALLOW:** the payment is sent.
   - **DENY:** the call reverts.
   - **ESCALATE:** the payment is held for an M-of-N human council. It expires if not approved, can be cancelled, and is checked against the policy again when released.
   - **FREEZE:** the wallet stops.
4. Budget caps are checked before the escalation threshold, so a council can never approve spending above a cap.
5. Before paying, an agent can request a **payment decision receipt**: an issuer-signed record of the policy verdict for that exact intent at a pinned block. Anyone can verify it offline with `verifyPaymentReceipt` or at [/verify](https://thearcanum.in/verify).

## Deployments

### Arc Mainnet (chain 5042), limited pilot

| Contract | Address |
| --- | --- |
| WalletFactory | `0x7077A28C003D9274d45263b04Ac9cB9a58Ab5342` |
| PolicyEngine | `0xb74De5aD09a75dea03f5ddD77A25e1Ca11724483` |
| EscalationManager | `0x2a653D3d90BFA13bE9d8F9eB2Cc87578967128EF` |
| AnomalyOracle | `0xb2ae97dB77c8fdF8D9CE00743A4B095E4f2AdD8F` |
| VendorRegistry | `0x722C2f83ca55503Cf3104bABeb3EaA9d676B1469` |

### Arc Testnet (chain 5042002)

| Contract | Address |
| --- | --- |
| WalletFactory | `0xbE1bC48F26e7166D872828d40e82A6407dbD350C` |
| PolicyEngine | `0x7777ac24A19202E619bF67B92375E714e72033A4` |
| EscalationManager | `0xb5907700Df79B9030FafDaA48C26AE355512cCcd` |
| AnomalyOracle | `0x2eae369C3f93ebf5Bbe62FBE6d2CD976977f7AE8` |
| VendorRegistry | `0xeA4597b02Ea2958A80afc47c417422598b9c548C` |

The deployment manifests in `packages/contracts/deployments/` are the source of truth for these addresses.

> **Unaudited.** The contracts have internal tests, invariants and static analysis, but they have not been independently audited. On mainnet, keep caps small and deposit only what you can afford to lose.

## Quick start

```bash
npm install arcanum-sdk viem
```

```ts
import { ArcanumClient } from "arcanum-sdk";
```

See [packages/sdk/README.md](./packages/sdk/README.md) and the [SDK docs](https://thearcanum.in/docs/sdk/typescript).

## Develop

You need Node.js 22.12 or later, and [Foundry](https://getfoundry.sh) v1.5.1.

```bash
npm install
npm test

cd packages/contracts
scripts/restore-foundry-deps.sh
forge build
forge test
```

## Contributing and security

Read [CONTRIBUTING.md](./.github/CONTRIBUTING.md). Report vulnerabilities privately as described in [SECURITY.md](./.github/SECURITY.md), never in a public issue.

## Licence

Apache-2.0. See [LICENSE](./LICENSE).

"Arc" is a trademark of Circle Internet Group, Inc. Arcanum is an independent project and is not affiliated with or endorsed by Circle.
