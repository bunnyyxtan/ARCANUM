// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import {
    AlreadySigned,
    EscalationMissing,
    EscalationNotExpired,
    EscalationNotPending,
    InvalidCouncil,
    InvalidExpiry,
    InvalidThreshold,
    NotEscalationManager,
    NotEscalationWallet,
    NotRequiredSigner,
    WalletNotRegistered,
    ZeroAddress
} from "../src/libraries/Errors.sol";
import { Events } from "../src/libraries/Events.sol";
import { EscalationReason, ModuleKeys, PolicyEnvelope } from "../src/libraries/PolicyTypes.sol";

contract EscalationManagerTest is ArcanumTestBase {
    bytes32 private escalationId;

    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
        escalationId = _createEscalation();
    }

    function test_quorumExecutesEscalation() public {
        vm.prank(councilOne);
        escalationManager.approve(escalationId);
        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.PENDING)
        );

        vm.prank(councilTwo);
        escalationManager.approve(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.EXECUTED)
        );
        assertEq(usdc.balanceOf(awsBedrock), 73 * USDC_1);
    }

    function test_getEscalationReturnsStoredDetailAndVersions() public view {
        (
            address walletAddress,
            address to,
            uint256 amount,
            bytes memory reason,
            ,
            uint256 expiresAt,
            uint256 threshold,
            uint8 signaturesCount,
            IEscalationManager.Status status,
            uint256 policyVersion,
            uint256 heldCouncilVersion
        ) = escalationManager.getEscalation(escalationId);

        assertEq(walletAddress, address(wallet));
        assertEq(to, awsBedrock);
        assertEq(amount, 73 * USDC_1);
        assertEq(reason, bytes("GPU lease"));
        assertEq(expiresAt, block.timestamp + ESCALATION_EXPIRY);
        assertEq(threshold, 2);
        assertEq(signaturesCount, 0);
        assertEq(uint256(status), uint256(IEscalationManager.Status.PENDING));
        assertEq(policyVersion, 1);
        assertEq(heldCouncilVersion, 1);
    }

    function test_holdTransferReturnsFixedTermsAndStoresPolicyVersion() public {
        vm.prank(address(wallet));
        IEscalationManager.Terms memory terms =
            escalationManager.holdTransfer(recipient, 12 * USDC_1, bytes("terms"), 41);

        assertEq(terms.threshold, 2);
        assertEq(terms.expiresAt, block.timestamp + ESCALATION_EXPIRY);
        assertEq(terms.councilVersion, 1);

        (,,,,,,,,, uint256 policyVersion, uint256 heldCouncilVersion) =
            escalationManager.getEscalation(terms.escalationId);
        assertEq(policyVersion, 41);
        assertEq(heldCouncilVersion, 1);
    }

    function test_approveRejectsAlreadySigned() public {
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        vm.expectRevert(AlreadySigned.selector);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);
    }

    function test_approveAfterExpiryMarksExpiredWithoutRecordingSignature() public {
        vm.warp(block.timestamp + ESCALATION_EXPIRY);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationExpired(escalationId);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        (,,,,,,, uint8 signaturesCount, IEscalationManager.Status status,,) =
            escalationManager.getEscalation(escalationId);
        assertEq(signaturesCount, 0);
        assertEq(uint256(status), uint256(IEscalationManager.Status.EXPIRED));

        vm.expectRevert(EscalationNotPending.selector);
        escalationManager.sweepExpired(escalationId);
    }

    function test_rejectAfterExpiryMarksExpiredWithoutRecordingSignature() public {
        vm.warp(block.timestamp + ESCALATION_EXPIRY);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationExpired(escalationId);
        vm.prank(councilOne);
        escalationManager.reject(escalationId);

        (,,,,,,, uint8 signaturesCount, IEscalationManager.Status status,,) =
            escalationManager.getEscalation(escalationId);
        assertEq(signaturesCount, 0);
        assertEq(uint256(status), uint256(IEscalationManager.Status.EXPIRED));

        vm.expectRevert(EscalationNotPending.selector);
        escalationManager.sweepExpired(escalationId);
    }

    function test_rejectOverridesApproval() public {
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        vm.prank(councilTwo);
        escalationManager.reject(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.REJECTED)
        );

        vm.expectRevert(EscalationNotPending.selector);
        vm.prank(councilThree);
        escalationManager.approve(escalationId);
    }

    function test_councilRotationInvalidatesOnOldMemberApproval() public {
        address[] memory nextCouncil = new address[](1);
        nextCouncil[0] = recipient;
        vm.prank(owner);
        wallet.configureEscalation(nextCouncil, 1, ESCALATION_EXPIRY);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationInvalidated(escalationId, 2);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.INVALIDATED)
        );
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_councilRotationInvalidatesOnNewMemberApproval() public {
        address[] memory nextCouncil = new address[](1);
        nextCouncil[0] = recipient;
        vm.prank(owner);
        wallet.configureEscalation(nextCouncil, 1, ESCALATION_EXPIRY);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationInvalidated(escalationId, 2);
        vm.prank(recipient);
        escalationManager.approve(escalationId);

        vm.expectRevert(EscalationNotPending.selector);
        vm.prank(recipient);
        escalationManager.approve(escalationId);
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_reconfiguringSameCouncilStillInvalidatesHeldEscalation() public {
        vm.prank(owner);
        wallet.configureEscalation(defaultCouncil(), 2, ESCALATION_EXPIRY);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationInvalidated(escalationId, 2);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.INVALIDATED)
        );
    }

    function test_cancelRequiresEscalationWallet() public {
        vm.expectRevert(NotEscalationWallet.selector);
        vm.prank(councilOne);
        escalationManager.cancel(escalationId);

        vm.expectRevert(NotEscalationWallet.selector);
        vm.prank(owner);
        escalationManager.cancel(escalationId);
    }

    function test_walletOwnerCanCancelThroughWallet() public {
        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationCancelled(escalationId);
        vm.prank(owner);
        wallet.cancelEscalation(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.CANCELLED)
        );
    }

    function test_finalApprovalDeniedWhenVendorWasBlockedAfterHold() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.freezeOnBlockedVendor = false;
        vm.startPrank(owner);
        wallet.setPolicy(policy);
        wallet.blockVendor(awsBedrock);
        vm.stopPrank();

        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        vm.expectEmit(true, false, false, true, address(escalationManager));
        emit Events.EscalationDenied(escalationId, EscalationReason.BLOCKED_VENDOR);
        vm.prank(councilTwo);
        escalationManager.approve(escalationId);

        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.DENIED)
        );
        assertEq(usdc.balanceOf(awsBedrock), 0);
        assertFalse(wallet.frozen());
    }

    function test_oldManagerApprovalRejectedAfterWalletRotatesManager() public {
        EscalationManager nextManager = new EscalationManager();
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.ESCALATION_MANAGER, address(nextManager));

        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        vm.expectRevert(NotEscalationManager.selector);
        vm.prank(councilTwo);
        escalationManager.approve(escalationId);
        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.PENDING)
        );
    }

    function test_missingEscalationReverts() public {
        vm.expectRevert(EscalationMissing.selector);
        escalationManager.sweepExpired(keccak256(bytes("missing")));
    }

    function test_sweepExpiredRejectsByDefault() public {
        uint256 walletBalance = usdc.balanceOf(address(wallet));
        vm.warp(block.timestamp + ESCALATION_EXPIRY + 1);

        escalationManager.sweepExpired(escalationId);
        assertEq(
            uint256(escalationManager.statusOf(escalationId)),
            uint256(IEscalationManager.Status.EXPIRED)
        );
        assertEq(usdc.balanceOf(address(wallet)), walletBalance);
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function test_sweepBeforeExpiryReverts() public {
        vm.expectRevert(EscalationNotExpired.selector);
        escalationManager.sweepExpired(escalationId);
    }

    function test_configureWalletRejectsBadThresholdAndExpiry() public {
        address namespace = address(0xCAFE);
        address[] memory council = defaultCouncil();

        vm.expectRevert(InvalidThreshold.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 0, 1 hours);

        vm.expectRevert(InvalidThreshold.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 4, 1 hours);

        vm.expectRevert(InvalidExpiry.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 1, 0);
    }

    function test_configureWalletIncrementsVersionAndEmitsIt() public {
        address namespace = address(0xCAFE);
        address[] memory council = defaultCouncil();

        vm.expectEmit(true, true, false, true, address(escalationManager));
        emit Events.WalletRegistered(namespace, 1, council, 2, 1 hours);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 2, 1 hours);

        vm.expectEmit(true, true, false, true, address(escalationManager));
        emit Events.WalletRegistered(namespace, 2, council, 2, 2 hours);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 2, 2 hours);
        assertEq(escalationManager.councilVersion(namespace), 2);
    }

    function test_configureWalletRejectsZeroAndDuplicateCouncilMembers() public {
        address namespace = address(0xCAFE);
        address[] memory zeroCouncil = new address[](1);
        zeroCouncil[0] = address(0);

        vm.expectRevert(InvalidCouncil.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(zeroCouncil, 1, 1 hours);

        address[] memory duplicateCouncil = new address[](2);
        duplicateCouncil[0] = councilOne;
        duplicateCouncil[1] = councilOne;

        vm.expectRevert(InvalidCouncil.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(duplicateCouncil, 1, 1 hours);
    }

    function test_reconfigureClearsPreviousRequiredSigners() public {
        address namespace = address(0xCAFE);
        address[] memory nextCouncil = new address[](1);
        nextCouncil[0] = recipient;

        vm.prank(namespace);
        escalationManager.configureWallet(defaultCouncil(), 2, 1 hours);
        assertTrue(escalationManager.isRequiredSigner(namespace, councilOne));

        vm.prank(namespace);
        escalationManager.configureWallet(nextCouncil, 1, 2 hours);

        assertFalse(escalationManager.isRequiredSigner(namespace, councilOne));
        assertTrue(escalationManager.isRequiredSigner(namespace, recipient));
    }

    function test_holdTransferRejectsUnregisteredAndZeroRecipient() public {
        vm.expectRevert(WalletNotRegistered.selector);
        escalationManager.holdTransfer(recipient, 1, bytes("unregistered"), 1);

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(address(wallet));
        escalationManager.holdTransfer(address(0), 1, bytes("zero"), 1);
    }

    function test_nonCouncilCannotApproveOrReject() public {
        vm.expectRevert(NotRequiredSigner.selector);
        vm.prank(address(0xBEEF));
        escalationManager.approve(escalationId);

        vm.expectRevert(NotRequiredSigner.selector);
        vm.prank(address(0xBEEF));
        escalationManager.reject(escalationId);
    }

    function _createEscalation() private returns (bytes32) {
        uint256 timestamp = block.timestamp;
        vm.prank(signer);
        wallet.executeUSDC(awsBedrock, 73 * USDC_1, bytes("GPU lease"));
        return escalationIdFor(address(wallet), awsBedrock, 73 * USDC_1, 1, timestamp);
    }
}
