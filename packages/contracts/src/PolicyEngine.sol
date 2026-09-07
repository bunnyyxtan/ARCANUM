// SPDX-License-Identifier: Apache-2.0
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
/// @dev Rules run in a fixed order: vendor block, allowlist, category, per-tx cap,
///      per-vendor cap, daily cap, monthly cap, escalation threshold. Budget caps come
///      before the escalation threshold so a quorum can never be used to exceed them.
contract PolicyEngine is IPolicyEngine {
    /// @inheritdoc IPolicyEngine
    function evaluate(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason) {
        return _evaluate(policy, to, amount, dailySpent, monthlySpent, vendorRegistry, true);
    }

    /// @inheritdoc IPolicyEngine
    function evaluateRelease(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent,
        IVendorRegistry vendorRegistry
    ) external view returns (Verdict verdict, EscalationReason reason) {
        return _evaluate(policy, to, amount, dailySpent, monthlySpent, vendorRegistry, false);
    }

    function _evaluate(
        PolicyEnvelope calldata policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent,
        IVendorRegistry vendorRegistry,
        bool applyEscalationThreshold
    ) private view returns (Verdict verdict, EscalationReason reason) {
        IVendorRegistry.Vendor memory vendor = vendorRegistry.getVendorFor(msg.sender, to);

        if (vendor.blocked) {
            Verdict onBlocked = policy.freezeOnBlockedVendor ? Verdict.FREEZE : Verdict.DENY;
            return (onBlocked, EscalationReason.BLOCKED_VENDOR);
        }

        if (policy.requireAllowlist && !vendor.allowed) {
            return (Verdict.DENY, EscalationReason.ALLOWLIST_REQUIRED);
        }

        // Category restrictions apply to registered vendors only. An unregistered
        // counterparty has no category to check and is governed by `requireAllowlist`.
        if (vendor.allowed && !_categoryAllowed(policy.allowedCategories, vendor.category)) {
            return (Verdict.DENY, EscalationReason.CATEGORY_DISABLED);
        }

        if (amount > policy.perTxCap) {
            return (Verdict.DENY, EscalationReason.PER_TX_CAP);
        }

        if (vendor.allowed && vendor.perVendorCap != 0 && amount > vendor.perVendorCap) {
            return (Verdict.DENY, EscalationReason.PER_VENDOR_CAP);
        }

        if (dailySpent + amount > policy.daily24hCap) {
            return (Verdict.DENY, EscalationReason.DAILY_CAP);
        }

        if (policy.monthlyCap != 0 && monthlySpent + amount > policy.monthlyCap) {
            return (Verdict.DENY, EscalationReason.MONTHLY_CAP);
        }

        if (applyEscalationThreshold && amount > policy.escalationThreshold) {
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
