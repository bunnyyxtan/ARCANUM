// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";

import { DeployArcBase } from "../script/DeployArcBase.s.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";

contract DeployHarness is DeployArcBase {
    function deployTo(string memory manifestPath, address usdc)
        external
        returns (Deployed memory)
    {
        return _deploy(
            Network({ name: "arc-testnet", chainId: 5042002, usdc: usdc, manifestPath: manifestPath })
        );
    }
}

contract DeployArcBaseTest is Test {
    string internal constant MANIFEST_PATH = "out/test-manifest.json";

    uint256 internal constant DEPLOYER_KEY = 0xD3910;
    address internal constant PROTOCOL_ADMIN = address(0xADD);
    address internal constant ORACLE_SIGNER = address(0x516);
    bytes32 internal constant DEFAULT_SALT =
        keccak256(abi.encodePacked("arcanum.protocol.v2.", "arc-testnet"));

    DeployHarness internal harness;
    MockUSDC internal usdc;

    function setUp() external {
        vm.chainId(5042002);
        usdc = new MockUSDC();
        harness = new DeployHarness();
        vm.setEnv("DEPLOYER_PRIVATE_KEY", vm.toString(bytes32(DEPLOYER_KEY)));
        vm.setEnv("ARC_PROTOCOL_ADMIN", vm.toString(PROTOCOL_ADMIN));
        vm.setEnv("ANOMALY_ORACLE_SIGNER_ADDRESS", vm.toString(ORACLE_SIGNER));
        vm.setEnv("ANOMALY_MAX_SCORE_AGE_SECONDS", "3600");
        vm.roll(12_345);
    }

    function test_writesManifestWithEveryConsumerField() external {
        DeployArcBase.Deployed memory deployed = harness.deployTo(MANIFEST_PATH, address(usdc));
        string memory json = vm.readFile(MANIFEST_PATH);

        assertEq(vm.parseJsonUint(json, ".chainId"), 5042002);
        assertEq(vm.parseJsonString(json, ".network"), "arc-testnet");
        assertEq(vm.parseJsonUint(json, ".startBlock"), 12_345);
        assertEq(vm.parseJsonAddress(json, ".deployer"), vm.addr(DEPLOYER_KEY));
        assertEq(vm.parseJsonAddress(json, ".protocolAdmin"), PROTOCOL_ADMIN);
        assertEq(vm.parseJsonAddress(json, ".oracleSigner"), ORACLE_SIGNER);
        assertEq(vm.parseJsonAddress(json, ".usdc"), address(usdc));
        assertEq(vm.parseJsonBytes32(json, ".create2Salt"), DEFAULT_SALT);
        assertEq(vm.parseJsonAddress(json, ".policyEngine"), address(deployed.policyEngine));
        assertEq(
            vm.parseJsonAddress(json, ".escalationManager"), address(deployed.escalationManager)
        );
        assertEq(vm.parseJsonAddress(json, ".anomalyOracle"), address(deployed.anomalyOracle));
        assertEq(vm.parseJsonAddress(json, ".vendorRegistry"), address(deployed.vendorRegistry));
        assertEq(vm.parseJsonAddress(json, ".walletFactory"), address(deployed.walletFactory));
        assertEq(
            vm.parseJsonBytes32(json, ".codeHashes.walletFactory"),
            address(deployed.walletFactory).codehash
        );
        assertEq(
            vm.parseJsonBytes32(json, ".codeHashes.policyEngine"),
            address(deployed.policyEngine).codehash
        );
    }

    function test_wiresOwnershipAndDefaults() external {
        DeployArcBase.Deployed memory deployed = harness.deployTo(MANIFEST_PATH, address(usdc));

        assertEq(deployed.walletFactory.owner(), PROTOCOL_ADMIN);
        assertEq(deployed.anomalyOracle.owner(), PROTOCOL_ADMIN);
        assertEq(deployed.anomalyOracle.oracleSigner(), ORACLE_SIGNER);
        assertEq(deployed.anomalyOracle.maxScoreAge(), 3600);
        assertEq(address(deployed.walletFactory.usdc()), address(usdc));
    }

    function test_refusesWrongChain() external {
        vm.chainId(1);
        vm.expectRevert("connected chain does not match network");
        harness.deployTo(MANIFEST_PATH, address(usdc));
    }

    function test_refusesUsdcWithoutCode() external {
        vm.expectRevert("usdc has no code on this chain");
        harness.deployTo(MANIFEST_PATH, address(0xBEEF));
    }
}
