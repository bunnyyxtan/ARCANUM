// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";

/// @notice Deploys Arcanum protocol modules to Arc Testnet and writes local deployment metadata.
contract DeployArcTestnet is Script {
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    /// @notice Broadcasts module deployments using DEPLOYER_PRIVATE_KEY.
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 anomalyOraclePrivateKey = vm.envUint("ANOMALY_ORACLE_PRIVATE_KEY");
        address anomalySigner = vm.addr(anomalyOraclePrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        PolicyEngine policyEngine = new PolicyEngine();
        EscalationManager escalationManager = new EscalationManager();
        AnomalyOracle anomalyOracle = new AnomalyOracle(anomalySigner);
        VendorRegistry vendorRegistry = new VendorRegistry();
        WalletFactory walletFactory = new WalletFactory(
            ARC_TESTNET_USDC, policyEngine, escalationManager, anomalyOracle, vendorRegistry
        );
        vm.stopBroadcast();

        string memory root = "arc-testnet";
        vm.serializeAddress(root, "policyEngine", address(policyEngine));
        vm.serializeAddress(root, "escalationManager", address(escalationManager));
        vm.serializeAddress(root, "anomalyOracle", address(anomalyOracle));
        vm.serializeAddress(root, "vendorRegistry", address(vendorRegistry));
        vm.serializeAddress(root, "walletFactory", address(walletFactory));
        string memory json = vm.serializeAddress(root, "usdc", ARC_TESTNET_USDC);
        vm.writeJson(json, "deployments/arc-testnet.json");
    }
}
