# Contributing

Thank you for helping build Arcanum. Keep changes small, reviewable, and honest
about what runs on the Arc Mainnet pilot, what is testnet-only, and what is
still pending.

Public app and docs: [https://thearcanum.in](https://thearcanum.in)

## Local Setup

```bash
npm install
npm test
```

Contracts need [Foundry](https://getfoundry.sh) v1.5.1; run
`packages/contracts/scripts/restore-foundry-deps.sh` once before building.

Never commit `.env.local`, private keys, service-role keys, wallet secrets, or
generated build/cache output.

## Checks Before Opening a PR

CI runs these in this order and stops at the first failure, so run them in the
same order locally:

```bash
npm run lint --workspaces --if-present       # Biome: formatting and lint
npm run typecheck --workspaces --if-present  # tsc per workspace
npm run test --workspaces --if-present       # vitest: shared, sdk
npm run build                                # SDK build
```

A single unformatted line fails the lint step, and lint runs before anything
else, so a formatting slip hides every other result. Run
`npx biome check --write <files>` on what you touched before pushing.

For contract changes:

```bash
cd packages/contracts
forge fmt --check
forge build
forge test
```

For SDK changes, also run the package-specific build/typecheck/test scripts
where available.

## Pull Request Guidance

- Keep custody, auth, and data-isolation boundaries explicit.
- Do not mix broad refactors with feature work.
- Do not weaken receipt verification, signature checks, or transaction
  confirmation handling.
- Add or update tests for contract, SDK, and security-sensitive changes. A
  change to `packages/contracts/src` or `packages/shared/src/receipts` without
  a test needs a reason in the PR description.
- Keep docs builder-focused and clear about which network a feature or
  example targets; the hosted product runs on Arc Mainnet, and mainnet wallets
  hold real USDC.

## Commit Style

Conventional commits, imperative mood, subject under 72 characters, with the
workspace as the scope:

```txt
feat(sdk): add guarded wallet execute helper
fix(contracts): reject zero-amount escalations
docs: add dao treasury tutorial
```

The subject says what changed. The body says why, and is required for any
commit that touches authentication, session handling, policy evaluation,
receipts, or contracts: name the failure
mode or requirement that motivated the change, and what a reviewer should
check. Commits that only reformat or rename should say so, so the diff is
read at the right level of attention.

Do not squash unrelated changes into one commit, and do not use `chore:` for
work that changes behaviour.

## Security Reports

Do not open public issues with exploit details. Follow [SECURITY.md](./SECURITY.md).
