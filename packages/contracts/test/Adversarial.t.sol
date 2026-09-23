// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEngine } from "../src/PolicyEngine.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import {
    AlreadySigned,
    FrozenWallet,
    NotAnomalyOracle,
    NotEscalationManager,
    NotOwner,
    NotRequiredSigner,
    NotSigner,
    ProtectedUSDC,
    SignatureInvalid,
    ThresholdNotMet
} from "../src/libraries/Errors.sol";
import { EscalationReason, PolicyEnvelope } from "../src/libraries/PolicyTypes.sol";

/// @notice A fake "wallet" that re-enters EscalationManager.approve from inside the
///         release callback, the way a hostile registered caller would.
contract ReentrantFakeWallet {
    IEscalationManager internal immutable manager;
    bytes32 public targetId;
    bool public reentered;

    constructor(IEscalationManager manager_) {
        manager = manager_;
    }

    function configure() external {
        address[] memory council = new address[](1);
        council[0] = address(this);
        manager.configureWallet(council, 1, 1 hours);
    }

    function hold() external returns (bytes32) {
        IEscalationManager.Terms memory terms =
            manager.holdTransfer(address(0xBEEF), 1, bytes("self"), 1);
        targetId = terms.escalationId;
        return targetId;
    }

    function attack() external {
        manager.approve(targetId);
    }

    function executeEscalatedTransfer(bytes32, address, uint256)
        external
        returns (bool, EscalationReason)
    {
        try manager.approve(targetId) {
            // Re-entering the same escalation must never succeed.
            return (true, EscalationReason.NONE);
        } catch {
            reentered = true;
        }
        return (false, EscalationReason.NONE);
    }
}

