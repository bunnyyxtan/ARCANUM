// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Verifies signed anomaly scores and requests wallet freezes.
interface IAnomalyOracle {
    /// @notice Records a signed anomaly score for a wallet.
    function submitScore(address wallet, uint256 sigmaBps, bytes calldata signature) external;

    /// @notice Freezes an opted-in wallet when its latest score exceeds its threshold.
    function triggerFreeze(address wallet, bytes calldata reason) external;

    /// @notice Returns the latest submitted score for a wallet.
    function latestSigmaBps(address wallet) external view returns (uint256 sigmaBps);
}
