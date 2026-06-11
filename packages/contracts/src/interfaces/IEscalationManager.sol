// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Stores and resolves human-quorum escalated transfers.
interface IEscalationManager {
    enum Status {
        PENDING,
        EXECUTED,
        REJECTED,
        EXPIRED
    }

    /// @notice Registers or updates the caller wallet's escalation council.
    function configureWallet(
        address[] calldata requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    ) external;

    /// @notice Holds an escalated transfer for the caller wallet.
    function holdTransfer(address to, uint256 amount, bytes calldata reason)
        external
        returns (bytes32 escalationId);

    /// @notice Approves a pending escalation as a required signer.
    function approve(bytes32 escalationId) external;

    /// @notice Rejects a pending escalation as a required signer.
    function reject(bytes32 escalationId) external;

    /// @notice Marks an expired escalation as expired without executing it.
    function sweepExpired(bytes32 escalationId) external;

    /// @notice Returns the current status for an escalation.
    function statusOf(bytes32 escalationId) external view returns (Status status);

    /// @notice Returns immutable transfer data for an escalation.
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
        );

    /// @notice Returns whether a signer belongs to a wallet's escalation council.
    function isRequiredSigner(address wallet, address signer) external view returns (bool required);
}
