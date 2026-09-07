// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import {
    InvalidExpiry,
    OracleOptOut,
    ScoreStale,
    SignatureExpired,
    SignatureInvalid,
    ThresholdNotMet,
    ZeroAddress
} from "../src/libraries/Errors.sol";
import { Events } from "../src/libraries/Events.sol";
import { EscalationReason, FreezeSource, ModuleKeys } from "../src/libraries/PolicyTypes.sol";

contract AnomalyOracleTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    function test_submitScoreVerifiesOracleSignatureAndRecordsTimestamp() public {
        uint256 deadline = block.timestamp + 5 minutes;
        anomalyOracle.submitScore(address(wallet), 740, deadline, _signature(740, deadline));

        assertEq(anomalyOracle.latestSigmaBps(address(wallet)), 740);
        assertEq(anomalyOracle.latestScoreAt(address(wallet)), block.timestamp);
        assertEq(anomalyOracle.scoreNonce(address(wallet)), 1);
    }

    function test_constructorSetsOwnerAndRejectsZeroSignerOrMaxScoreAge() public {
        assertEq(anomalyOracle.owner(), protocolAdmin);

        vm.expectRevert(ZeroAddress.selector);
        new AnomalyOracle(protocolAdmin, address(0), MAX_SCORE_AGE);

        vm.expectRevert(InvalidExpiry.selector);
        new AnomalyOracle(protocolAdmin, oracleSigner, 0);
    }

    function test_setSignerIsOnlyOwnerAndEmitsRotation() public {
        address nextSigner = vm.addr(0xB0B);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        anomalyOracle.setSigner(nextSigner);

        vm.expectEmit(true, true, false, true, address(anomalyOracle));
        emit Events.OracleSignerRotated(oracleSigner, nextSigner);
        vm.prank(protocolAdmin);
        anomalyOracle.setSigner(nextSigner);
        assertEq(anomalyOracle.oracleSigner(), nextSigner);
    }

    function test_setSignerRejectsZeroAddress() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(protocolAdmin);
        anomalyOracle.setSigner(address(0));
    }

    function test_signerRotationRejectsOldSignerAndAcceptsNewSigner() public {
        uint256 nextPrivateKey = 0xB0B;
        vm.prank(protocolAdmin);
        anomalyOracle.setSigner(vm.addr(nextPrivateKey));
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory oldSignature = _signature(740, deadline);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 740, deadline, oldSignature);

        anomalyOracle.submitScore(
            address(wallet), 740, deadline, _signatureWithKey(740, deadline, nextPrivateKey)
        );
        assertEq(anomalyOracle.latestSigmaBps(address(wallet)), 740);
    }

    function test_setMaxScoreAgeIsOnlyOwnerAndEmitsUpdate() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vm.prank(owner);
        anomalyOracle.setMaxScoreAge(2 days);

        vm.expectEmit(false, false, false, true, address(anomalyOracle));
        emit Events.MaxScoreAgeUpdated(2 days);
        vm.prank(protocolAdmin);
        anomalyOracle.setMaxScoreAge(2 days);
        assertEq(anomalyOracle.maxScoreAge(), 2 days);
    }

    function test_setMaxScoreAgeRejectsZero() public {
        vm.expectRevert(InvalidExpiry.selector);
        vm.prank(protocolAdmin);
        anomalyOracle.setMaxScoreAge(0);
    }

    function test_twoStepOwnershipRequiresAcceptanceBeforePendingOwnerCanAct() public {
        address nextOwner = address(0xB0B);
        vm.prank(protocolAdmin);
        anomalyOracle.transferOwnership(nextOwner);

        vm.expectRevert(
            abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nextOwner)
        );
        vm.prank(nextOwner);
        anomalyOracle.setMaxScoreAge(2 days);

        vm.prank(nextOwner);
        anomalyOracle.acceptOwnership();
        vm.prank(nextOwner);
        anomalyOracle.setMaxScoreAge(2 days);

        assertEq(anomalyOracle.owner(), nextOwner);
        assertEq(anomalyOracle.maxScoreAge(), 2 days);
    }

    function test_submitScoreRejectsZeroWallet() public {
        vm.expectRevert(ZeroAddress.selector);
        anomalyOracle.submitScore(address(0), 740, block.timestamp, bytes(""));
    }

    function test_submitScoreRejectsInvalidSignature() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(740, deadline);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 741, deadline, signature);
    }

    function test_submitScoreRejectsExpiredDeadline() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(740, deadline);
        vm.warp(deadline + 1);

        vm.expectRevert(SignatureExpired.selector);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);
    }

    function test_submitScoreRejectsReplayedSignature() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(740, deadline);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);
    }

    function test_triggerFreezeWithinScoreAgeEmitsOracleSource() public {
        _submitScore(740);
        vm.warp(block.timestamp + MAX_SCORE_AGE);

        vm.expectEmit(true, true, false, true, address(wallet));
        emit Events.Frozen(
            address(wallet), FreezeSource.ORACLE, EscalationReason.NONE, bytes("7.4 sigma")
        );
        anomalyOracle.triggerFreeze(address(wallet), bytes("7.4 sigma"));
        assertTrue(wallet.frozen());
    }

    function test_triggerFreezeRejectsStaleScore() public {
        _submitScore(740);
        vm.warp(block.timestamp + MAX_SCORE_AGE + 1);

        vm.expectRevert(ScoreStale.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("stale"));
        assertFalse(wallet.frozen());
    }

    function test_triggerFreezeConsumesScoreAfterUnfreeze() public {
        _submitScore(740);
        anomalyOracle.triggerFreeze(address(wallet), bytes("7.4 sigma"));
        vm.prank(owner);
        wallet.unfreeze();

        vm.expectRevert(ThresholdNotMet.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("stale score"));
        assertFalse(wallet.frozen());
    }

    function test_triggerFreezeRejectsZeroWallet() public {
        vm.expectRevert(ZeroAddress.selector);
        anomalyOracle.triggerFreeze(address(0), bytes("zero"));
    }

    function test_triggerFreezeRevertsBelowThreshold() public {
        _submitScore(500);

        vm.expectRevert(ThresholdNotMet.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("5.0 sigma"));
    }

    function test_walletCanOptOutByRotatingModuleToZero() public {
        _submitScore(740);
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(0));

        vm.expectRevert(OracleOptOut.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("opted out"));
    }

    function _submitScore(uint256 sigmaBps) private {
        uint256 deadline = block.timestamp + 5 minutes;
        anomalyOracle.submitScore(
            address(wallet), sigmaBps, deadline, _signature(sigmaBps, deadline)
        );
    }

    function _signature(uint256 sigmaBps, uint256 deadline) private view returns (bytes memory) {
        return _signatureWithKey(sigmaBps, deadline, oraclePrivateKey);
    }

    function _signatureWithKey(uint256 sigmaBps, uint256 deadline, uint256 privateKey)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "ARCANUM_ANOMALY_SCORE",
                block.chainid,
                address(anomalyOracle),
                address(wallet),
                sigmaBps,
                anomalyOracle.scoreNonce(address(wallet)),
                deadline
            )
        );
        bytes32 signedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, signedDigest);
        return abi.encodePacked(r, s, v);
    }
}