/// @notice Adversarial suite: every test is an attack attempt against the deployed
///         protocol shape. Passing means the attack failed in the intended way.
contract AdversarialTest is ArcanumTestBase {
    uint256 internal constant ATTACK_AMOUNT = 60 * USDC_1;

    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    /* ------------------------- signer privilege ------------------------- */

    function test_attack_removedSignerLosesAccessImmediately() public {
        vm.prank(owner);
        wallet.removeSigner(signer);

        vm.expectRevert(NotSigner.selector);
        vm.prank(signer);
        wallet.executeUSDC(openAi, USDC_1, bytes("after removal"));
    }

    function test_attack_ownerCannotPoseAsAgentSigner() public {
        vm.expectRevert(NotSigner.selector);
        vm.prank(owner);
        wallet.executeUSDC(openAi, USDC_1, bytes("owner is not a signer"));
    }

    /* --------------------- escalation authorization --------------------- */

    function test_attack_foreignAccountCannotApprove() public {
        bytes32 id = _holdDefault();

        vm.expectRevert(NotRequiredSigner.selector);
        vm.prank(evilVendor);
        escalationManager.approve(id);
    }

    function test_attack_councilMemberCannotSignTwice() public {
        bytes32 id = _holdDefault();

        vm.prank(councilOne);
        escalationManager.approve(id);

        vm.expectRevert(AlreadySigned.selector);
        vm.prank(councilOne);
        escalationManager.approve(id);
    }

    function test_attack_expiredEscalationCannotExecute() public {
        bytes32 id = _holdDefault();

        vm.warp(block.timestamp + ESCALATION_EXPIRY + 1);
        vm.prank(councilOne);
        escalationManager.approve(id);

        assertTrue(escalationManager.statusOf(id) == IEscalationManager.Status.EXPIRED);
        assertEq(usdc.balanceOf(openAi), 0);
    }

    function test_attack_councilRotationInvalidatesPendingEscalation() public {
        bytes32 id = _holdDefault();

        address[] memory newCouncil = new address[](1);
        newCouncil[0] = councilOne;
        vm.prank(owner);
        wallet.configureEscalation(newCouncil, 1, ESCALATION_EXPIRY);

        vm.prank(councilOne);
        escalationManager.approve(id);

        assertTrue(escalationManager.statusOf(id) == IEscalationManager.Status.INVALIDATED);
        assertEq(usdc.balanceOf(openAi), 0);
    }

    function test_attack_reentrantApproveCannotDoubleSettle() public {
        ReentrantFakeWallet fake = new ReentrantFakeWallet(escalationManager);
        fake.configure();
        fake.hold();
        fake.attack();

        assertTrue(fake.reentered());
        assertTrue(escalationManager.statusOf(fake.targetId()) == IEscalationManager.Status.DENIED);
    }

    function test_attack_directEscalatedTransferCallReverts() public {
        vm.expectRevert(NotEscalationManager.selector);
        vm.prank(councilOne);
        wallet.executeEscalatedTransfer(bytes32(uint256(1)), openAi, USDC_1);
    }

    /* --------------------------- cap integrity -------------------------- */

    function test_attack_quorumCannotOverrideDailyCap() public {
        PolicyEnvelope memory tight = PolicyEnvelope({
            perTxCap: 100 * USDC_1,
            daily24hCap: 100 * USDC_1,
            monthlyCap: 0,
            allowedCategories: 31,
            escalationThreshold: 50 * USDC_1,
            requireAllowlist: true,
            freezeOnBlockedVendor: true
        });
        vm.prank(owner);
        wallet.setPolicy(tight);

        uint256 ts = block.timestamp;
        bytes32 first = _holdAt(openAi, ATTACK_AMOUNT, 1, ts);
        bytes32 second = _holdAt(openAi, ATTACK_AMOUNT, 2, ts);

        vm.prank(councilOne);
        escalationManager.approve(first);
        vm.prank(councilTwo);
        escalationManager.approve(first);
        assertEq(usdc.balanceOf(openAi), ATTACK_AMOUNT);

        // Second quorum-approved release re-hits the daily cap and must be denied,
        // not executed: budget caps outrank the council.
        vm.prank(councilOne);
        escalationManager.approve(second);
        vm.prank(councilTwo);
        escalationManager.approve(second);

        assertTrue(escalationManager.statusOf(second) == IEscalationManager.Status.DENIED);
        assertEq(usdc.balanceOf(openAi), ATTACK_AMOUNT);
        assertEq(wallet.dailySpent(), ATTACK_AMOUNT);
    }

    function test_behavior_holdMovesNoFundsAndConsumesNoBudget() public {
        _holdDefault();

        assertEq(usdc.balanceOf(address(wallet)), 2_000 * USDC_1);
        assertEq(usdc.balanceOf(openAi), 0);
        assertEq(wallet.dailySpent(), 0);
    }

    function test_behavior_dailyCapIsAFixedWindowNotTrailing() public {
        PolicyEnvelope memory fixedWindow = PolicyEnvelope({
            perTxCap: 100 * USDC_1,
            daily24hCap: 100 * USDC_1,
            monthlyCap: 0,
            allowedCategories: 31,
            escalationThreshold: 100 * USDC_1,
            requireAllowlist: true,
            freezeOnBlockedVendor: true
        });
        vm.prank(owner);
        wallet.setPolicy(fixedWindow);

        uint256 day = block.timestamp / 1 days;
        vm.warp((day + 1) * 1 days - 5);

        vm.prank(signer);
        wallet.executeUSDC(openAi, 100 * USDC_1, bytes("end of window"));

        vm.warp(block.timestamp + 10);
        vm.prank(signer);
        wallet.executeUSDC(openAi, 100 * USDC_1, bytes("start of next window"));

        // 200 USDC in 10 seconds with a 100 USDC "daily" cap: documented fixed-window
        // semantics, asserted here so it can never silently change.
        assertEq(usdc.balanceOf(openAi), 200 * USDC_1);
    }

    /* ------------------------ vendor namespaces ------------------------- */

    function test_attack_registryNamespacesAreIsolatedPerWallet() public {
        vm.prank(evilVendor);
        vendorRegistry.blockVendor(openAi);

        vm.prank(signer);
        wallet.executeUSDC(openAi, 10 * USDC_1, bytes("still allowed for this wallet"));

        assertEq(usdc.balanceOf(openAi), 10 * USDC_1);
        assertTrue(vendorRegistry.isBlockedFor(evilVendor, openAi));
        assertFalse(vendorRegistry.isBlockedFor(address(wallet), openAi));
    }

    /* ------------------------------ oracle ------------------------------ */

    function test_attack_oracleScoreReplayReverts() public {
        uint256 deadline = block.timestamp + 100;
        bytes memory sig = _signScore(address(wallet), 600, 0, deadline);

        anomalyOracle.submitScore(address(wallet), 600, deadline, sig);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 600, deadline, sig);
    }

    function test_attack_scoreSignedForOtherWalletReverts() public {
        uint256 deadline = block.timestamp + 100;
        bytes memory sig = _signScore(address(wallet), 600, 0, deadline);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(0x9999), 600, deadline, sig);
    }

    function test_attack_consumedScoreCannotRefreezeAfterUnfreeze() public {
        uint256 deadline = block.timestamp + 100;
        bytes memory sig = _signScore(address(wallet), 600, 0, deadline);
        anomalyOracle.submitScore(address(wallet), 600, deadline, sig);

        anomalyOracle.triggerFreeze(address(wallet), bytes("anomaly"));
        assertTrue(wallet.frozen());

        vm.prank(owner);
        wallet.unfreeze();
        assertFalse(wallet.frozen());

        vm.expectRevert(ThresholdNotMet.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("replay"));
    }

    function test_attack_nonOracleCannotFreeze() public {
        vm.expectRevert(NotAnomalyOracle.selector);
        vm.prank(evilVendor);
        wallet.triggerFreeze(bytes("spoof"));
    }

    /* ------------------------- freeze / recovery ------------------------ */

    function test_behavior_blockedVendorPaymentFreezesWithoutMovingFunds() public {
        vm.prank(signer);
        wallet.executeUSDC(evilVendor, USDC_1, bytes("to blocked vendor"));

        assertTrue(wallet.frozen());
        assertEq(usdc.balanceOf(evilVendor), 0);

        vm.expectRevert(FrozenWallet.selector);
        vm.prank(signer);
        wallet.executeUSDC(openAi, USDC_1, bytes("while frozen"));

        vm.prank(owner);
        wallet.unfreeze();

        vm.prank(signer);
        wallet.executeUSDC(openAi, USDC_1, bytes("after review"));
        assertEq(usdc.balanceOf(openAi), USDC_1);
    }

    /* --------------------------- owner powers --------------------------- */

    function test_attack_nonOwnerCannotWithdraw() public {
        vm.expectRevert(NotOwner.selector);
        vm.prank(signer);
        wallet.withdrawUSDC(signer, USDC_1);
    }

    function test_attack_sweepCannotTakeUsdc() public {
        vm.expectRevert(ProtectedUSDC.selector);
        vm.prank(owner);
        wallet.sweepNonUSDC(address(usdc), owner, USDC_1);
    }

    function test_attack_previousOwnerLosesPowerAfterHandover() public {
        address newOwner = address(0x7777);

        vm.prank(owner);
        wallet.transferOwnership(newOwner);
        vm.prank(newOwner);
        wallet.acceptOwnership();

        vm.expectRevert(NotOwner.selector);
        vm.prank(owner);
        wallet.freeze(bytes("old owner"));
    }

    /* ----------------------------- factory ------------------------------ */

    function test_behavior_predictedAddressMatchesCreatedWallet() public {
        address[] memory signers = new address[](1);
        signers[0] = signer;
        uint256 nonce = factory.nonces(address(this));

        address predicted = factory.predictWallet(
            address(this),
            owner,
            "Predicted",
            nonce,
            defaultPolicy(),
            signers,
            defaultCouncil(),
            2,
            ESCALATION_EXPIRY
        );
        address actual = factory.createWallet(
            owner, "Predicted", defaultPolicy(), signers, defaultCouncil(), 2, ESCALATION_EXPIRY
        );

        assertEq(predicted, actual);
    }

    function test_attack_defaultRotationCannotRewriteExistingWallets() public {
        PolicyEngine replacement = new PolicyEngine();

        vm.prank(protocolAdmin);
        factory.setDefaults(
            WalletFactory.Defaults({
                policyEngine: replacement,
                escalationManager: escalationManager,
                anomalyOracle: anomalyOracle,
                vendorRegistry: vendorRegistry
            })
        );

        assertEq(address(wallet.policyEngine()), address(policyEngine));

        address[] memory signers = new address[](1);
        signers[0] = signer;
        address fresh = factory.createWallet(
            owner, "Fresh", defaultPolicy(), signers, defaultCouncil(), 2, ESCALATION_EXPIRY
        );
        assertEq(address(GuardedWallet(fresh).policyEngine()), address(replacement));
    }

    /* ----------------------------- liveness ----------------------------- */

    function test_behavior_unfundedApprovalStaysPendingUntilOwnerCancels() public {
        address[] memory signers = new address[](1);
        signers[0] = signer;
        GuardedWallet empty = GuardedWallet(
            factory.createWallet(
                owner, "Empty", defaultPolicy(), signers, defaultCouncil(), 2, ESCALATION_EXPIRY
            )
        );
        vm.prank(owner);
        empty.addVendor(openAi, 0, 0, bytes32(0));

        uint256 ts = block.timestamp;
        vm.prank(signer);
        empty.executeUSDC(openAi, ATTACK_AMOUNT, bytes("will be held"));
        bytes32 id = escalationIdFor(address(empty), openAi, ATTACK_AMOUNT, 1, ts);

        vm.prank(councilOne);
        escalationManager.approve(id);

        // The deciding approval reverts with the failed transfer; the escalation
        // stays PENDING and the failed signature rolls back with it.
        vm.prank(councilTwo);
        vm.expectRevert();
        escalationManager.approve(id);
        assertTrue(escalationManager.statusOf(id) == IEscalationManager.Status.PENDING);

        vm.prank(owner);
        empty.cancelEscalation(id);
        assertTrue(escalationManager.statusOf(id) == IEscalationManager.Status.CANCELLED);
    }

    /* ------------------------------ helpers ----------------------------- */

    function _holdDefault() internal returns (bytes32) {
        return _holdAt(openAi, ATTACK_AMOUNT, 1, block.timestamp);
    }

    function _holdAt(address to, uint256 amount, uint256 nonce, uint256 ts)
        internal
        returns (bytes32)
    {
        vm.prank(signer);
        wallet.executeUSDC(to, amount, bytes("held"));
        return escalationIdFor(address(wallet), to, amount, nonce, ts);
    }

    function _signScore(address target, uint256 sigmaBps, uint256 nonce, uint256 deadline)
        internal
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "ARCANUM_ANOMALY_SCORE",
                block.chainid,
                address(anomalyOracle),
                target,
                sigmaBps,
                nonce,
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(oraclePrivateKey, MessageHashUtils.toEthSignedMessageHash(digest));
        return abi.encodePacked(r, s, v);
    }
}
