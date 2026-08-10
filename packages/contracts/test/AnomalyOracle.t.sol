// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.24;

import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { ModuleKeys } from "../src/libraries/PolicyTypes.sol";
import {
    OracleOptOut,
    SignatureExpired,
    SignatureInvalid,
    ThresholdNotMet,
    ZeroAddress
} from "../src/libraries/Errors.sol";

contract AnomalyOracleTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    function test_submitScoreVerifiesOracleSignature() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(address(wallet), 740, deadline);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);

        assertEq(anomalyOracle.latestSigmaBps(address(wallet)), 740);
        assertEq(anomalyOracle.scoreNonce(address(wallet)), 1);
    }

    function test_constructorRejectsZeroSigner() public {
        vm.expectRevert(ZeroAddress.selector);
        new AnomalyOracle(address(0));
    }

    function test_submitScoreRejectsZeroWallet() public {
        vm.expectRevert(ZeroAddress.selector);
        anomalyOracle.submitScore(address(0), 740, block.timestamp, bytes(""));
    }

    function test_submitScoreRejectsInvalidSignature() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(address(wallet), 740, deadline);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 741, deadline, signature);
    }

    function test_submitScoreRejectsExpiredDeadline() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(address(wallet), 740, deadline);

        vm.warp(deadline + 1);

        vm.expectRevert(SignatureExpired.selector);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);
    }

    function test_submitScoreRejectsReplayedSignature() public {
        uint256 deadline = block.timestamp + 5 minutes;
        bytes memory signature = _signature(address(wallet), 740, deadline);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 740, deadline, signature);
    }

    function test_triggerFreezeWhenScoreExceedsThreshold() public {
        _submitScore(740);
        anomalyOracle.triggerFreeze(address(wallet), bytes("7.4 sigma"));

        assertTrue(wallet.frozen());
    }

    function test_triggerFreezeConsumesScoreAfterUnfreeze() public {
        _submitScore(740);
        anomalyOracle.triggerFreeze(address(wallet), bytes("7.4 sigma"));
        assertTrue(wallet.frozen());

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
            address(wallet), sigmaBps, deadline, _signature(address(wallet), sigmaBps, deadline)
        );
    }

    function _signature(address walletAddress, uint256 sigmaBps, uint256 deadline)
        private
        view
        returns (bytes memory)
    {
        bytes32 digest = keccak256(
            abi.encodePacked(
                "ARCANUM_ANOMALY_SCORE",
                block.chainid,
                address(anomalyOracle),
                walletAddress,
                sigmaBps,
                anomalyOracle.scoreNonce(walletAddress),
                deadline
            )
        );
        bytes32 signedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, signedDigest);
        return abi.encodePacked(r, s, v);
    }
}
