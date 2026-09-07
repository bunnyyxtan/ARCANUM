// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IVendorRegistry } from "./IVendorRegistry.sol";
import { EscalationReason, PolicyEnvelope, Verdict } from "../libraries/PolicyTypes.sol";

/// @notice Evaluates a wallet policy against a proposed transfer.
interface IPolicyEngine {
    /// @notice Returns the policy verdict and reason for a transfer requested by an agent.
    function evaluate(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason);

    /// @notice Returns the verdict for releasing a quorum-approved transfer under the
    ///         current policy. Identical to `evaluate` except that the escalation
    ///         threshold is not applied: quorum is the answer to that rule alone.
    function evaluateRelease(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason);
}
