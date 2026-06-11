// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IVendorRegistry } from "./IVendorRegistry.sol";
import { EscalationReason, PolicyEnvelope, Verdict } from "../libraries/PolicyTypes.sol";

/// @notice Evaluates a wallet policy against a proposed transfer.
interface IPolicyEngine {
    /// @notice Returns the policy verdict and reason for a proposed wallet transfer.
    function evaluate(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason);
}
