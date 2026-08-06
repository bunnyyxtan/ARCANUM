## What changed

Describe the change and why it is needed.

## How it was verified

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `forge test` (only for contract changes)

## Notes for reviewers

Call out anything risky: schema changes, contract changes, auth/session
changes, or anything that affects the Supabase read model.

## Checklist

- [ ] No `.env.local`, private keys, service-role keys, or generated output staged
- [ ] User-facing copy has no internal infrastructure jargon
- [ ] Testnet-only behavior stays clearly labeled as testnet
