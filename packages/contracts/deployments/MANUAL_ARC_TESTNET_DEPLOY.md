# Arc Testnet v2 deployment runbook

This deployment is the final protocol redeploy. Treat it as a one-shot production-style
operation even though the target is Arc Testnet.

## Network

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- USDC: `0x3600000000000000000000000000000000000000`

Run every command below from `packages/contracts`.

## Required inputs

Set these values in the operator's secret environment. Never paste private keys into chat,
issues, pull requests, screenshots, or shell history.

- `DEPLOYER_PRIVATE_KEY`: signs the five deployment transactions.
- `ARC_PROTOCOL_ADMIN`: owner of `WalletFactory` and `AnomalyOracle`. Use the final hardware
  wallet or multisig address, not the deployer.
- `ANOMALY_ORACLE_SIGNER_ADDRESS`: public address of the key held by the anomaly service. The
  corresponding private key must never be present on the deployment host.
- `ANOMALY_MAX_SCORE_AGE_SECONDS` (optional): maximum accepted score age; defaults to `86400`.
- `ARC_DEPLOY_SALT` (optional, `bytes32` hex): overrides the fixed CREATE2 salt
  `keccak256("arcanum.protocol.v2.<network>")`. Leave it unset unless a previous broadcast
  stopped after creating some modules; the fixed salt would then collide. Record whatever value
  was used - the manifest stores it as `create2Salt`.

`ARC_TESTNET_RPC` is required by the readiness command. The Forge commands below use the
canonical public RPC explicitly.

## Pre-flight

Do not broadcast until all of the following are true:

1. `ARC_PROTOCOL_ADMIN` is the final hardware-wallet or multisig address.
2. `ANOMALY_ORACLE_SIGNER_ADDRESS` is the anomaly service's public key and differs from the
   deployer.
3. The deployment salt is selected and recorded.
4. `forge build` and `forge test` pass from this directory. If `lib/` is absent, restore it at
   the pinned commits with `scripts/restore-foundry-deps.sh`.
5. The readiness check confirms that the deterministic CREATE2 deployer and Arc Testnet USDC
   both have code:

   ```bash
   node scripts/check-arc-deploy-readiness.mjs
   ```

6. A dry run without `--broadcast` succeeds:

   ```bash
   forge script script/DeployArcTestnet.s.sol --rpc-url https://rpc.testnet.arc.network
   ```

7. The dry run's predicted CREATE2 addresses for `PolicyEngine`, `EscalationManager`,
   `AnomalyOracle`, `VendorRegistry`, and `WalletFactory` are recorded and independently
   reviewed.

The script refuses a chain-ID mismatch, zero USDC, USDC without code, zero protocol admin, zero
oracle signer, or a non-positive score age before deployment. After deployment it asserts that
the factory defaults point to the four new modules, the factory uses Arc Testnet USDC, the
factory and oracle owners equal `ARC_PROTOCOL_ADMIN`, and the oracle signer matches
`ANOMALY_ORACLE_SIGNER_ADDRESS`. It then writes the addresses, principals, salt, start block,
and runtime code hashes to `deployments/arc-testnet.json`.

## Broadcast

Arc has no verifier configuration in `foundry.toml` and the documentation does not identify a
compatible verifier API, so this runbook does not add `--verify`.

```bash
forge script script/DeployArcTestnet.s.sol --rpc-url https://rpc.testnet.arc.network --broadcast
```

Do not run the command again after a successful broadcast. If an explicitly approved recovery
requires replacing an existing v2 manifest, rerun readiness with `--allow-redeploy`; that flag
only acknowledges the local manifest and does not make a redeploy safe.

## Finalize and publish the manifest

The Forge script writes the base manifest. Enrich it from the broadcast record and verify each
deployed runtime code hash against the chain:

```bash
node scripts/finalize-manifest.mjs arc-testnet https://rpc.testnet.arc.network
```

The finalized manifest contains:

- `chainId`, `network`, `deployer`, `protocolAdmin`, `oracleSigner`, and `create2Salt`
- `startBlock`, `usdc`, and all five module addresses
- `codeHashes` for all five modules
- `deployedAt`, `compiler`, `evmVersion`, and each deployment transaction in `txHashes`

