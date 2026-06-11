// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import {
    AlreadySigned,
    EscalationExpiredError,
    EscalationMissing,
    EscalationNotExpired,
    EscalationNotPending,
    InvalidCouncil,
    InvalidThreshold,
    WalletNotRegistered,
    ZeroAddress,
    NotRequiredSigner
} from "../src/libraries/Errors.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";

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

    function test_getEscalationReturnsStoredDetail() public view {
        (
            address walletAddress,
            address to,
            uint256 amount,
            bytes memory reason,,,
            uint256 threshold,
            uint8 signaturesCount,
            IEscalationManager.Status status
        ) = escalationManager.getEscalation(escalationId);

        assertEq(walletAddress, address(wallet));
        assertEq(to, awsBedrock);
        assertEq(amount, 73 * USDC_1);
        assertEq(reason, bytes("GPU lease"));
        assertEq(threshold, 2);
        assertEq(signaturesCount, 0);
        assertEq(uint256(status), uint256(IEscalationManager.Status.PENDING));
    }

    function test_approveRejectsAlreadySigned() public {
        vm.prank(councilOne);
        escalationManager.approve(escalationId);

        vm.expectRevert(AlreadySigned.selector);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);
    }

    function test_approveExpiredMarksExpiredAndReverts() public {
        vm.warp(block.timestamp + 1 hours);

        vm.expectRevert(EscalationExpiredError.selector);
        vm.prank(councilOne);
        escalationManager.approve(escalationId);
    }

    function test_rejectExpiredMarksExpiredAndReverts() public {
        vm.warp(block.timestamp + 1 hours);

        vm.expectRevert(EscalationExpiredError.selector);
        vm.prank(councilOne);
        escalationManager.reject(escalationId);
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

    function test_missingEscalationReverts() public {
        bytes32 missingId = keccak256(bytes("missing"));

        vm.expectRevert(EscalationMissing.selector);
        escalationManager.sweepExpired(missingId);
    }

    function test_sweepExpiredRejectsByDefault() public {
        uint256 walletBalance = usdc.balanceOf(address(wallet));
        vm.warp(block.timestamp + 1 hours + 1);

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

        vm.expectRevert(InvalidThreshold.selector);
        vm.prank(namespace);
        escalationManager.configureWallet(council, 1, 0);
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
        escalationManager.holdTransfer(recipient, 1, bytes("unregistered"));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(address(wallet));
        escalationManager.holdTransfer(address(0), 1, bytes("zero"));
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
