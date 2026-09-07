// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { IAnomalyOracle } from "../src/interfaces/IAnomalyOracle.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import { IPolicyEngine } from "../src/interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "../src/interfaces/IVendorRegistry.sol";

/// @notice Shared deployment routine for Arc networks.
/// @dev Modules are deployed through CREATE2 with fixed salts so the addresses are a
///      function of the deployer and the bytecode alone, and the manifest records every
///      value an operator needs to verify the deployment or point an indexer at it.
///      Every input is asserted before the first broadcast: a wrong-chain deploy of a
///      permissionless factory cannot be undone.
abstract contract DeployArcBase is Script {
    struct Network {
        string name;
        uint256 chainId;
        address usdc;
        string manifestPath;
    }

    struct Deployed {
        PolicyEngine policyEngine;
        EscalationManager escalationManager;
        AnomalyOracle anomalyOracle;
        VendorRegistry vendorRegistry;
        WalletFactory walletFactory;
    }

    uint256 internal constant DEFAULT_MAX_SCORE_AGE = 1 days;

    function _deploy(Network memory network) internal returns (Deployed memory deployed) {
        require(block.chainid == network.chainId, "connected chain does not match network");
        require(network.usdc != address(0), "usdc is the zero address");
        require(network.usdc.code.length > 0, "usdc has no code on this chain");

        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address protocolAdmin = vm.envAddress("ARC_PROTOCOL_ADMIN");
        address oracleSigner = vm.envAddress("ANOMALY_ORACLE_SIGNER_ADDRESS");
        uint256 maxScoreAge = vm.envOr("ANOMALY_MAX_SCORE_AGE_SECONDS", DEFAULT_MAX_SCORE_AGE);
        require(protocolAdmin != address(0), "ARC_PROTOCOL_ADMIN is the zero address");
        require(oracleSigner != address(0), "ANOMALY_ORACLE_SIGNER_ADDRESS is the zero address");
        require(maxScoreAge > 0, "ANOMALY_MAX_SCORE_AGE_SECONDS must be positive");

        // The salt override exists for one case: a broadcast that stopped after some of
        // the modules were created, where the fixed salt would now collide.
        bytes32 salt = vm.envOr(
            "ARC_DEPLOY_SALT", keccak256(abi.encodePacked("arcanum.protocol.v2.", network.name))
        );
        uint256 startBlock = block.number;

        vm.startBroadcast(deployerPrivateKey);
        deployed.policyEngine = new PolicyEngine{ salt: salt }();
        deployed.escalationManager = new EscalationManager{ salt: salt }();
        deployed.anomalyOracle =
            new AnomalyOracle{ salt: salt }(protocolAdmin, oracleSigner, maxScoreAge);
        deployed.vendorRegistry = new VendorRegistry{ salt: salt }();
        deployed.walletFactory = new WalletFactory{ salt: salt }(
            protocolAdmin,
            network.usdc,
            WalletFactory.Defaults({
                policyEngine: deployed.policyEngine,
                escalationManager: deployed.escalationManager,
                anomalyOracle: deployed.anomalyOracle,
                vendorRegistry: deployed.vendorRegistry
            })
        );
        vm.stopBroadcast();

        _assertWired(deployed, network.usdc, protocolAdmin, oracleSigner);
        _writeManifest(network, deployed, deployer, protocolAdmin, oracleSigner, salt, startBlock);
    }

    function _assertWired(
        Deployed memory deployed,
        address usdc,
        address protocolAdmin,
        address oracleSigner
    ) private view {
        (
            IPolicyEngine policyEngine,
            IEscalationManager escalationManager,
            IAnomalyOracle anomalyOracle,
            IVendorRegistry vendorRegistry
        ) = deployed.walletFactory.defaults();
        require(
            address(policyEngine) == address(deployed.policyEngine),
            "factory policy engine mismatch"
        );
        require(
            address(escalationManager) == address(deployed.escalationManager),
            "factory escalation manager mismatch"
        );
        require(
            address(anomalyOracle) == address(deployed.anomalyOracle),
            "factory anomaly oracle mismatch"
        );
        require(
            address(vendorRegistry) == address(deployed.vendorRegistry),
            "factory vendor registry mismatch"
        );
        require(deployed.walletFactory.usdc() == usdc, "factory usdc mismatch");
        require(deployed.walletFactory.owner() == protocolAdmin, "factory owner mismatch");
        require(deployed.anomalyOracle.owner() == protocolAdmin, "oracle owner mismatch");
        require(deployed.anomalyOracle.oracleSigner() == oracleSigner, "oracle signer mismatch");
    }

    function _writeManifest(
        Network memory network,
        Deployed memory deployed,
        address deployer,
        address protocolAdmin,
        address oracleSigner,
        bytes32 salt,
        uint256 startBlock
    ) private {
        string memory root = network.name;
        vm.serializeUint(root, "chainId", network.chainId);
        vm.serializeString(root, "network", network.name);
        vm.serializeUint(root, "startBlock", startBlock);
        vm.serializeAddress(root, "usdc", network.usdc);
        vm.serializeAddress(root, "deployer", deployer);
        vm.serializeAddress(root, "protocolAdmin", protocolAdmin);
        vm.serializeAddress(root, "oracleSigner", oracleSigner);
        vm.serializeBytes32(root, "create2Salt", salt);
        vm.serializeAddress(root, "policyEngine", address(deployed.policyEngine));
        vm.serializeAddress(root, "escalationManager", address(deployed.escalationManager));
        vm.serializeAddress(root, "anomalyOracle", address(deployed.anomalyOracle));
        vm.serializeAddress(root, "vendorRegistry", address(deployed.vendorRegistry));
        vm.serializeAddress(root, "walletFactory", address(deployed.walletFactory));

        string memory hashes = "codeHashes";
        vm.serializeBytes32(hashes, "policyEngine", address(deployed.policyEngine).codehash);
        vm.serializeBytes32(
            hashes, "escalationManager", address(deployed.escalationManager).codehash
        );
        vm.serializeBytes32(hashes, "anomalyOracle", address(deployed.anomalyOracle).codehash);
        vm.serializeBytes32(hashes, "vendorRegistry", address(deployed.vendorRegistry).codehash);
        string memory hashesJson =
            vm.serializeBytes32(hashes, "walletFactory", address(deployed.walletFactory).codehash);

        string memory json = vm.serializeString(root, "codeHashes", hashesJson);
        vm.writeJson(json, network.manifestPath);
    }
}
