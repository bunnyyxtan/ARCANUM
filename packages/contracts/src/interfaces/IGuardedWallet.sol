// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { PolicyEnvelope } from "../libraries/PolicyTypes.sol";
import { IAnomalyOracle } from "./IAnomalyOracle.sol";

/// @notice Per-agent wallet that enforces policy before moving USDC.
interface IGuardedWallet {
    /// @notice Returns the wallet owner.
    function owner() external view returns (address owner);

    /// @notice Returns the configured anomaly oracle module.
    function anomalyOracle() external view returns (IAnomalyOracle oracle);

    /// @notice Returns the anomaly freeze threshold in basis points.
    function anomalyFreezeThresholdBps() external view returns (uint256 threshold);

    /// @notice Returns whether an address is authorized to request governed transfers.
    function agentSigners(address signer) external view returns (bool isSigner);

    /// @notice Returns whether the wallet is currently frozen.
    function frozen() external view returns (bool isFrozen);

    /// @notice Executes a governed USDC transfer from an authorized agent signer.
    function executeUSDC(address to, uint256 amount, bytes calldata reason) external;

    /// @notice Executes a quorum-approved escalated USDC transfer.
    function executeEscalatedTransfer(address to, uint256 amount) external;

    /// @notice Freezes the wallet from the configured anomaly oracle.
    function triggerFreeze(bytes calldata reason) external;

    /// @notice Updates the policy envelope.
    function setPolicy(PolicyEnvelope calldata nextPolicy) external;
}
