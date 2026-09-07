// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/// @notice Verifies signed anomaly scores and requests wallet freezes.
interface IAnomalyOracle {
    /// @notice Records a signed anomaly score for a wallet.
    function submitScore(
        address wallet,
        uint256 sigmaBps,
        uint256 deadline,
        bytes calldata signature
    ) external;

    /// @notice Freezes an opted-in wallet when its latest fresh score exceeds its threshold.
    function triggerFreeze(address wallet, bytes calldata reason) external;

    /// @notice Returns the address whose signatures are accepted on scores.
    function oracleSigner() external view returns (address signer);

    /// @notice Returns the latest submitted score for a wallet.
    function latestSigmaBps(address wallet) external view returns (uint256 sigmaBps);

    /// @notice Returns the block timestamp at which the latest score was submitted.
    function latestScoreAt(address wallet) external view returns (uint256 timestamp);

    /// @notice Returns the next expected score nonce for a wallet.
    function scoreNonce(address wallet) external view returns (uint256 nonce);

    /// @notice Returns how old a score may be and still authorise a freeze.
    function maxScoreAge() external view returns (uint256 seconds_);
}
