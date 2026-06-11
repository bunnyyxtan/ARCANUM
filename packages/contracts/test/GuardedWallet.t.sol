// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import {
    FrozenWallet,
    InvalidCategory,
    InvalidModule,
    InvalidPolicy,
    NotAnomalyOracle,
    NotEscalationManager,
    NotOwner,
    NotSigner,
    ProtectedUSDC,
    TransferDenied,
    ZeroAddress
} from "../src/libraries/Errors.sol";
import {
    EscalationReason,
    ModuleKeys,
    PolicyEnvelope,
    RestraintCategory
} from "../src/libraries/PolicyTypes.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import { IVendorRegistry } from "../src/interfaces/IVendorRegistry.sol";
import { Events } from "../src/libraries/Events.sol";

contract GuardedWalletTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    function test_executeUSDC_allowsTransferWithinPolicy() public {
        vm.prank(signer);
        wallet.executeUSDC(openAi, 10 * USDC_1, bytes("model inference"));

        assertEq(usdc.balanceOf(openAi), 10 * USDC_1);
        assertEq(wallet.dailySpent(), 10 * USDC_1);
    }

    function test_constructorRejectsZeroOwnerAndInvalidPolicy() public {
        address[] memory signers = new address[](1);
        signers[0] = signer;

        vm.expectRevert(ZeroAddress.selector);
        new GuardedWallet(
            address(0),
            address(usdc),
            policyEngine,
            escalationManager,
            anomalyOracle,
            vendorRegistry,
            defaultPolicy(),
            signers,
            defaultCouncil(),
            2
        );

        PolicyEnvelope memory invalidPolicy = defaultPolicy();
        invalidPolicy.perTxCap = 0;

        vm.expectRevert(InvalidPolicy.selector);
        new GuardedWallet(
            owner,
            address(usdc),
            policyEngine,
            escalationManager,
            anomalyOracle,
            vendorRegistry,
            invalidPolicy,
            signers,
            defaultCouncil(),
            2
        );
    }

    function test_executeUSDC_revertsForZeroRecipient() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(signer);
        wallet.executeUSDC(address(0), 10 * USDC_1, bytes("zero"));
    }

    function test_executeUSDCRollsDailyWindow() public {
        vm.prank(signer);
        wallet.executeUSDC(openAi, 40 * USDC_1, bytes("first"));
        assertEq(wallet.dailySpent(), 40 * USDC_1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 10 * USDC_1, bytes("next day"));

        assertEq(wallet.dailySpent(), 10 * USDC_1);
        assertEq(wallet.lastSpendReset(), block.timestamp);
    }

    function test_executeUSDC_revertsForUnknownVendorWhenAllowlistRequired() public {
        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.ALLOWLIST_REQUIRED)
        );
        vm.prank(signer);
        wallet.executeUSDC(recipient, 10 * USDC_1, bytes("unknown"));
    }

    function test_executeUSDC_revertsAbovePerTxCap() public {
        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.PER_TX_CAP)
        );
        vm.prank(signer);
        wallet.executeUSDC(openAi, 101 * USDC_1, bytes("too much"));
    }

    function test_executeUSDC_revertsAboveDailyCap() public {
        PolicyEnvelope memory nextPolicy = defaultPolicy();
        nextPolicy.daily24hCap = 20 * USDC_1;
        nextPolicy.perTxCap = 20 * USDC_1;
        vm.prank(owner);
        wallet.setPolicy(nextPolicy);

        vm.prank(signer);
        wallet.executeUSDC(openAi, 15 * USDC_1, bytes("first"));

        vm.expectRevert(abi.encodeWithSelector(TransferDenied.selector, EscalationReason.DAILY_CAP));
        vm.prank(signer);
        wallet.executeUSDC(openAi, 10 * USDC_1, bytes("second"));
    }

    function test_executeUSDC_escalatesAboveThreshold() public {
        uint256 timestamp = block.timestamp;
        vm.prank(signer);
        wallet.executeUSDC(awsBedrock, 73 * USDC_1, bytes("GPU lease"));

        bytes32 escalationId =
            escalationIdFor(address(wallet), awsBedrock, 73 * USDC_1, 1, timestamp);
        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.PENDING)
        );
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_executeUSDC_freezesOnBlockedVendor() public {
        uint256 beforeBalance = usdc.balanceOf(address(wallet));
        vm.prank(signer);
        wallet.executeUSDC(evilVendor, 1 * USDC_1, bytes("blocked"));

        assertTrue(wallet.frozen());
        assertEq(usdc.balanceOf(address(wallet)), beforeBalance);
        assertEq(usdc.balanceOf(evilVendor), 0);
    }

    function test_executeUSDC_revertsWhenFrozen() public {
        vm.prank(signer);
        wallet.executeUSDC(evilVendor, 1 * USDC_1, bytes("blocked"));

        vm.expectRevert(FrozenWallet.selector);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 1 * USDC_1, bytes("still frozen"));
    }

    function test_onlySignerCanExecute() public {
        vm.expectRevert(NotSigner.selector);
        vm.prank(owner);
        wallet.executeUSDC(openAi, 1 * USDC_1, bytes("owner is not signer"));
    }

    function test_onlyOwnerCanSetPolicyAndRotateModules() public {
        PolicyEnvelope memory nextPolicy = defaultPolicy();
        nextPolicy.escalationThreshold = 25 * USDC_1;

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.setPolicy(nextPolicy);

        vm.expectRevert(NotOwner.selector);
        vm.prank(address(0x5555));
        wallet.setPolicy(nextPolicy);

        vm.expectEmit(true, false, false, false, address(wallet));
        emit Events.PolicyUpdated(address(wallet));
        vm.prank(owner);
        wallet.setPolicy(nextPolicy);
        (,,,, uint256 escalationThreshold,) = wallet.policy();
        assertEq(escalationThreshold, 25 * USDC_1);

        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(0));
        assertEq(address(wallet.anomalyOracle()), address(0));
    }

    function test_ownerCanRotateAllModules() public {
        PolicyEngine nextPolicyEngine = new PolicyEngine();
        EscalationManager nextEscalationManager = new EscalationManager();
        AnomalyOracle nextOracle = new AnomalyOracle(oracleSigner);
        VendorRegistry nextVendorRegistry = new VendorRegistry();

        vm.startPrank(owner);
        wallet.rotateModule(ModuleKeys.POLICY_ENGINE, address(nextPolicyEngine));
        wallet.rotateModule(ModuleKeys.ESCALATION_MANAGER, address(nextEscalationManager));
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(nextOracle));
        wallet.rotateModule(ModuleKeys.VENDOR_REGISTRY, address(nextVendorRegistry));
        vm.stopPrank();

        assertEq(address(wallet.policyEngine()), address(nextPolicyEngine));
        assertEq(address(wallet.escalationManager()), address(nextEscalationManager));
        assertEq(address(wallet.anomalyOracle()), address(nextOracle));
        assertEq(address(wallet.vendorRegistry()), address(nextVendorRegistry));
    }

    function test_rotateModuleRejectsInvalidModuleAndZeroRequiredModules() public {
        vm.expectRevert(InvalidModule.selector);
        vm.prank(owner);
        wallet.rotateModule(keccak256(bytes("UNKNOWN")), address(1));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.POLICY_ENGINE, address(0));
    }

    function test_executeEscalatedTransferGuardsCallerStateAndRecipient() public {
        vm.expectRevert(NotEscalationManager.selector);
        wallet.executeEscalatedTransfer(openAi, 1 * USDC_1);

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(address(escalationManager));
        wallet.executeEscalatedTransfer(address(0), 1 * USDC_1);

        vm.prank(signer);
        wallet.executeUSDC(evilVendor, 1 * USDC_1, bytes("blocked"));

        vm.expectRevert(FrozenWallet.selector);
        vm.prank(address(escalationManager));
        wallet.executeEscalatedTransfer(openAi, 1 * USDC_1);
    }

    function test_triggerFreezeOnlyOracle() public {
        vm.expectRevert(NotAnomalyOracle.selector);
        wallet.triggerFreeze(bytes("not oracle"));
    }

    function test_ownerCanManageSignersAndUnfreeze() public {
        vm.prank(owner);
        wallet.removeSigner(signer);
        assertFalse(wallet.agentSigners(signer));

        vm.prank(owner);
        wallet.addSigner(signer);
        assertTrue(wallet.agentSigners(signer));

        vm.prank(signer);
        wallet.executeUSDC(evilVendor, 1 * USDC_1, bytes("blocked"));
        assertTrue(wallet.frozen());

        vm.prank(owner);
        wallet.unfreeze();
        assertFalse(wallet.frozen());
    }

    function test_ownerSignerManagementEmitsIndexableEvents() public {
        address newSigner = address(0x6001);

        vm.expectEmit(true, true, false, false, address(wallet));
        emit Events.SignerAdded(address(wallet), newSigner);
        vm.prank(owner);
        wallet.addSigner(newSigner);
        assertTrue(wallet.agentSigners(newSigner));

        vm.expectEmit(true, true, false, false, address(wallet));
        emit Events.SignerRemoved(address(wallet), newSigner);
        vm.prank(owner);
        wallet.removeSigner(newSigner);
        assertFalse(wallet.agentSigners(newSigner));
    }

    function test_randomWalletCannotManageSigners() public {
        address randomWallet = address(0x6002);

        vm.expectRevert(NotOwner.selector);
        vm.prank(randomWallet);
        wallet.addSigner(randomWallet);

        vm.expectRevert(NotOwner.selector);
        vm.prank(randomWallet);
        wallet.removeSigner(signer);
    }

    function test_agentSignerCannotManageSigners() public {
        address nextSigner = address(0x6003);

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.addSigner(nextSigner);

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.removeSigner(signerTwo);
    }

    function test_duplicateSignerAuthorizationKeepsSignerAuthorized() public {
        assertTrue(wallet.agentSigners(signer));

        vm.prank(owner);
        wallet.addSigner(signer);

        assertTrue(wallet.agentSigners(signer));
    }

    function test_addSignerRejectsZeroAddress() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.addSigner(address(0));
    }

    function test_setPolicyRejectsInvalidPolicy() public {
        PolicyEnvelope memory invalidPolicy = defaultPolicy();
        invalidPolicy.perTxCap = invalidPolicy.daily24hCap + 1;

        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(owner);
        wallet.setPolicy(invalidPolicy);

        invalidPolicy = defaultPolicy();
        invalidPolicy.perTxCap = 0;

        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(owner);
        wallet.setPolicy(invalidPolicy);

        invalidPolicy = defaultPolicy();
        invalidPolicy.daily24hCap = 0;

        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(owner);
        wallet.setPolicy(invalidPolicy);

        invalidPolicy = defaultPolicy();
        invalidPolicy.escalationThreshold = 0;

        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(owner);
        wallet.setPolicy(invalidPolicy);
    }

    function test_ownerCanConfigureEscalationAndVendorRegistry() public {
        address nextCouncil = address(0x7777);
        address[] memory council = new address[](1);
        council[0] = nextCouncil;
        address newVendor = address(0x8888);

        vm.startPrank(owner);
        wallet.configureEscalation(council, 1, 2 hours);
        wallet.addVendor(
            newVendor, uint8(RestraintCategory.API), 3 * USDC_1, keccak256(bytes("vendor"))
        );
        wallet.blockVendor(newVendor);
        wallet.removeVendor(newVendor);
        wallet.setAnomalyFreezeThresholdBps(800);
        vm.stopPrank();

        assertTrue(escalationManager.isRequiredSigner(address(wallet), nextCouncil));
        assertFalse(vendorRegistry.isAllowedFor(address(wallet), newVendor));
        assertEq(wallet.anomalyFreezeThresholdBps(), 800);
    }

    function test_ownerCanAddUpdateBlockAndRemoveVendors() public {
        address newVendor = address(0x8889);
        bytes32 metadataHash = keccak256(bytes("vendor-v1"));

        vm.expectEmit(true, true, false, true, address(vendorRegistry));
        emit Events.VendorAdded(
            address(wallet), newVendor, uint8(RestraintCategory.API), 3 * USDC_1, metadataHash
        );
        vm.prank(owner);
        wallet.addVendor(newVendor, uint8(RestraintCategory.API), 3 * USDC_1, metadataHash);

        assertTrue(vendorRegistry.isAllowedFor(address(wallet), newVendor));
        assertEq(vendorRegistry.getVendorFor(address(wallet), newVendor).category, uint8(RestraintCategory.API));
        assertEq(vendorRegistry.getVendorFor(address(wallet), newVendor).perVendorCap, 3 * USDC_1);

        vm.expectEmit(true, true, false, false, address(vendorRegistry));
        emit Events.VendorBlocked(address(wallet), newVendor);
        vm.prank(owner);
        wallet.blockVendor(newVendor);

        assertFalse(vendorRegistry.isAllowedFor(address(wallet), newVendor));
        assertTrue(vendorRegistry.isBlockedFor(address(wallet), newVendor));

        bytes32 nextMetadataHash = keccak256(bytes("vendor-v2"));
        vm.prank(owner);
        wallet.addVendor(
            newVendor,
            uint8(RestraintCategory.COMPUTE),
            7 * USDC_1,
            nextMetadataHash
        );

        IVendorRegistry.Vendor memory updatedVendor =
            vendorRegistry.getVendorFor(address(wallet), newVendor);
        assertTrue(updatedVendor.allowed);
        assertFalse(updatedVendor.blocked);
        assertEq(updatedVendor.category, uint8(RestraintCategory.COMPUTE));
        assertEq(updatedVendor.perVendorCap, 7 * USDC_1);

        vm.expectEmit(true, true, false, false, address(vendorRegistry));
        emit Events.VendorRemoved(address(wallet), newVendor);
        vm.prank(owner);
        wallet.removeVendor(newVendor);

        assertFalse(vendorRegistry.isAllowedFor(address(wallet), newVendor));
        assertFalse(vendorRegistry.isBlockedFor(address(wallet), newVendor));
    }

    function test_randomWalletCannotManageVendors() public {
        address randomWallet = address(0x8890);

        vm.expectRevert(NotOwner.selector);
        vm.prank(randomWallet);
        wallet.addVendor(randomWallet, uint8(RestraintCategory.API), 0, bytes32(0));

        vm.expectRevert(NotOwner.selector);
        vm.prank(randomWallet);
        wallet.blockVendor(openAi);

        vm.expectRevert(NotOwner.selector);
        vm.prank(randomWallet);
        wallet.removeVendor(openAi);
    }

    function test_agentSignerCannotManageVendors() public {
        address newVendor = address(0x8891);

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.addVendor(newVendor, uint8(RestraintCategory.API), 0, bytes32(0));

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.blockVendor(openAi);

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.removeVendor(openAi);
    }

    function test_vendorManagementRejectsInvalidInputs() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.addVendor(address(0), uint8(RestraintCategory.API), 0, bytes32(0));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.blockVendor(address(0));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.removeVendor(address(0));

        vm.expectRevert(InvalidCategory.selector);
        vm.prank(owner);
        wallet.addVendor(address(0x8892), 99, 0, bytes32(0));
    }

    function test_sweepNonUSDCProtectsUSDC() public {
        vm.expectRevert(ProtectedUSDC.selector);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(usdc), owner, 1);
    }

    function test_sweepNonUSDCRejectsZeroAddresses() public {
        MockUSDC token = new MockUSDC();

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(token), address(0), 1);

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(0), owner, 1);
    }

    function test_sweepNonUSDCTransfersOtherToken() public {
        MockUSDC token = new MockUSDC();
        token.mint(address(wallet), 7);

        vm.prank(owner);
        wallet.sweepNonUSDC(address(token), owner, 7);
        assertEq(token.balanceOf(owner), 7);
    }
}
