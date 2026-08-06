# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-08-06

Major upgrade of the entire product. The web app was rebuilt from scratch on
the Warm Ledger design system, the data path was rebuilt around Supabase read
models, and the repository was professionalized for public review. This is
the build running at [https://thearcanum.in](https://thearcanum.in).

### Changed

- Complete frontend rebuild: the legacy foundry UI was replaced with the Warm
  Ledger design system, with light and dark themes, a rebuilt landing page,
  and mobile-hardened layouts across the dashboard.
- Production reads now flow through Supabase read models fed by the indexer,
  replacing direct database reads in the deployed app.
- Sign-in now auto-provisions a workspace per operator, with membership-scoped
  reads and locked, audited writes.

### Added

- Vendor review flags with an append-only history: who flagged, who edited
  the note, who cleared it, all visible in the decision drawer.
- Escalation detail improvements, including created and expiry times.
- Notification inbox with per-wallet read state and mark-all-read.
- Amounts in the dashboard event stream, with rows linking to the matching
  ledger entry.
- Active workspace name on the dashboard with a rename path in settings.
- Read-only mode for visitors without a wallet.
- Repository governance: changelog, issue and PR templates, dependabot,
  CODEOWNERS, editorconfig, and aligned package metadata.

### Removed

- Legacy foundry UI.
- Unusable Helm chart and unreferenced generated artifacts.

### Security

- Contracts remain testnet-only and unaudited. See
  [SECURITY.md](../.github/SECURITY.md) for scope and reporting.

## [1.0.0] - 2026-08-02

Initial-stage build of Arcanum, tagged retroactively at the last commit of
the original frontend era. Not production-ready; this was the proving-ground
build before the version 2 rewrite.

### Added

- Solidity governance contracts deployed to Arc Testnet: WalletFactory,
  GuardedWallet, PolicyEngine, EscalationManager, AnomalyOracle, and
  VendorRegistry, with Foundry tests.
- Original operator console (foundry UI): agents, vendors, ledger,
  escalations, anomalies, and settings.
- Public explorer pages, badge routes, and an approver portal.
- SIWE wallet sign-in.
- Ponder indexer for contract events.
- TypeScript SDK (`@arcanum/sdk`) and Python SDK (`packages/sdk-py`).
- Documentation site workspace (`apps/docs`).

[Unreleased]: https://github.com/bunnyyxtan/ARCANUM/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/bunnyyxtan/ARCANUM/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/bunnyyxtan/ARCANUM/releases/tag/v1.0.0
