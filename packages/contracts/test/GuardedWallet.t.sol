// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import {
    EscalationNotPending,
    FrozenWallet,
    InvalidCategory,
    InvalidModule,
    InvalidPolicy,
    NotAnomalyOracle,
    NotContract,
    NotEscalationManager,
    NotOwner,
    NotPendingOwner,
    NotSigner,
    ProtectedUSDC,
    TransferDenied,
    ZeroAddress,
    ZeroAmount
} from "../src/libraries/Errors.sol";
import {
    EscalationReason,
    FreezeSource,
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
        assertEq(wallet.monthlySpent(), 10 * USDC_1);
    }

    function test_executeUSDC_revertsForInvalidAmountRecipientAndCaller() public {
        vm.expectRevert(ZeroAmount.selector);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 0, bytes("zero"));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(signer);
        wallet.executeUSDC(address(0), USDC_1, bytes("zero recipient"));

        vm.expectRevert(NotSigner.selector);
        vm.prank(owner);
        wallet.executeUSDC(openAi, USDC_1, bytes("owner"));
    }

    function test_executeUSDC_revertsForPolicyDenials() public {
        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.ALLOWLIST_REQUIRED)
        );
        vm.prank(signer);
        wallet.executeUSDC(recipient, USDC_1, bytes("unknown"));

        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.PER_TX_CAP)
        );
        vm.prank(signer);
        wallet.executeUSDC(openAi, 101 * USDC_1, bytes("too much"));
    }

    function test_executeUSDCUsesFixedDailyWindowIndexes() public {
        _setCaps(1_000 * USDC_1, 1_000 * USDC_1, 30_000 * USDC_1);
        uint256 boundary = 10 days;

        vm.warp(boundary - 1);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 1_000 * USDC_1, bytes("previous day"));
        vm.warp(boundary + 1);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 1_000 * USDC_1, bytes("next day"));

        assertEq(wallet.dailySpent(), 1_000 * USDC_1);
        assertEq(wallet.spendDay(), (boundary + 1) / 1 days);
    }

    function test_executeUSDCDeniesTwiceInsideSameDailyWindowIndex() public {
        _setCaps(1_000 * USDC_1, 1_000 * USDC_1, 30_000 * USDC_1);
        vm.warp(10 days + 1);

        vm.prank(signer);
        wallet.executeUSDC(openAi, 600 * USDC_1, bytes("first"));
        vm.expectRevert(abi.encodeWithSelector(TransferDenied.selector, EscalationReason.DAILY_CAP));
        vm.prank(signer);
        wallet.executeUSDC(openAi, 500 * USDC_1, bytes("second"));
    }

    function test_executeUSDCUsesFixedMonthlyWindowIndexes() public {
        _setCaps(1_000 * USDC_1, 1_000 * USDC_1, 1_000 * USDC_1);
        uint256 boundary = 60 days;

        vm.warp(boundary - 1);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 1_000 * USDC_1, bytes("previous month"));
        vm.warp(boundary + 1);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 1_000 * USDC_1, bytes("next month"));

        assertEq(wallet.monthlySpent(), 1_000 * USDC_1);
        assertEq(wallet.spendMonth(), (boundary + 1) / 30 days);
    }

    function test_executeUSDCDeniesInsideSameMonthlyWindowIndex() public {
        _setCaps(1_000 * USDC_1, 1_000 * USDC_1, 1_000 * USDC_1);
        vm.warp(31 days);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 600 * USDC_1, bytes("first"));
        vm.warp(32 days);

        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.MONTHLY_CAP)
        );
        vm.prank(signer);
        wallet.executeUSDC(openAi, 500 * USDC_1, bytes("second"));
    }

    function test_executeUSDCEmitsTransferEscalatedWithHeldTerms() public {
        uint256 timestamp = block.timestamp;
        bytes memory reason = bytes("GPU lease");
        bytes32 id = escalationIdFor(address(wallet), awsBedrock, 73 * USDC_1, 1, timestamp);

        vm.expectEmit(true, true, true, true, address(wallet));
        emit Events.TransferEscalated(
            id, address(wallet), awsBedrock, 73 * USDC_1, reason, 2, timestamp + 1 hours, 1, 1
        );
        vm.prank(signer);
        wallet.executeUSDC(awsBedrock, 73 * USDC_1, reason);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            uint256 threshold,
            ,
            IEscalationManager.Status status,
            uint256 version,
            uint256 councilVersion
        ) = escalationManager.getEscalation(id);
        assertEq(threshold, 2);
        assertEq(uint256(status), uint256(IEscalationManager.Status.PENDING));
        assertEq(version, 1);
        assertEq(councilVersion, 1);
    }

    function test_releaseFreezesAndDeniesWhenVendorBecomesBlocked() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        vm.prank(owner);
        wallet.blockVendor(awsBedrock);
        vm.prank(councilOne);
        escalationManager.approve(id);

        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.Frozen(
            address(wallet),
            FreezeSource.POLICY,
            EscalationReason.BLOCKED_VENDOR,
            abi.encodePacked(id)
        );
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertTrue(wallet.frozen());
        assertEq(uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.DENIED));
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_releaseDeniesWithoutFreezingWhenBlockedVendorFreezeDisabled() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        PolicyEnvelope memory policy = defaultPolicy();
        policy.freezeOnBlockedVendor = false;
        vm.startPrank(owner);
        wallet.setPolicy(policy);
        wallet.blockVendor(awsBedrock);
        vm.stopPrank();

        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationDenied(id, EscalationReason.BLOCKED_VENDOR);
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertFalse(wallet.frozen());
        assertEq(uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.DENIED));
    }

    function test_releaseDeniesWhenOwnerDisablesVendorCategoryAfterHold() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        PolicyEnvelope memory policy = defaultPolicy();
        policy.allowedCategories &= ~(uint256(1) << uint8(RestraintCategory.COMPUTE));
        vm.prank(owner);
        wallet.setPolicy(policy);

        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationDenied(id, EscalationReason.CATEGORY_DISABLED);
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertEq(uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.DENIED));
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_releaseDeniesWhenCurrentPerTxCapIsLower() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        PolicyEnvelope memory policy = defaultPolicy();
        policy.perTxCap = 60 * USDC_1;
        policy.escalationThreshold = 50 * USDC_1;
        vm.prank(owner);
        wallet.setPolicy(policy);

        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationDenied(id, EscalationReason.PER_TX_CAP);
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertEq(uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.DENIED));
        assertEq(usdc.balanceOf(awsBedrock), 0);
        assertEq(wallet.dailySpent(), 0);
    }

    function test_releaseDeniesWhenDailyBudgetWasConsumed() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        for (uint256 i = 0; i < 19; ++i) {
            vm.prank(signer);
            wallet.executeUSDC(openAi, 50 * USDC_1, bytes("budget"));
        }

        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationDenied(id, EscalationReason.DAILY_CAP);
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertEq(uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.DENIED));
        assertEq(wallet.dailySpent(), 950 * USDC_1);
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_releaseUsesCurrentPolicyWithoutRequiringHeldPolicyVersion() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        PolicyEnvelope memory policy = defaultPolicy();
        policy.daily24hCap = 1_100 * USDC_1;
        vm.prank(owner);
        wallet.setPolicy(policy);

        _approve(id);

        assertEq(wallet.policyVersion(), 2);
        assertEq(
            uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.EXECUTED)
        );
        assertEq(usdc.balanceOf(awsBedrock), 73 * USDC_1);
    }

    function test_finalApprovalWhileFrozenRevertsWithoutRecordingVoteThenExecutes() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.prank(owner);
        wallet.freeze(bytes("review"));

        vm.expectRevert(FrozenWallet.selector);
        vm.prank(councilTwo);
        escalationManager.approve(id);
        assertFalse(escalationManager.signed(id, councilTwo));
        assertEq(
            uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.PENDING)
        );

        vm.prank(owner);
        wallet.unfreeze();
        vm.expectEmit(true, true, true, true, address(wallet));
        emit Events.TransferExecuted(
            address(wallet), address(escalationManager), awsBedrock, 73 * USDC_1, id
        );
        vm.prank(councilTwo);
        escalationManager.approve(id);

        assertEq(
            uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.EXECUTED)
        );
    }

    function test_ownerCancelsEscalationWhileFrozenAndApprovalRemainsClosedAfterUnfreeze() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        vm.startPrank(owner);
        wallet.freeze(bytes("review"));
        wallet.cancelEscalation(id);
        wallet.unfreeze();
        vm.stopPrank();

        assertEq(
            uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.CANCELLED)
        );
        vm.expectRevert(EscalationNotPending.selector);
        vm.prank(councilOne);
        escalationManager.approve(id);
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_ownerFreezeEmitsAndRestrictsTransfers() public {
        bytes memory reason = bytes("owner review");
        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.Frozen(address(wallet), FreezeSource.OWNER, EscalationReason.NONE, reason);
        vm.prank(owner);
        wallet.freeze(reason);

        vm.expectRevert(FrozenWallet.selector);
        vm.prank(signer);
        wallet.executeUSDC(openAi, USDC_1, bytes("blocked"));

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.freeze(reason);
    }

    function test_policyAndOracleFreezeEventsIdentifyTheirSources() public {
        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.Frozen(
            address(wallet), FreezeSource.POLICY, EscalationReason.BLOCKED_VENDOR, bytes("blocked")
        );
        vm.prank(signer);
        wallet.executeUSDC(evilVendor, USDC_1, bytes("blocked"));

        vm.prank(owner);
        wallet.unfreeze();
        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.Frozen(
            address(wallet), FreezeSource.ORACLE, EscalationReason.NONE, bytes("anomaly")
        );
        vm.prank(address(anomalyOracle));
        wallet.triggerFreeze(bytes("anomaly"));
    }

    function test_cancelEscalationIsOwnerOnlyAndPreventsApproval() public {
        bytes32 id = _hold(awsBedrock, 73 * USDC_1);
        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.cancelEscalation(id);

        vm.expectEmit(true, false, false, false, address(escalationManager));
        emit Events.EscalationCancelled(id);
        vm.prank(owner);
        wallet.cancelEscalation(id);

        assertEq(
            uint256(escalationManager.statusOf(id)), uint256(IEscalationManager.Status.CANCELLED)
        );
        vm.expectRevert(EscalationNotPending.selector);
        vm.prank(councilOne);
        escalationManager.approve(id);
    }

    function test_withdrawUSDCBypassesPolicyAndSpendWindowsEvenWhenFrozen() public {
        vm.prank(signer);
        wallet.executeUSDC(openAi, 10 * USDC_1, bytes("spend"));
        vm.prank(owner);
        wallet.freeze(bytes("review"));

        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.OwnerWithdrawal(address(wallet), recipient, 20 * USDC_1);
        vm.prank(owner);
        wallet.withdrawUSDC(recipient, 20 * USDC_1);

        assertEq(usdc.balanceOf(recipient), 20 * USDC_1);
        assertEq(wallet.dailySpent(), 10 * USDC_1);
        assertEq(wallet.monthlySpent(), 10 * USDC_1);
    }

    function test_withdrawUSDCRejectsInvalidCallerRecipientAndAmount() public {
        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.withdrawUSDC(recipient, USDC_1);
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.withdrawUSDC(address(0), USDC_1);
        vm.expectRevert(ZeroAmount.selector);
        vm.prank(owner);
        wallet.withdrawUSDC(recipient, 0);
    }

    function test_twoStepOwnershipTransferAndCancellation() public {
        address nextOwner = address(0x7001);
        vm.expectEmit(true, true, false, false, address(wallet));
        emit Events.OwnershipTransferStarted(address(wallet), nextOwner);
        vm.prank(owner);
        wallet.transferOwnership(nextOwner);
        assertEq(wallet.pendingOwner(), nextOwner);

        vm.expectRevert(NotPendingOwner.selector);
        vm.prank(recipient);
        wallet.acceptOwnership();
        vm.prank(nextOwner);
        wallet.acceptOwnership();

        vm.expectRevert(NotOwner.selector);
        vm.prank(owner);
        wallet.setPolicy(defaultPolicy());
        vm.prank(nextOwner);
        wallet.setPolicy(defaultPolicy());

        vm.prank(nextOwner);
        wallet.transferOwnership(owner);
        vm.prank(nextOwner);
        wallet.transferOwnership(address(0));
        assertEq(wallet.pendingOwner(), address(0));
    }

    function test_setPolicyAndAnomalyThresholdEmitVersionedEvents() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.escalationThreshold = 25 * USDC_1;
        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.PolicyUpdated(address(wallet), 2, policy);
        vm.prank(owner);
        wallet.setPolicy(policy);
        assertEq(wallet.policyVersion(), 2);

        vm.expectEmit(true, false, false, true, address(wallet));
        emit Events.AnomalyFreezeThresholdUpdated(address(wallet), 800);
        vm.prank(owner);
        wallet.setAnomalyFreezeThresholdBps(800);
    }

    function test_validatePolicyRejectsInconsistentCapsAndAllowsDisabledMonthlyCap() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.escalationThreshold = policy.perTxCap + 1;
        _expectInvalidPolicy(policy);
        policy = defaultPolicy();
        policy.monthlyCap = policy.daily24hCap - 1;
        _expectInvalidPolicy(policy);
        policy = defaultPolicy();
        policy.monthlyCap = 0;
        vm.prank(owner);
        wallet.setPolicy(policy);
    }

    function test_escalationThresholdEqualPerTxCapDisablesEscalation() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.escalationThreshold = policy.perTxCap;
        vm.prank(owner);
        wallet.setPolicy(policy);

        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.PER_TX_CAP)
        );
        vm.prank(signer);
        wallet.executeUSDC(openAi, 101 * USDC_1, bytes("over cap"));
    }

    function test_constructorRejectsZeroOwnerInvalidPolicyAndMissingExpiryArgumentPaths() public {
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
            2,
            ESCALATION_EXPIRY
        );

        PolicyEnvelope memory policy = defaultPolicy();
        policy.perTxCap = 0;
        vm.expectRevert(InvalidPolicy.selector);
        new GuardedWallet(
            owner,
            address(usdc),
            policyEngine,
            escalationManager,
            anomalyOracle,
            vendorRegistry,
            policy,
            signers,
            defaultCouncil(),
            2,
            ESCALATION_EXPIRY
        );
    }

    function test_rotateModuleRejectsEOAAndAllowsOracleOptOut() public {
        vm.expectRevert(NotContract.selector);
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.POLICY_ENGINE, address(0x1234));

        vm.expectEmit(true, true, true, false, address(wallet));
        emit Events.ModuleRotated(address(wallet), ModuleKeys.ANOMALY_ORACLE, address(0));
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(0));
    }

    function test_ownerCanRotateAllModulesIncludingEscalationManager() public {
        PolicyEngine nextPolicyEngine = new PolicyEngine();
        EscalationManager nextManager = new EscalationManager();
        AnomalyOracle nextOracle = new AnomalyOracle(protocolAdmin, oracleSigner, MAX_SCORE_AGE);
        VendorRegistry nextRegistry = new VendorRegistry();

        vm.startPrank(owner);
        wallet.rotateModule(ModuleKeys.POLICY_ENGINE, address(nextPolicyEngine));
        wallet.rotateModule(ModuleKeys.ESCALATION_MANAGER, address(nextManager));
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(nextOracle));
        wallet.rotateModule(ModuleKeys.VENDOR_REGISTRY, address(nextRegistry));
        vm.stopPrank();

        assertEq(address(wallet.policyEngine()), address(nextPolicyEngine));
        assertEq(address(wallet.escalationManager()), address(nextManager));
        assertEq(address(wallet.anomalyOracle()), address(nextOracle));
        assertEq(address(wallet.vendorRegistry()), address(nextRegistry));
    }

    function test_rotateModuleRejectsUnknownKey() public {
        vm.expectRevert(InvalidModule.selector);
        vm.prank(owner);
        wallet.rotateModule(keccak256(bytes("UNKNOWN")), address(policyEngine));
    }

    function test_executeEscalatedTransferGuardsCallerRecipientAndFrozenState() public {
        vm.expectRevert(NotEscalationManager.selector);
        wallet.executeEscalatedTransfer(bytes32(0), openAi, USDC_1);
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(address(escalationManager));
        wallet.executeEscalatedTransfer(bytes32(0), address(0), USDC_1);
        vm.prank(owner);
        wallet.freeze(bytes("review"));
        vm.expectRevert(FrozenWallet.selector);
        vm.prank(address(escalationManager));
        wallet.executeEscalatedTransfer(bytes32(0), openAi, USDC_1);
    }

    function test_triggerFreezeOnlyOracle() public {
        vm.expectRevert(NotAnomalyOracle.selector);
        wallet.triggerFreeze(bytes("not oracle"));
    }

    function test_ownerCanManageSignersAndOnlyOwnerMayDoSo() public {
        vm.prank(owner);
        wallet.removeSigner(signer);
        assertFalse(wallet.agentSigners(signer));
        vm.prank(owner);
        wallet.addSigner(signer);
        assertTrue(wallet.agentSigners(signer));

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.removeSigner(signerTwo);
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(owner);
        wallet.addSigner(address(0));
    }

    function test_ownerCanManageVendorsAndInvalidInputsRevert() public {
        address newVendor = address(0x8889);
        vm.prank(owner);
        wallet.addVendor(
            newVendor, uint8(RestraintCategory.API), 3 * USDC_1, keccak256(bytes("vendor"))
        );
        IVendorRegistry.Vendor memory vendor =
            vendorRegistry.getVendorFor(address(wallet), newVendor);
        assertTrue(vendor.allowed);
        assertEq(vendor.perVendorCap, 3 * USDC_1);

        vm.prank(owner);
        wallet.blockVendor(newVendor);
        assertTrue(vendorRegistry.isBlockedFor(address(wallet), newVendor));
        vm.prank(owner);
        wallet.removeVendor(newVendor);
        assertFalse(vendorRegistry.isAllowedFor(address(wallet), newVendor));

        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.blockVendor(openAi);
        vm.expectRevert(InvalidCategory.selector);
        vm.prank(owner);
        wallet.addVendor(newVendor, 99, 0, bytes32(0));
    }

    function test_sweepNonUSDCProtectsUSDCAndTransfersOtherTokens() public {
        vm.expectRevert(ProtectedUSDC.selector);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(usdc), owner, 1);

        MockUSDC token = new MockUSDC();
        token.mint(address(wallet), 7);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(token), owner, 7);
        assertEq(token.balanceOf(owner), 7);
    }

    function _hold(address to, uint256 amount) private returns (bytes32 id) {
        uint256 timestamp = block.timestamp;
        vm.prank(signer);
        wallet.executeUSDC(to, amount, bytes("held"));
        return escalationIdFor(address(wallet), to, amount, 1, timestamp);
    }

    function _approve(bytes32 id) private {
        vm.prank(councilOne);
        escalationManager.approve(id);
        vm.prank(councilTwo);
        escalationManager.approve(id);
    }

    function _setCaps(uint256 perTxCap, uint256 dailyCap, uint256 monthlyCap) private {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.perTxCap = perTxCap;
        policy.daily24hCap = dailyCap;
        policy.monthlyCap = monthlyCap;
        policy.escalationThreshold = perTxCap;
        vm.prank(owner);
        wallet.setPolicy(policy);
    }

    function _expectInvalidPolicy(PolicyEnvelope memory policy) private {
        vm.expectRevert(InvalidPolicy.selector);
        vm.prank(owner);
        wallet.setPolicy(policy);
    }
}
