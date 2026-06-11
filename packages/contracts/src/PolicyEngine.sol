// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IPolicyEngine } from "./interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "./interfaces/IVendorRegistry.sol";
import {
    EscalationReason,
    PolicyEnvelope,
    RestraintCategory,
    Verdict
} from "./libraries/PolicyTypes.sol";

/// @notice Evaluates policy envelopes for GuardedWallet transfer attempts.
contract PolicyEngine is IPolicyEngine {
    /// @inheritdoc IPolicyEngine
    function evaluate(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason) {
        IVendorRegistry.Vendor memory vendor = vendorRegistry.getVendorFor(msg.sender, to);

        if (vendor.blocked) {
            return (Verdict.FREEZE, EscalationReason.BLOCKED_VENDOR);
        }

        if (policy.requireAllowlist && !vendor.allowed) {
            return (Verdict.DENY, EscalationReason.ALLOWLIST_REQUIRED);
        }

        if (vendor.allowed && !_categoryAllowed(policy.allowedCategories, vendor.category)) {
            return (Verdict.DENY, EscalationReason.CATEGORY_DISABLED);
        }

        if (amount > policy.perTxCap) {
            return (Verdict.DENY, EscalationReason.PER_TX_CAP);
        }

        if (vendor.allowed && vendor.perVendorCap != 0 && amount > vendor.perVendorCap) {
            return (Verdict.DENY, EscalationReason.PER_TX_CAP);
        }

        if (dailySpent + amount > policy.daily24hCap) {
            return (Verdict.DENY, EscalationReason.DAILY_CAP);
        }

        if (amount > policy.escalationThreshold) {
            return (Verdict.ESCALATE, EscalationReason.ESCALATION_THRESHOLD);
        }

        return (Verdict.ALLOW, EscalationReason.NONE);
    }

    function _categoryAllowed(uint256 bitmask, uint8 category) private pure returns (bool) {
        if (category > uint8(type(RestraintCategory).max)) {
            return false;
        }

        return (bitmask & (uint256(1) << category)) != 0;
    }
}
