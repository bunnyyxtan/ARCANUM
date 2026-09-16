# Arc Mainnet deployment runbook

Arc Mainnet moves real USDC. The protocol has unit tests, invariants and static analysis but no
independent audit, so a mainnet deployment is a limited pilot: small per-wallet limits, funds the
operator can afford to lose, and a way to pause (freeze) every wallet. Treat every step below as
a one-shot operation.

## Network

- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io` (Blockdaemon, dRPC and QuickNode also serve it)
- Explorer: `https://explorer.arc.io`
- USDC: `0x3600000000000000000000000000000000000000` (native asset; this precompile is its
  ERC-20 view; 18 decimals at the RPC level, 6 through the ERC-20 interface)

Gas is paid in USDC. The five deployment transactions simulate at about 5.83M gas in total, so
at the launch fee market (about 20 to 40 gwei) the deployment costs between roughly 0.12 and
0.25 USDC. Forge still requires the deployer to hold gas limit times max fee up front, about
0.31 USDC at the launch base fee; fund the deployer with 1 USDC.

Run every command below from `packages/contracts`.

## Required inputs

Set these values in the operator's secret environment. Never paste private keys into chat,
issues, pull requests, screenshots, or shell history.

- `DEPLOYER_PRIVATE_KEY`: signs the five deployment transactions. The CREATE2 addresses do not
  depend on the deployer: they depend on the salt, the bytecode and the constructor arguments,
  so any funded deployer produces the same addresses.
- `ARC_PROTOCOL_ADMIN`: owner of `WalletFactory` and `AnomalyOracle`. Use a hardware wallet or a
  multisig, not the deployer. This address is a constructor argument, so changing it changes
  the predicted addresses of those two modules.
- `ANOMALY_ORACLE_SIGNER_ADDRESS`: public address of the key held by the anomaly service. The
  corresponding private key must never be present on the deployment host.
- `ARC_MAINNET_CHAIN_ID=5042` and
  `ARC_MAINNET_USDC_ADDRESS=0x3600000000000000000000000000000000000000`: the deploy script
  requires both explicitly as a second confirmation of the target chain and reverts if either
  disagrees with the connected RPC.
- `ARC_MAINNET_RPC_URL`: the RPC used by the readiness check.
- `ANOMALY_MAX_SCORE_AGE_SECONDS` (optional): maximum accepted score age; defaults to `86400`.
- `ARC_DEPLOY_SALT` (optional, `bytes32` hex): overrides the fixed CREATE2 salt
  `keccak256("arcanum.protocol.v2.arc-mainnet")`. Leave it unset unless a previous broadcast
  stopped after creating some modules; the fixed salt would then collide. Record whatever value
  was used - the manifest stores it as `create2Salt`.

## Pre-flight

Do not broadcast until all of the following are true:

1. `ARC_PROTOCOL_ADMIN` is the final hardware-wallet or multisig address and its holder has
   confirmed it in writing.
2. `ANOMALY_ORACLE_SIGNER_ADDRESS` is the anomaly service's public key and differs from the
   deployer.
3. `forge build` and `forge test` pass from this directory. If `lib/` is absent, restore it at
   the pinned commits with `scripts/restore-foundry-deps.sh`.
4. The readiness check passes. It confirms the RPC serves chain 5042, that the deterministic
   CREATE2 deployer and USDC both have code, and that the deployer holds USDC:

   ```bash
   node scripts/check-arc-deploy-readiness.mjs --network mainnet
   ```

5. A dry run without `--broadcast` succeeds:

   ```bash
   forge script script/DeployArcMainnet.s.sol --rpc-url https://rpc.mainnet.arc.io
   ```

   The dry run writes a provisional `deployments/arc-mainnet.json`. Do not commit that file; the
   broadcast overwrites it.

