# Contributing

Thank you for helping build Arcanum. Keep changes small, reviewable, and honest
about what is testnet, demo-only, or still pending.

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

```bash
npm run typecheck
npm run build
npm run lint
npm --workspace @arcanum/web run build
```

For contract changes:

```bash
cd packages/contracts
forge build
forge test
```

For SDK changes, also run the package-specific build/typecheck/test scripts
where available.

## Pull Request Guidance

- Keep custody, auth, and data-isolation boundaries explicit.
- Do not mix broad refactors with feature work.
- Do not weaken SIWE/session checks, demo gating, service-role boundaries, or
  transaction confirmation handling.
- Add or update tests for contract, SDK, API, and security-sensitive changes.
- Keep docs builder-focused and clear about Arc Testnet status.
- Avoid adding hosted-service assumptions to self-hosted paths.

## Commit Style

Use concise conventional commits, for example:

```txt
feat(sdk): add guarded wallet execute helper
fix(api): enforce tenant filter on transfer list
docs: add dao treasury tutorial
```

## Security Reports

Do not open public issues with exploit details. Follow [SECURITY.md](./SECURITY.md).
