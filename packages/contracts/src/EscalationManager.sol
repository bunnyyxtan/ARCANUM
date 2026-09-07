// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IEscalationManager } from "./interfaces/IEscalationManager.sol";
import { IGuardedWallet } from "./interfaces/IGuardedWallet.sol";
import {
    AlreadySigned,
    EscalationMissing,
    EscalationNotExpired,
    EscalationNotPending,
    InvalidCouncil,
    InvalidExpiry,
    InvalidThreshold,
    NotEscalationWallet,
    NotRequiredSigner,
    WalletNotRegistered,
    ZeroAddress
} from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import { EscalationReason } from "./libraries/PolicyTypes.sol";

/// @notice Stores escalated transfers and releases them only after wallet-selected quorum.
/// @dev An escalation is bound to the council version it was held under. Touching it after
///      the council changed settles it as INVALIDATED rather than letting a council that
///      never saw the request decide it. Expiry is likewise settled on touch, so the
///      stored status is always the one an observer would compute.
contract EscalationManager is IEscalationManager {
    struct WalletConfig {
        uint8 threshold;
        uint64 expirySeconds;
        address[] requiredSigners;
    }

    struct Escalation {
        address wallet;
        address to;
        uint256 amount;
        bytes reason;
        uint256 createdAt;
        uint256 expiresAt;
        uint256 threshold;
        uint8 signaturesCount;
        Status status;
        uint256 policyVersion;
        uint256 councilVersion;
    }

    mapping(address wallet => WalletConfig config) private _configs;
    mapping(address wallet => mapping(address signer => bool required)) private _requiredSigners;
    mapping(address wallet => uint256 version) public councilVersion;
    mapping(address wallet => uint256 nonce) public walletNonces;
    mapping(bytes32 escalationId => Escalation escalation) private _escalations;
    mapping(bytes32 escalationId => mapping(address signer => bool signed)) public signed;

    /// @inheritdoc IEscalationManager
    function configureWallet(
        address[] calldata requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    ) external {
        if (threshold == 0 || threshold > requiredSigners.length) {
            revert InvalidThreshold();
        }
        if (expirySeconds == 0) {
            revert InvalidExpiry();
        }

        WalletConfig storage config = _configs[msg.sender];
        address[] storage previous = config.requiredSigners;
        for (uint256 i = 0; i < previous.length; ++i) {
            _requiredSigners[msg.sender][previous[i]] = false;
        }
        delete config.requiredSigners;

        for (uint256 i = 0; i < requiredSigners.length; ++i) {
            address signer = requiredSigners[i];
            if (signer == address(0) || _requiredSigners[msg.sender][signer]) {
                revert InvalidCouncil();
            }
            _requiredSigners[msg.sender][signer] = true;
            config.requiredSigners.push(signer);
        }

        config.threshold = threshold;
        config.expirySeconds = expirySeconds;
        uint256 version = ++councilVersion[msg.sender];

        emit Events.WalletRegistered(msg.sender, version, requiredSigners, threshold, expirySeconds);
    }

    /// @inheritdoc IEscalationManager
    function holdTransfer(address to, uint256 amount, bytes calldata reason, uint256 policyVersion)
        external
        returns (Terms memory terms)
    {
        WalletConfig storage config = _configs[msg.sender];
        if (config.threshold == 0) {
            revert WalletNotRegistered();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }

        uint256 nonce = ++walletNonces[msg.sender];
        bytes32 escalationId = keccak256(abi.encode(msg.sender, to, amount, nonce, block.timestamp));
        uint256 expiresAt = block.timestamp + config.expirySeconds;
        uint256 heldCouncilVersion = councilVersion[msg.sender];

        _escalations[escalationId] = Escalation({
            wallet: msg.sender,
            to: to,
            amount: amount,
            reason: reason,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            threshold: config.threshold,
            signaturesCount: 0,
            status: Status.PENDING,
            policyVersion: policyVersion,
            councilVersion: heldCouncilVersion
        });

        terms = Terms({
            escalationId: escalationId,
            threshold: config.threshold,
            expiresAt: expiresAt,
            councilVersion: heldCouncilVersion
        });
    }

    /// @inheritdoc IEscalationManager
    function approve(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (_settleIfStale(escalationId, escalation)) {
            return;
        }
        if (!_requiredSigners[escalation.wallet][msg.sender]) {
            revert NotRequiredSigner();
        }
        if (signed[escalationId][msg.sender]) {
            revert AlreadySigned();
        }

        signed[escalationId][msg.sender] = true;
        escalation.signaturesCount += 1;
        emit Events.EscalationApproved(escalationId, msg.sender, escalation.signaturesCount);

        if (escalation.signaturesCount < escalation.threshold) {
            return;
        }

        // The status leaves PENDING before the wallet is called, so a re-entrant approve
        // on the same id fails the pending check regardless of what the wallet does.
        escalation.status = Status.EXECUTED;
        (bool executed, EscalationReason reason) = IGuardedWallet(escalation.wallet)
            .executeEscalatedTransfer(escalationId, escalation.to, escalation.amount);

        if (executed) {
            emit Events.EscalationExecuted(escalationId);
            return;
        }

        escalation.status = Status.DENIED;
        emit Events.EscalationDenied(escalationId, reason);
    }

    /// @inheritdoc IEscalationManager
    function reject(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (_settleIfStale(escalationId, escalation)) {
            return;
        }
        if (!_requiredSigners[escalation.wallet][msg.sender]) {
            revert NotRequiredSigner();
        }

        escalation.status = Status.REJECTED;
        emit Events.EscalationRejected(escalationId, msg.sender);
    }

    /// @inheritdoc IEscalationManager
    function cancel(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (msg.sender != escalation.wallet) {
            revert NotEscalationWallet();
        }
        if (_settleIfStale(escalationId, escalation)) {
            return;
        }

        escalation.status = Status.CANCELLED;
        emit Events.EscalationCancelled(escalationId);
    }

    /// @inheritdoc IEscalationManager
    function sweepExpired(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (block.timestamp < escalation.expiresAt) {
            revert EscalationNotExpired();
        }

        escalation.status = Status.EXPIRED;
        emit Events.EscalationExpired(escalationId);
    }

    /// @inheritdoc IEscalationManager
    function statusOf(bytes32 escalationId) external view returns (Status status) {
        return _escalations[escalationId].status;
    }

    /// @inheritdoc IEscalationManager
    function getEscalation(bytes32 escalationId)
        external
        view
        returns (
            address wallet,
            address to,
            uint256 amount,
            bytes memory reason,
            uint256 createdAt,
            uint256 expiresAt,
            uint256 threshold,
            uint8 signaturesCount,
            Status status,
            uint256 policyVersion,
            uint256 heldCouncilVersion
        )
    {
        Escalation storage escalation = _escalations[escalationId];
        return (
            escalation.wallet,
            escalation.to,
            escalation.amount,
            escalation.reason,
            escalation.createdAt,
            escalation.expiresAt,
            escalation.threshold,
            escalation.signaturesCount,
            escalation.status,
            escalation.policyVersion,
            escalation.councilVersion
        );
    }

    /// @inheritdoc IEscalationManager
    function isRequiredSigner(address wallet, address signer)
        external
        view
        returns (bool required)
    {
        return _requiredSigners[wallet][signer];
    }

    /// @dev Settles an escalation that can no longer be decided: expired, or held under a
    ///      council that has since been replaced. Returns true when it did so.
    function _settleIfStale(bytes32 escalationId, Escalation storage escalation)
        private
        returns (bool settled)
    {
        if (block.timestamp >= escalation.expiresAt) {
            escalation.status = Status.EXPIRED;
            emit Events.EscalationExpired(escalationId);
            return true;
        }
        if (escalation.councilVersion != councilVersion[escalation.wallet]) {
            escalation.status = Status.INVALIDATED;
            emit Events.EscalationInvalidated(escalationId, councilVersion[escalation.wallet]);
            return true;
        }
        return false;
    }

    function _pendingEscalation(bytes32 escalationId)
        private
        view
        returns (Escalation storage escalation)
    {
        escalation = _escalations[escalationId];
        if (escalation.wallet == address(0)) {
            revert EscalationMissing();
        }
        if (escalation.status != Status.PENDING) {
            revert EscalationNotPending();
        }
    }
}