6. The dry run's predicted CREATE2 addresses for `PolicyEngine`, `EscalationManager`,
   `AnomalyOracle`, `VendorRegistry`, and `WalletFactory` are recorded and independently
   reviewed, and none of them has code on mainnet yet (`cast code <address> --rpc-url ...`).

The script refuses a chain-ID mismatch, zero USDC, USDC without code, zero protocol admin, zero
oracle signer, or a non-positive score age before deployment. After deployment it asserts that
the factory defaults point to the four new modules, the factory uses Arc USDC, the factory and
oracle owners equal `ARC_PROTOCOL_ADMIN`, and the oracle signer matches
`ANOMALY_ORACLE_SIGNER_ADDRESS`. It then writes the addresses, principals, salt, start block,
and runtime code hashes to `deployments/arc-mainnet.json`.

## Broadcast

Arc has no verifier configuration in `foundry.toml`, so this runbook does not add `--verify`.
Source verification, if the explorer offers it, is a separate step after the manifest is
published.

```bash
forge script script/DeployArcMainnet.s.sol --rpc-url https://rpc.mainnet.arc.io --broadcast
```

Do not run the command again after a successful broadcast. If a broadcast stops part-way, do
not retry blindly: the modules already created keep the fixed salt occupied. Record which
modules exist, pick an `ARC_DEPLOY_SALT`, and rerun readiness with `--allow-redeploy` only after
the recovery has been reviewed.

## Finalize and publish the manifest

```bash
node scripts/finalize-manifest.mjs arc-mainnet https://rpc.mainnet.arc.io
```

This enriches the manifest from the broadcast record (`deployedAt`, `compiler`, `evmVersion`,
`txHashes`) and verifies every deployed runtime code hash against the chain. Review and commit
`deployments/arc-mainnet.json`; it is the deployment authority for the app, API, indexer and
SDKs. Do not copy addresses into a second source of truth.

## Release sequence

One deployment of the app serves one network, and one database serves one network: ledger
rows carry no chain id beyond the deployment identity, so mainnet and testnet rows must never
share the app tables. Either stand up a separate stack, or switch an existing stack in place
the way thearcanum.in was switched on 2026-09-16:

1. Commit the finalized manifest together with the mainnet code, from the repository root
   confirm the consumers accept it, then push:

   ```bash
   npm run test --workspace @arcanum/api -- src/deployment-manifest.test.ts
   npm run typecheck --workspace @arcanum/web
   ```

2. Database: a fresh Supabase project with the full migration set applied in order and
   `node scripts/check-definer-grants.mjs` run afterwards; or, for an in-place switch, stop the
   indexer schedule, take a full `pg_dump`, copy the app tables into an archive schema
   (`testnet_archive`), rename the indexer's `ponder_app` schema aside, then truncate every
   chain-derived table while keeping `profiles`, `organizations` and `organization_members`
   (accounts are chain-agnostic). Do the truncation only after the dump is verified.
3. Web and API host: the Vercel project (or environment) gets `NEXT_PUBLIC_ARC_NETWORK` and
   `ARC_NETWORK` set to `mainnet` before the mainnet commit is pushed, plus a fresh receipt
   issuer key whose address is registered for chain 5042 in
   `packages/shared/src/receipts/issuers.ts`. Never reuse the testnet issuer key. A separate
   stack additionally needs its own `ARCANUM_SIWE_DOMAIN`, `SIWE_SECRET` and Supabase variables.
4. Indexer: the scheduled top-up runs once per network against that network's database (see
   `docs/INDEXER-TOPUP.md` for which secret set belongs to which network) and, if the public RPC
   rate limits the backfill, an `INDEXER_RPC_URL`.
5. Agent signer: a Circle developer-controlled wallet for mainnet must be created with
   blockchain `EVM` (not `EVM-TESTNET`) under a production Circle API key, or use a plain EOA
   signer key that holds only the float the pilot needs.
6. Before announcing anything: create one governed wallet with a small cap, run one payment end
   to end, confirm the read model, receipt and explorer links all agree, then freeze it.
