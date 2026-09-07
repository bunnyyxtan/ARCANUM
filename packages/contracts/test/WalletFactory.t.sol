// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { NotContract, ZeroAddress } from "../src/libraries/Errors.sol";
import { Events } from "../src/libraries/Events.sol";

contract WalletFactoryTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
    }

    function test_createWalletMatchesPrediction() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address predicted = factory.predictWallet(
            address(this),
            owner,
            "ResearchAgent",
            0,
            defaultPolicy(),
            signers,
            council,
            2,
            ESCALATION_EXPIRY
        );

        address deployed = factory.createWallet(
            owner, "ResearchAgent", defaultPolicy(), signers, council, 2, ESCALATION_EXPIRY
        );

        assertEq(deployed, predicted);
        assertEq(GuardedWallet(deployed).owner(), owner);
        assertTrue(GuardedWallet(deployed).agentSigners(signer));
    }

    function test_constructorRejectsZeroAndEOARequiredModules() public {
        vm.expectRevert(ZeroAddress.selector);
        new WalletFactory(protocolAdmin, address(0), _defaults(policyEngine));

        vm.expectRevert(NotContract.selector);
        new WalletFactory(protocolAdmin, owner, _defaults(policyEngine));

        WalletFactory.Defaults memory modules = _defaults(policyEngine);
        modules.policyEngine = PolicyEngine(owner);
        vm.expectRevert(NotContract.selector);
        new WalletFactory(protocolAdmin, address(usdc), modules);
    }

    function test_constructorSetsDefaultsVersionAndEmitsDefaults() public {
        vm.expectEmit(true, false, false, true);
        emit Events.DefaultsUpdated(
            1,
            address(policyEngine),
            address(escalationManager),
            address(anomalyOracle),
            address(vendorRegistry)
        );
        WalletFactory deployed =
            new WalletFactory(protocolAdmin, address(usdc), _defaults(policyEngine));

        assertEq(deployed.defaultsVersion(), 1);
    }

    function test_setDefaultsIsOnlyOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        factory.setDefaults(_defaults(policyEngine));
    }

    function test_setDefaultsRejectsEOAModule() public {
        WalletFactory.Defaults memory modules = _defaults(policyEngine);
        modules.policyEngine = PolicyEngine(owner);

        vm.expectRevert(NotContract.selector);
        vm.prank(protocolAdmin);
        factory.setDefaults(modules);
    }

    function test_setDefaultsBumpsVersionAndOnlyChangesFutureWallets() public {
        address first = _createWallet("First");
        PolicyEngine nextPolicyEngine = new PolicyEngine();
        WalletFactory.Defaults memory nextDefaults = _defaults(nextPolicyEngine);

        vm.expectEmit(true, false, false, true, address(factory));
        emit Events.DefaultsUpdated(
            2,
            address(nextPolicyEngine),
            address(escalationManager),
            address(anomalyOracle),
            address(vendorRegistry)
        );
        vm.prank(protocolAdmin);
        factory.setDefaults(nextDefaults);
        address second = _createWallet("Second");

        assertEq(factory.defaultsVersion(), 2);
        assertEq(address(GuardedWallet(first).policyEngine()), address(policyEngine));
        assertEq(address(GuardedWallet(second).policyEngine()), address(nextPolicyEngine));
    }

    function test_createWalletPassesEscalationExpirySeconds() public {
        uint64 expiry = 7 hours;
        address deployed = factory.createWallet(
            owner, "Expiry", defaultPolicy(), _signers(), defaultCouncil(), 2, expiry
        );

        vm.prank(deployed);
        IEscalationManager.Terms memory terms =
            escalationManager.holdTransfer(recipient, USDC_1, bytes("expiry"), 1);
        assertEq(terms.expiresAt, block.timestamp + expiry);
    }

    function test_createWalletEmitsDefaultsVersion() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address predicted = factory.predictWallet(
            address(this),
            owner,
            "Event",
            0,
            defaultPolicy(),
            signers,
            council,
            2,
            ESCALATION_EXPIRY
        );

        vm.expectEmit(true, true, false, true, address(factory));
        emit Events.WalletCreated(predicted, owner, "Event", 1, block.timestamp);
        factory.createWallet(
            owner, "Event", defaultPolicy(), signers, council, 2, ESCALATION_EXPIRY
        );
    }

    function test_predictionChangesWhenDefaultsChange() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address beforeUpdate = factory.predictWallet(
            address(this),
            owner,
            "Agent",
            0,
            defaultPolicy(),
            signers,
            council,
            2,
            ESCALATION_EXPIRY
        );

        PolicyEngine nextPolicyEngine = new PolicyEngine();
        vm.prank(protocolAdmin);
        factory.setDefaults(_defaults(nextPolicyEngine));
        address afterUpdate = factory.predictWallet(
            address(this),
            owner,
            "Agent",
            0,
            defaultPolicy(),
            signers,
            council,
            2,
            ESCALATION_EXPIRY
        );
        assertTrue(beforeUpdate != afterUpdate);
    }

    function test_createWalletRejectsZeroOwner() public {
        vm.expectRevert(ZeroAddress.selector);
        factory.createWallet(
            address(0),
            "ZeroOwner",
            defaultPolicy(),
            _signers(),
            defaultCouncil(),
            2,
            ESCALATION_EXPIRY
        );
    }

    function test_anyoneCanDeployForAnyOwner() public {
        address deployer = address(0xD00D);
        address targetOwner = address(0xB0B);

        vm.prank(deployer);
        address deployed = factory.createWallet(
            targetOwner,
            "Permissionless",
            defaultPolicy(),
            _signers(),
            defaultCouncil(),
            2,
            ESCALATION_EXPIRY
        );

        assertEq(GuardedWallet(deployed).owner(), targetOwner);
    }

    function test_createWalletIncrementsDeployerNonce() public {
        _createWallet("One");
        _createWallet("Two");

        assertEq(factory.nonces(address(this)), 2);
        assertEq(factory.nonces(owner), 0);
    }

    function test_predictionIsBoundToDeployer() public {
        address[] memory signers = _signers();
        address[] memory council = defaultCouncil();
        address rival = address(0xBEEF);
        address predictedForThis = factory.predictWallet(
            address(this),
            owner,
            "Agent",
            0,
            defaultPolicy(),
            signers,
            council,
            2,
            ESCALATION_EXPIRY
        );
        address predictedForRival = factory.predictWallet(
            rival, owner, "Agent", 0, defaultPolicy(), signers, council, 2, ESCALATION_EXPIRY
        );
        assertTrue(predictedForThis != predictedForRival);

        vm.prank(rival);
        address rivalDeployed = factory.createWallet(
            owner, "Agent", defaultPolicy(), signers, council, 2, ESCALATION_EXPIRY
        );
        assertEq(rivalDeployed, predictedForRival);

        address deployed = factory.createWallet(
            owner, "Agent", defaultPolicy(), signers, council, 2, ESCALATION_EXPIRY
        );
        assertEq(deployed, predictedForThis);
    }

    function _createWallet(string memory label) private returns (address) {
        return factory.createWallet(
            owner, label, defaultPolicy(), _signers(), defaultCouncil(), 2, ESCALATION_EXPIRY
        );
    }

    function _defaults(PolicyEngine engine)
        private
        view
        returns (WalletFactory.Defaults memory modules)
    {
        modules = WalletFactory.Defaults({
            policyEngine: engine,
            escalationManager: escalationManager,
            anomalyOracle: anomalyOracle,
            vendorRegistry: vendorRegistry
        });
    }

    function _signers() private view returns (address[] memory signers) {
        signers = new address[](1);
        signers[0] = signer;
    }
}
