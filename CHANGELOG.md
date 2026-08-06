# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-06

First tagged release. This is a snapshot of the Arc Testnet public review
build that runs at [https://thearcanum.in](https://thearcanum.in). Earlier
work was developed without tags, so this release marks the baseline rather
than reconstructing prior history.

### Added

- Solidity governance contracts deployed to Arc Testnet: WalletFactory,
  GuardedWallet, PolicyEngine, EscalationManager, AnomalyOracle, and
  VendorRegistry, with Foundry tests.
- Next.js operator dashboard: agents, vendors, ledger, escalations,
  anomalies, notifications, settings, and workspace management.
- Public trust surfaces: wallet explorer pages, badge routes, and an
  approver portal for escalation quorum decisions.
- SIWE wallet sign-in with auto-provisioned workspaces.
- Supabase-backed read models fed by a Ponder indexer for contract events.
- TypeScript SDK (`@arcanum/sdk`) and Python SDK (`packages/sdk-py`).
- Documentation site workspace (`apps/docs`).

### Security

- Contracts are testnet-only and unaudited. See [SECURITY.md](./SECURITY.md)
  for scope and reporting.

[Unreleased]: https://github.com/bunnyyxtan/ARCANUM/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bunnyyxtan/ARCANUM/releases/tag/v0.1.0
