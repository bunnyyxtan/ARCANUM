// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/// @notice Stores and resolves human-quorum escalated transfers.
interface IEscalationManager {
    /// @dev Append-only: ordinal values are decoded off-chain.
    enum Status {
        PENDING,
        EXECUTED,
        REJECTED,
        EXPIRED,
        DENIED,
        CANCELLED,
        INVALIDATED
    }

    /// @notice Terms fixed for an escalation when it is held.
    struct Terms {
        bytes32 escalationId;
        uint256 threshold;
        uint256 expiresAt;
        uint256 councilVersion;
    }

    /// @notice Registers or replaces the caller wallet's escalation council.
    /// @dev Bumps the caller's council version; escalations held under an earlier
    ///      version can no longer be approved or rejected and become INVALIDATED on touch.
    function configureWallet(
        address[] calldata requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    ) external;

    /// @notice Holds an escalated transfer for the caller wallet.
    function holdTransfer(address to, uint256 amount, bytes calldata reason, uint256 policyVersion)
        external
        returns (Terms memory terms);

    /// @notice Approves a pending escalation as a required signer.
    function approve(bytes32 escalationId) external;

    /// @notice Rejects a pending escalation as a required signer.
    function reject(bytes32 escalationId) external;

    /// @notice Cancels a pending escalation; only the wallet that holds it may call.
    function cancel(bytes32 escalationId) external;

    /// @notice Marks an expired escalation as expired without executing it.
    function sweepExpired(bytes32 escalationId) external;

    /// @notice Returns the current status for an escalation.
    function statusOf(bytes32 escalationId) external view returns (Status status);

    /// @notice Returns the council version a wallet's next escalation will be held under.
    function councilVersion(address wallet) external view returns (uint256 version);

    /// @notice Returns the stored data for an escalation.
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
        );

    /// @notice Returns whether a signer belongs to a wallet's current escalation council.
    function isRequiredSigner(address wallet, address signer)
        external
        view
        returns (bool required);
}
