// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { ModuleKeys } from "../src/libraries/PolicyTypes.sol";
import {
    OracleOptOut,
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
        bytes memory signature = _signature(address(wallet), 740);
        anomalyOracle.submitScore(address(wallet), 740, signature);

        assertEq(anomalyOracle.latestSigmaBps(address(wallet)), 740);
    }

    function test_constructorRejectsZeroSigner() public {
        vm.expectRevert(ZeroAddress.selector);
        new AnomalyOracle(address(0));
    }

    function test_submitScoreRejectsZeroWallet() public {
        vm.expectRevert(ZeroAddress.selector);
        anomalyOracle.submitScore(address(0), 740, bytes(""));
    }

    function test_submitScoreRejectsInvalidSignature() public {
        bytes memory signature = _signature(address(wallet), 740);

        vm.expectRevert(SignatureInvalid.selector);
        anomalyOracle.submitScore(address(wallet), 741, signature);
    }

    function test_triggerFreezeWhenScoreExceedsThreshold() public {
        anomalyOracle.submitScore(address(wallet), 740, _signature(address(wallet), 740));
        anomalyOracle.triggerFreeze(address(wallet), bytes("7.4 sigma"));

        assertTrue(wallet.frozen());
    }

    function test_triggerFreezeRejectsZeroWallet() public {
        vm.expectRevert(ZeroAddress.selector);
        anomalyOracle.triggerFreeze(address(0), bytes("zero"));
    }

    function test_triggerFreezeRevertsBelowThreshold() public {
        anomalyOracle.submitScore(address(wallet), 500, _signature(address(wallet), 500));

        vm.expectRevert(ThresholdNotMet.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("5.0 sigma"));
    }

    function test_walletCanOptOutByRotatingModuleToZero() public {
        anomalyOracle.submitScore(address(wallet), 740, _signature(address(wallet), 740));
        vm.prank(owner);
        wallet.rotateModule(ModuleKeys.ANOMALY_ORACLE, address(0));

        vm.expectRevert(OracleOptOut.selector);
        anomalyOracle.triggerFreeze(address(wallet), bytes("opted out"));
    }

    function _signature(address walletAddress, uint256 sigmaBps)
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
                sigmaBps
            )
        );
        bytes32 signedDigest = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePrivateKey, signedDigest);
        return abi.encodePacked(r, s, v);
    }
}