Do **not** run `node scripts/export-abis.mjs` after deployment. ABIs are generated from contract
source and compiler output, not from deployed addresses; the v2 ABIs are already committed.

Review and commit `deployments/arc-testnet.json`. The manifest is the deployment authority for
the app and indexer; do not copy addresses into a second source of truth.

## Release sequence

`main` is production: every push to it deploys thearcanum.in through Vercel, and the scheduled
top-up job indexes from it. The v2 code and the v2 manifest must therefore reach `main` in one
push, after the database is ready for them. Work on the release branch until step 7.

1. Deploy and finalize from the release branch as described above, then commit
   `deployments/arc-testnet.json` to that branch. From the repository root confirm the
   consumers accept the finalized file before pushing:

   ```bash
   npm run test --workspace @arcanum/api -- src/deployment-manifest.test.ts
   npm run typecheck --workspace @arcanum/web
   ```

2. Push the branch. Vercel builds a preview of it against the real manifest; do not continue
   until that preview build is green and its `/api` health responds.
3. Disable the scheduled top-up (`gh workflow disable indexer-topup.yml`) and confirm no run is
   in progress. Nothing may write to `ledger_events` during step 4.
4. Apply the pending migrations to the production database in this order, each with
   `psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f <file>`. `20260907000000`, `20260907120000`
   and `20260907130000` are already applied and recorded in
   `supabase_migrations.schema_migrations`.

   - `20260907140000_record_created_wallet_rpc.sql`
   - `20260907142000_escalation_v2_statuses.sql` (enum values; runs outside a transaction)
   - `20260907143000_anomaly_decision_actor.sql`
   - `20260907150000_ledger_event_identity_log_index.sql`

   Record each in `supabase_migrations.schema_migrations (version, name)` and run
   `node scripts/check-definer-grants.mjs` from the repository root afterwards.
5. Vercel production environment: `ARCANUM_SIWE_DOMAIN=thearcanum.in` is already set. Delete
   `NEXT_PUBLIC_WALLET_FACTORY`, `NEXT_PUBLIC_POLICY_ENGINE`, `NEXT_PUBLIC_ESCALATION_MANAGER`,
   `NEXT_PUBLIC_ANOMALY_ORACLE`, `NEXT_PUBLIC_VENDOR_REGISTRY` and `NEXT_PUBLIC_USDC`; nothing
   reads them any more and leaving them invites a second source of truth. Keep
   `ARC_TESTNET_RPC`, the Supabase variables and `SIWE_SECRET`.
6. Reset the indexer state so it starts at the v2 `startBlock` instead of resuming v1
   bookkeeping:

   ```bash
   psql "$INDEXER_DATABASE_URL" -v ON_ERROR_STOP=1 -c 'drop schema if exists ponder_app cascade;'
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -c "delete from public.indexer_checkpoints where chain_id = 5042002 and contract_name like 'arcanum-indexer%';"
   ```

   Reuse `ponder_app`; choosing another schema name also requires changing the top-up job.
7. Fast-forward `main` to the release branch and push. Vercel deploys production from the
   manifest; confirm `/api` health and that the agent registry loads (legacy v1 wallets are
   counted, not listed).
8. Run the top-up once by hand (`gh workflow run indexer-topup.yml`) and confirm the log reports
   chain `5042002` with the v2 `startBlock` and that `indexer_checkpoints.last_block` advances.
   Then re-enable the schedule (`gh workflow enable indexer-topup.yml`).
9. Publish `arcanum-sdk@3.0.0` (`npm run build:publish --workspace @arcanum/sdk`, then publish
   `dist-publish`) and `arcanum-sdk` 3.0.0 on PyPI from `packages/sdk-py`.

The 14 wallets created on the v1 testnet deployment continue to work against their v1 modules.
The app and indexer follow only the current manifest, so those wallets become legacy: the API
excludes them from every wallet read and reports their count, and the registry shows one notice.
Their owners must redeploy through the v2 `WalletFactory`; there is no operator-side migration
that can replace an owner-controlled wallet.
