// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Script } from "forge-std/Script.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { PolicyEnvelope, RestraintCategory } from "../src/libraries/PolicyTypes.sol";

/// @notice Deploys a Helix DAO demo fixture with one ResearchAgent GuardedWallet.
contract DeployHelixDAOFixture is Script {
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;
    uint256 internal constant USDC_1 = 1e6;

    /// @notice Broadcasts demo fixture deployment using DEPLOYER_PRIVATE_KEY.
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        uint256 anomalyOraclePrivateKey = vm.envUint("ANOMALY_ORACLE_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address anomalySigner = vm.addr(anomalyOraclePrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        PolicyEngine policyEngine = new PolicyEngine();
        EscalationManager escalationManager = new EscalationManager();
        AnomalyOracle anomalyOracle = new AnomalyOracle(anomalySigner);
        VendorRegistry vendorRegistry = new VendorRegistry();
        WalletFactory walletFactory = new WalletFactory(
            ARC_TESTNET_USDC, policyEngine, escalationManager, anomalyOracle, vendorRegistry
        );

        address walletAddress = walletFactory.createWallet(
            deployer, "ResearchAgent", _policy(), _agentSigners(deployer), _council(deployer), 2
        );
        GuardedWallet wallet = GuardedWallet(walletAddress);

        wallet.addVendor(
            _namedAddress("OpenAI"),
            uint8(RestraintCategory.API),
            1_000 * USDC_1,
            keccak256(bytes("OpenAI"))
        );
        wallet.addVendor(
            _namedAddress("Anthropic"),
            uint8(RestraintCategory.API),
            1_000 * USDC_1,
            keccak256(bytes("Anthropic"))
        );
        wallet.addVendor(
            _namedAddress("Tavily"),
            uint8(RestraintCategory.DATA),
            250 * USDC_1,
            keccak256(bytes("Tavily"))
        );
        wallet.addVendor(
            _namedAddress("GitHub"),
            uint8(RestraintCategory.API),
            500 * USDC_1,
            keccak256(bytes("GitHub"))
        );
        wallet.addVendor(
            _namedAddress("AWS Bedrock"),
            uint8(RestraintCategory.COMPUTE),
            500 * USDC_1,
            keccak256(bytes("AWS Bedrock"))
        );
        address blockedVendor = _namedAddress("evil-data-broker.com");
        wallet.addVendor(
            blockedVendor,
            uint8(RestraintCategory.DATA),
            0,
            keccak256(bytes("evil-data-broker.com"))
        );
        wallet.blockVendor(blockedVendor);
        vm.stopBroadcast();

        string memory root = "helix-dao-fixture";
        vm.serializeAddress(root, "policyEngine", address(policyEngine));
        vm.serializeAddress(root, "escalationManager", address(escalationManager));
        vm.serializeAddress(root, "anomalyOracle", address(anomalyOracle));
        vm.serializeAddress(root, "vendorRegistry", address(vendorRegistry));
        vm.serializeAddress(root, "walletFactory", address(walletFactory));
        string memory json = vm.serializeAddress(root, "researchAgent", walletAddress);
        vm.writeJson(json, "deployments/helix-dao-fixture.json");
    }

    function _policy() private pure returns (PolicyEnvelope memory policy) {
        policy = PolicyEnvelope({
            perTxCap: 100 * USDC_1,
            daily24hCap: 1_000 * USDC_1,
            monthlyRollingCap: 30_000 * USDC_1,
            allowedCategories: (uint256(1) << uint8(RestraintCategory.API))
                | (uint256(1) << uint8(RestraintCategory.COMPUTE))
                | (uint256(1) << uint8(RestraintCategory.DATA))
                | (uint256(1) << uint8(RestraintCategory.SUBCONTRACTING))
                | (uint256(1) << uint8(RestraintCategory.OTHER)),
            escalationThreshold: 50 * USDC_1,
            requireAllowlist: true
        });
    }

    function _agentSigners(address deployer) private pure returns (address[] memory signers) {
        signers = new address[](5);
        signers[0] = deployer;
        signers[1] = _offsetAddress(deployer, 1);
        signers[2] = _offsetAddress(deployer, 2);
        signers[3] = _offsetAddress(deployer, 3);
        signers[4] = _offsetAddress(deployer, 4);
    }

    function _council(address deployer) private pure returns (address[] memory council) {
        council = new address[](3);
        council[0] = deployer;
        council[1] = _offsetAddress(deployer, 11);
        council[2] = _offsetAddress(deployer, 12);
    }

    function _namedAddress(string memory label) private pure returns (address) {
        return address(uint160(uint256(keccak256(bytes(label)))));
    }

    function _offsetAddress(address base, uint160 offset) private pure returns (address) {
        return address(uint160(base) + offset);
    }
}
