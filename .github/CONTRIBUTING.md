# Contributing

Thank you for helping build Arcanum. Keep changes small, reviewable, and honest
about what is testnet-only or still pending.

Public app and docs: [https://thearcanum.in](https://thearcanum.in)

## Local Setup

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
npm run dev
```

Never commit `.env.local`, private keys, service-role keys, wallet secrets, or
generated build/cache output.

## Checks Before Opening a PR

CI runs these in this order and stops at the first failure, so run them in the
same order locally:

```bash
npm run lint --workspaces --if-present       # Biome: formatting and lint
npm run typecheck --workspaces --if-present  # tsc per workspace
npm run test --workspaces --if-present       # vitest: auth, api, indexer, sdk
npm run build                                # Next.js production build
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
- Do not weaken SIWE/session checks, service-role boundaries, or transaction
  confirmation handling.
- Add or update tests for contract, SDK, API, and security-sensitive changes.
  A change to `packages/auth`, `packages/api/src/rate-limit.ts`, or
  `packages/indexer/src/supabase-sync.ts` without a test needs a reason in
  the PR description.
- Keep docs builder-focused and clear about Arc Testnet status.
- Avoid adding hosted-service assumptions to self-hosted paths.

## Commit Style

Conventional commits, imperative mood, subject under 72 characters, with the
workspace as the scope:

```txt
feat(sdk): add guarded wallet execute helper
fix(api): enforce tenant filter on transfer list
docs: add dao treasury tutorial
```

The subject says what changed. The body says why, and is required for any
commit that touches authentication, session handling, policy evaluation,
service-role access, contracts, or a database migration: name the failure
mode or requirement that motivated the change, and what a reviewer should
check. Commits that only reformat or rename should say so, so the diff is
read at the right level of attention.

Do not squash unrelated changes into one commit, and do not use `chore:` for
work that changes behaviour.

## Security Reports

Do not open public issues with exploit details. Follow [SECURITY.md](./SECURITY.md).
