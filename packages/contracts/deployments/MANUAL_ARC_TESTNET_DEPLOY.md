# Manual Arc Testnet Deploy

This is a deploy-readiness checklist for Arcanum contracts. Do not run the broadcast command until `forge build` and `forge test` pass locally.

## Network

- Network: Arc Testnet
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- USDC token: `0x3600000000000000000000000000000000000000`

## Deploy Target

Run these commands from `packages/contracts`.

The deploy script is:

```powershell
script/DeployArcTestnet.s.sol:DeployArcTestnet
```

The script deploys, in order:

1. `PolicyEngine`
2. `EscalationManager`
3. `AnomalyOracle`
4. `VendorRegistry`
5. `WalletFactory`

`WalletFactory` is constructed with Arc Testnet USDC at `0x3600000000000000000000000000000000000000`.

The current architecture does not use a standalone `GuardedWallet` implementation address. `WalletFactory.createWallet` deploys full `GuardedWallet` instances directly with `new GuardedWallet{salt: salt}(...)`. Do not add or invent a `guardedWalletImpl` address.

## Required Environment Variables

Required by the Solidity script:

- `DEPLOYER_PRIVATE_KEY`
- `ANOMALY_ORACLE_PRIVATE_KEY`

`DEPLOYER_PRIVATE_KEY` signs the deployment transactions. `ANOMALY_ORACLE_PRIVATE_KEY` is only used by the script to derive `anomalySigner = vm.addr(ANOMALY_ORACLE_PRIVATE_KEY)` for the `AnomalyOracle` constructor; it does not sign deployment transactions in `DeployArcTestnet`.

Required by the Forge CLI command:

- `ARC_TESTNET_RPC`

Optional for explorer verification only, if Arcscan exposes a compatible verifier API:

- `ARCSCAN_API_KEY`
- `ETHERSCAN_API_KEY`

The script does not read `PRIVATE_KEY`, `ARC_RPC_URL`, `USDC`, owner/admin address, or verifier API variables.

## Set Environment Variables In PowerShell

Never paste private key values into chat, issues, pull requests, screenshots, or public logs.

```powershell
$env:ARC_TESTNET_RPC = "https://rpc.testnet.arc.network"
$env:DEPLOYER_PRIVATE_KEY = "<private key, do not commit>"
$env:ANOMALY_ORACLE_PRIVATE_KEY = "<private key, do not commit>"
```

Optional verification variables:

```powershell
$env:ARCSCAN_API_KEY = "<optional verifier key>"
$env:ETHERSCAN_API_KEY = "<optional verifier key>"
```

## Preflight Checks

```powershell
forge build
forge test
forge test --summary
```

Do not deploy if any of these fail.

## Dry Run

This simulates the script without broadcasting transactions.

```powershell
forge script script/DeployArcTestnet.s.sol:DeployArcTestnet --rpc-url $env:ARC_TESTNET_RPC --chain-id 5042002 -vvvv
```

## Broadcast Deploy

This is the real deployment command. Run it only after the dry run and tests pass.

```powershell
forge script script/DeployArcTestnet.s.sol:DeployArcTestnet --rpc-url $env:ARC_TESTNET_RPC --chain-id 5042002 --broadcast -vvvv
```

## Capture Deployed Addresses

The script writes:

```powershell
.\deployments\arc-testnet.json
```

Inspect it with:

```powershell
Get-Content .\deployments\arc-testnet.json | ConvertFrom-Json | Format-List
```

Forge also writes broadcast metadata under:

```powershell
.\broadcast\DeployArcTestnet.s.sol\5042002\run-latest.json
```

Capture transaction hashes with:

```powershell
$broadcast = Get-Content .\broadcast\DeployArcTestnet.s.sol\5042002\run-latest.json | ConvertFrom-Json
$broadcast.transactions | Select-Object contractName, contractAddress, hash
```

## Bytecode Checks

After deployment, every deployed contract address should return non-empty bytecode.

```powershell
$deploy = Get-Content .\deployments\arc-testnet.json | ConvertFrom-Json
cast code $deploy.policyEngine --rpc-url $env:ARC_TESTNET_RPC
cast code $deploy.escalationManager --rpc-url $env:ARC_TESTNET_RPC
cast code $deploy.anomalyOracle --rpc-url $env:ARC_TESTNET_RPC
cast code $deploy.vendorRegistry --rpc-url $env:ARC_TESTNET_RPC
cast code $deploy.walletFactory --rpc-url $env:ARC_TESTNET_RPC
cast code $deploy.usdc --rpc-url $env:ARC_TESTNET_RPC
```

The `usdc` check should return bytecode for the existing Arc Testnet USDC token. There is no `guardedWalletImpl` bytecode check because this deployment does not produce one.

## Update Frontend Environment

After deployment, update `apps/web/.env.local` with real deployed addresses:

```powershell
NEXT_PUBLIC_WALLET_FACTORY=<walletFactory from deployments/arc-testnet.json>
NEXT_PUBLIC_POLICY_ENGINE=<policyEngine from deployments/arc-testnet.json>
NEXT_PUBLIC_ESCALATION_MANAGER=<escalationManager from deployments/arc-testnet.json>
NEXT_PUBLIC_ANOMALY_ORACLE=<anomalyOracle from deployments/arc-testnet.json>
NEXT_PUBLIC_VENDOR_REGISTRY=<vendorRegistry from deployments/arc-testnet.json>
NEXT_PUBLIC_USDC=0x3600000000000000000000000000000000000000
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
```

Do not set any required `NEXT_PUBLIC_*` contract address to `0x0000000000000000000000000000000000000000` after deployment.

## Verify No Zero Placeholders Remain

```powershell
Select-String -Path ..\..\apps\web\.env.local -Pattern "NEXT_PUBLIC_(WALLET_FACTORY|POLICY_ENGINE|ESCALATION_MANAGER|ANOMALY_ORACLE|VENDOR_REGISTRY)"
```

Every value should be a real deployed `0x` address. `NEXT_PUBLIC_GUARDED_WALLET_IMPL` is obsolete for the current factory architecture and should not be required.

## Restart The Web App

After changing `apps/web/.env.local`, restart the npm dev server:

```powershell
cd ..\..
npm run dev
```

## Do Not Paste Publicly

- `DEPLOYER_PRIVATE_KEY`
- `ANOMALY_ORACLE_PRIVATE_KEY`
- `SIWE_SECRET`
- Database URLs or Redis tokens
- RPC URLs that include private API keys
- Raw terminal history that includes secrets
