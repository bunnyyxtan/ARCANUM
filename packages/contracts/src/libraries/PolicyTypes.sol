// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/// @notice Categories used for counterparty and spend policy classification.
enum RestraintCategory {
    API,
    COMPUTE,
    DATA,
    SUBCONTRACTING,
    OTHER
}

/// @notice Policy verdict returned by the policy engine for a proposed USDC transfer.
enum Verdict {
    ALLOW,
    ESCALATE,
    DENY,
    FREEZE
}

/// @notice Machine-readable reason for a policy decision.
/// @dev Append-only: the ordinal values are decoded by the indexer and both SDKs.
enum EscalationReason {
    NONE,
    ALLOWLIST_REQUIRED,
    PER_TX_CAP,
    DAILY_CAP,
    ESCALATION_THRESHOLD,
    BLOCKED_VENDOR,
    CATEGORY_DISABLED,
    MONTHLY_CAP,
    PER_VENDOR_CAP
}

/// @notice Which authority put a wallet into the frozen state.
enum FreezeSource {
    POLICY,
    ORACLE,
    OWNER
}

/// @notice Spend policy enforced on every GuardedWallet transfer path.
/// @dev Budget windows are fixed calendar windows measured in whole days from the Unix
///      epoch: `daily24hCap` bounds spend within one 24-hour window and `monthlyCap`
///      within one 30-day window. They are not trailing windows. A quorum approval
///      overrides only `escalationThreshold`; every other field is re-checked when an
///      escalated transfer is released. `escalationThreshold == perTxCap` disables
///      escalation, because a transfer above it is already denied by the per-tx cap.
struct PolicyEnvelope {
    uint256 perTxCap;
    uint256 daily24hCap;
    uint256 monthlyCap;
    uint256 allowedCategories;
    uint256 escalationThreshold;
    bool requireAllowlist;
    bool freezeOnBlockedVendor;
}

/// @notice Module key used by GuardedWallet.rotateModule.
library ModuleKeys {
    bytes32 internal constant POLICY_ENGINE = keccak256("ARCANUM_POLICY_ENGINE");
    bytes32 internal constant ESCALATION_MANAGER = keccak256("ARCANUM_ESCALATION_MANAGER");
    bytes32 internal constant ANOMALY_ORACLE = keccak256("ARCANUM_ANOMALY_ORACLE");
    bytes32 internal constant VENDOR_REGISTRY = keccak256("ARCANUM_VENDOR_REGISTRY");
}
