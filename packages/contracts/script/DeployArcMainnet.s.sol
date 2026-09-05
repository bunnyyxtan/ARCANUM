// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";

/// @notice Deploys Arcanum protocol modules to Arc Mainnet and writes local deployment metadata.
/// @dev Nothing about mainnet is hardcoded. Circle publishes the mainnet chain id and USDC address
///      at launch, so both are required environment values and the script reverts when either is
///      missing or does not match the connected chain. A wrong-chain broadcast is unrecoverable,
///      which is why this checks rather than defaults.
contract DeployArcMainnet is Script {
    /// @notice Broadcasts module deployments using DEPLOYER_PRIVATE_KEY.
    function run() external {
        // No default: an unset chain id must stop the deploy, not fall back to a
        // number nobody has confirmed. Checked before anything else so a wrong
        // network fails with the obvious reason.
        uint256 expectedChainId = vm.envUint("ARC_MAINNET_CHAIN_ID");
        require(block.chainid == expectedChainId, "connected chain is not Arc Mainnet");

        address usdc = vm.envAddress("ARC_MAINNET_USDC_ADDRESS");
        require(usdc != address(0), "ARC_MAINNET_USDC_ADDRESS is the zero address");
        require(usdc.code.length > 0, "ARC_MAINNET_USDC_ADDRESS has no code on this chain");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 anomalyOraclePrivateKey = vm.envUint("ANOMALY_ORACLE_PRIVATE_KEY");
        address anomalySigner = vm.addr(anomalyOraclePrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        PolicyEngine policyEngine = new PolicyEngine();
        EscalationManager escalationManager = new EscalationManager();
        AnomalyOracle anomalyOracle = new AnomalyOracle(anomalySigner);
        VendorRegistry vendorRegistry = new VendorRegistry();
        WalletFactory walletFactory =
            new WalletFactory(usdc, policyEngine, escalationManager, anomalyOracle, vendorRegistry);
        vm.stopBroadcast();

        string memory root = "arc-mainnet";
        vm.serializeAddress(root, "policyEngine", address(policyEngine));
        vm.serializeAddress(root, "escalationManager", address(escalationManager));
        vm.serializeAddress(root, "anomalyOracle", address(anomalyOracle));
        vm.serializeAddress(root, "vendorRegistry", address(vendorRegistry));
        vm.serializeAddress(root, "walletFactory", address(walletFactory));
        // The indexer starts its backfill here; without it Ponder scans from genesis.
        vm.serializeUint(root, "startBlock", block.number);
        string memory json = vm.serializeAddress(root, "usdc", usdc);
        vm.writeJson(json, "deployments/arc-mainnet.json");
    }
}
