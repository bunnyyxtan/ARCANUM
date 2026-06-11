// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { PolicyEnvelope, RestraintCategory } from "../src/libraries/PolicyTypes.sol";

abstract contract ArcanumTestBase is Test {
    MockUSDC internal usdc;
    PolicyEngine internal policyEngine;
    EscalationManager internal escalationManager;
    AnomalyOracle internal anomalyOracle;
    VendorRegistry internal vendorRegistry;
    WalletFactory internal factory;
    GuardedWallet internal wallet;

    uint256 internal oraclePrivateKey = 0xA11CE;
    address internal oracleSigner;
    address internal owner = address(0x1001);
    address internal signer = address(0x2001);
    address internal signerTwo = address(0x2002);
    address internal councilOne = address(0x3001);
    address internal councilTwo = address(0x3002);
    address internal councilThree = address(0x3003);
    address internal openAi = address(0x4001);
    address internal awsBedrock = address(0x4002);
    address internal evilVendor = address(0x4666);
    address internal recipient = address(0x5001);

    uint256 internal constant USDC_1 = 1e6;

    function setUpProtocol() internal {
        oracleSigner = vm.addr(oraclePrivateKey);
        usdc = new MockUSDC();
        policyEngine = new PolicyEngine();
        escalationManager = new EscalationManager();
        anomalyOracle = new AnomalyOracle(oracleSigner);
        vendorRegistry = new VendorRegistry();
        factory = new WalletFactory(
            address(usdc), policyEngine, escalationManager, anomalyOracle, vendorRegistry
        );
    }

    function deployDefaultWallet() internal returns (GuardedWallet deployedWallet) {
        address[] memory signers = new address[](2);
        signers[0] = signer;
        signers[1] = signerTwo;

        address[] memory council = defaultCouncil();
        address walletAddress =
            factory.createWallet(owner, "ResearchAgent", defaultPolicy(), signers, council, 2);
        deployedWallet = GuardedWallet(walletAddress);
        wallet = deployedWallet;

        usdc.mint(address(deployedWallet), 2_000 * USDC_1);

        vm.startPrank(owner);
        deployedWallet.addVendor(
            openAi, uint8(RestraintCategory.API), 0, keccak256(bytes("openai"))
        );
        deployedWallet.addVendor(
            awsBedrock, uint8(RestraintCategory.COMPUTE), 500 * USDC_1, keccak256(bytes("aws"))
        );
        deployedWallet.addVendor(
            evilVendor, uint8(RestraintCategory.DATA), 0, keccak256(bytes("evil"))
        );
        deployedWallet.blockVendor(evilVendor);
        vm.stopPrank();
    }

    function defaultPolicy() internal pure returns (PolicyEnvelope memory policy) {
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

    function defaultCouncil() internal view returns (address[] memory council) {
        council = new address[](3);
        council[0] = councilOne;
        council[1] = councilTwo;
        council[2] = councilThree;
    }

    function escalationIdFor(
        address walletAddress,
        address to,
        uint256 amount,
        uint256 nonce,
        uint256 timestamp
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(walletAddress, to, amount, nonce, timestamp));
    }
}
