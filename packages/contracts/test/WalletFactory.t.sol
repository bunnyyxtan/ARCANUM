// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { ZeroAddress } from "../src/libraries/Errors.sol";

contract WalletFactoryTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
    }

    function test_createWalletMatchesPrediction() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address predicted = factory.predictWallet(
            address(this), owner, "ResearchAgent", 0, defaultPolicy(), signers, council, 2
        );

        address deployed =
            factory.createWallet(owner, "ResearchAgent", defaultPolicy(), signers, council, 2);

        assertEq(deployed, predicted);
        assertEq(GuardedWallet(deployed).owner(), owner);
        assertTrue(GuardedWallet(deployed).agentSigners(signer));
    }

    function test_constructorRejectsZeroRequiredModules() public {
        vm.expectRevert(ZeroAddress.selector);
        new WalletFactory(
            address(0), policyEngine, escalationManager, anomalyOracle, vendorRegistry
        );

        vm.expectRevert(ZeroAddress.selector);
        new WalletFactory(
            address(usdc),
            policyEngine,
            escalationManager,
            anomalyOracle,
            VendorRegistry(address(0))
        );
    }

    /// @dev The factory's modules are immutable, so a zero oracle here would opt every
    ///      wallet it ever creates out of anomaly freezes with no way back.
    function test_constructorRejectsZeroAnomalyOracle() public {
        vm.expectRevert(ZeroAddress.selector);
        new WalletFactory(
            address(usdc),
            policyEngine,
            escalationManager,
            AnomalyOracle(address(0)),
            vendorRegistry
        );
    }

    function test_createWalletRejectsZeroOwner() public {
        vm.expectRevert(ZeroAddress.selector);
        factory.createWallet(
            address(0), "ZeroOwner", defaultPolicy(), _signers(), defaultCouncil(), 2
        );
    }

    function test_anyoneCanDeployForAnyOwner() public {
        address deployer = address(0xD00D);
        address targetOwner = address(0xB0B);

        vm.prank(deployer);
        address deployed = factory.createWallet(
            targetOwner, "Permissionless", defaultPolicy(), _signers(), defaultCouncil(), 2
        );

        assertEq(GuardedWallet(deployed).owner(), targetOwner);
    }

    function test_createWalletIncrementsDeployerNonce() public {
        factory.createWallet(owner, "One", defaultPolicy(), _signers(), defaultCouncil(), 2);
        factory.createWallet(owner, "Two", defaultPolicy(), _signers(), defaultCouncil(), 2);

        assertEq(factory.nonces(address(this)), 2);
        assertEq(factory.nonces(owner), 0);
    }

    function test_predictionIsBoundToDeployer() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address rival = address(0xBEEF);

        address predictedForThis = factory.predictWallet(
            address(this), owner, "Agent", 0, defaultPolicy(), signers, council, 2
        );
        address predictedForRival =
            factory.predictWallet(rival, owner, "Agent", 0, defaultPolicy(), signers, council, 2);
        assertTrue(predictedForThis != predictedForRival);

        vm.prank(rival);
        address rivalDeployed =
            factory.createWallet(owner, "Agent", defaultPolicy(), signers, council, 2);
        assertEq(rivalDeployed, predictedForRival);

        address deployed =
            factory.createWallet(owner, "Agent", defaultPolicy(), signers, council, 2);
        assertEq(deployed, predictedForThis);
    }

    function _signers() private view returns (address[] memory signers) {
        signers = new address[](1);
        signers[0] = signer;
    }
}
