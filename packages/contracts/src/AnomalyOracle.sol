// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import { IAnomalyOracle } from "./interfaces/IAnomalyOracle.sol";
import { IGuardedWallet } from "./interfaces/IGuardedWallet.sol";
import {
    OracleOptOut,
    SignatureInvalid,
    ThresholdNotMet,
    ZeroAddress
} from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";

/// @notice Verifies signed anomaly scores and freezes opted-in wallets above threshold.
contract AnomalyOracle is IAnomalyOracle {
    address public immutable oracleSigner;
    mapping(address wallet => uint256 sigmaBps) public latestSigmaBps;

    /// @notice Sets the immutable signer that authorizes anomaly scores.
    constructor(address oracleSigner_) {
        if (oracleSigner_ == address(0)) {
            revert ZeroAddress();
        }
        oracleSigner = oracleSigner_;
    }

    /// @inheritdoc IAnomalyOracle
    function submitScore(address wallet, uint256 sigmaBps, bytes calldata signature) external {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }

        bytes32 digest = keccak256(
            abi.encodePacked(
                "ARCANUM_ANOMALY_SCORE", block.chainid, address(this), wallet, sigmaBps
            )
        );
        address recovered =
            ECDSA.recover(MessageHashUtils.toEthSignedMessageHash(digest), signature);
        if (recovered != oracleSigner) {
            revert SignatureInvalid();
        }

        latestSigmaBps[wallet] = sigmaBps;
        emit Events.AnomalyScoreSubmitted(wallet, sigmaBps, block.timestamp);
    }

    /// @inheritdoc IAnomalyOracle
    function triggerFreeze(address wallet, bytes calldata reason) external {
        if (wallet == address(0)) {
            revert ZeroAddress();
        }

        IGuardedWallet guardedWallet = IGuardedWallet(wallet);
        if (address(guardedWallet.anomalyOracle()) != address(this)) {
            revert OracleOptOut();
        }
        if (latestSigmaBps[wallet] <= guardedWallet.anomalyFreezeThresholdBps()) {
            revert ThresholdNotMet();
        }

        guardedWallet.triggerFreeze(reason);
    }
}
