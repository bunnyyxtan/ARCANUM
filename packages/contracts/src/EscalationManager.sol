// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IEscalationManager } from "./interfaces/IEscalationManager.sol";
import { IGuardedWallet } from "./interfaces/IGuardedWallet.sol";
import {
    AlreadySigned,
    EscalationExpiredError,
    EscalationMissing,
    EscalationNotExpired,
    EscalationNotPending,
    InvalidCouncil,
    InvalidThreshold,
    NotRequiredSigner,
    WalletNotRegistered,
    ZeroAddress
} from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";

/// @notice Stores escalated transfers and executes only after wallet-selected quorum.
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
    }

    mapping(address wallet => WalletConfig config) private _configs;
    mapping(address wallet => mapping(address signer => bool required)) private _requiredSigners;
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
            revert InvalidThreshold();
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

        emit Events.WalletRegistered(msg.sender, threshold, expirySeconds);
    }

    /// @inheritdoc IEscalationManager
    function holdTransfer(address to, uint256 amount, bytes calldata reason)
        external
        returns (bytes32 escalationId)
    {
        WalletConfig storage config = _configs[msg.sender];
        if (config.threshold == 0) {
            revert WalletNotRegistered();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }

        uint256 nonce = ++walletNonces[msg.sender];
        escalationId = keccak256(abi.encode(msg.sender, to, amount, nonce, block.timestamp));
        uint256 expiresAt = block.timestamp + config.expirySeconds;

        _escalations[escalationId] = Escalation({
            wallet: msg.sender,
            to: to,
            amount: amount,
            reason: reason,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            threshold: config.threshold,
            signaturesCount: 0,
            status: Status.PENDING
        });

        emit Events.TransferEscalated(escalationId, msg.sender, to, amount, reason);
    }

    /// @inheritdoc IEscalationManager
    function approve(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (block.timestamp >= escalation.expiresAt) {
            escalation.status = Status.EXPIRED;
            emit Events.EscalationExpired(escalationId);
            revert EscalationExpiredError();
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

        if (escalation.signaturesCount >= escalation.threshold) {
            escalation.status = Status.EXECUTED;
            IGuardedWallet(escalation.wallet)
                .executeEscalatedTransfer(escalation.to, escalation.amount);
            emit Events.EscalationExecuted(escalationId);
        }
    }

    /// @inheritdoc IEscalationManager
    function reject(bytes32 escalationId) external {
        Escalation storage escalation = _pendingEscalation(escalationId);
        if (block.timestamp >= escalation.expiresAt) {
            escalation.status = Status.EXPIRED;
            emit Events.EscalationExpired(escalationId);
            revert EscalationExpiredError();
        }
        if (!_requiredSigners[escalation.wallet][msg.sender]) {
            revert NotRequiredSigner();
        }

        escalation.status = Status.REJECTED;
        emit Events.EscalationRejected(escalationId, msg.sender);
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
            Status status
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
            escalation.status
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
