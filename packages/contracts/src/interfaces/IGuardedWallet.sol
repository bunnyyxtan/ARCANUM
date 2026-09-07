// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { EscalationReason, PolicyEnvelope } from "../libraries/PolicyTypes.sol";
import { IAnomalyOracle } from "./IAnomalyOracle.sol";

/// @notice Per-agent wallet that enforces policy before moving USDC.
interface IGuardedWallet {
    /// @notice Returns the wallet owner.
    function owner() external view returns (address);

    /// @notice Returns the address that may accept ownership, or zero.
    function pendingOwner() external view returns (address);

    /// @notice Returns the configured anomaly oracle module.
    function anomalyOracle() external view returns (IAnomalyOracle oracle);

    /// @notice Returns the anomaly freeze threshold in basis points.
    function anomalyFreezeThresholdBps() external view returns (uint256 threshold);

    /// @notice Returns whether an address is authorized to request governed transfers.
    function agentSigners(address signer) external view returns (bool isSigner);

    /// @notice Returns whether the wallet is currently frozen.
    function frozen() external view returns (bool isFrozen);

    /// @notice Returns the number of times the policy has been set, including at creation.
    function policyVersion() external view returns (uint256 version);

    /// @notice Executes a governed USDC transfer from an authorized agent signer.
    function executeUSDC(address to, uint256 amount, bytes calldata reason) external;

    /// @notice Releases a quorum-approved transfer if the current policy still permits it.
    /// @return executed True when USDC moved; false when the current policy denied it.
    /// @return reason The denying rule when `executed` is false, otherwise NONE.
    function executeEscalatedTransfer(bytes32 escalationId, address to, uint256 amount)
        external
        returns (bool executed, EscalationReason reason);

    /// @notice Freezes the wallet from the configured anomaly oracle.
    function triggerFreeze(bytes calldata reason) external;

    /// @notice Updates the policy envelope.
    function setPolicy(PolicyEnvelope calldata nextPolicy) external;
}
