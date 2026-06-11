// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
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
        address predicted =
            factory.predictWallet(owner, "ResearchAgent", 0, defaultPolicy(), signers, council, 2);

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

    function test_createWalletIncrementsOwnerNonce() public {
        factory.createWallet(owner, "One", defaultPolicy(), _signers(), defaultCouncil(), 2);
        factory.createWallet(owner, "Two", defaultPolicy(), _signers(), defaultCouncil(), 2);

        assertEq(factory.nonces(owner), 2);
    }

    function _signers() private view returns (address[] memory signers) {
        signers = new address[](1);
        signers[0] = signer;
    }
}
