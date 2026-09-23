# Security

Arcanum runs a limited pilot on Arc Mainnet with real USDC and keeps a full
deployment on Arc Testnet for development. The contracts have not had an
independent audit; keep pilot caps small and treat every deployment as
unaudited code.

Project website: [https://thearcanum.in](https://thearcanum.in)

## Reporting

Report security issues privately through GitHub private vulnerability reporting
for this repository when available. If private reporting is unavailable, contact
the maintainer privately before sharing exploit details in public issues.

Do not include real private keys, seed phrases, service-role keys, API tokens,
or live user secrets in reports.

## In Scope

- Solidity contracts in `packages/contracts`
- TypeScript and Python SDK signing logic
- SIWE auth and session handling
- tRPC/API tenant and wallet isolation
- Supabase service-role boundaries and env handling
- Ponder indexer correctness
- Public explorer, badge, and approver routes
- Deployment and CI configuration that could leak secrets

## Out of Scope

- Spam, phishing, or social engineering reports
- Third-party wallet bugs
- Arc network outages, RPC problems, or testnet faucet issues
- Issues that require leaked private keys or compromised user devices
- Claims about testnet asset value
- Denial-of-service reports without a practical security impact

## Bounty Status

No paid bug bounty is funded yet. Scope is documented at `/security/bug-bounty`
in the docs app so researchers know which areas matter.
