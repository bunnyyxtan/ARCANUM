// SPDX-License-Identifier: MIT
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
enum EscalationReason {
    NONE,
    ALLOWLIST_REQUIRED,
    PER_TX_CAP,
    DAILY_CAP,
    ESCALATION_THRESHOLD,
    BLOCKED_VENDOR,
    CATEGORY_DISABLED
}

/// @notice Spend policy enforced by every GuardedWallet transfer path.
struct PolicyEnvelope {
    uint256 perTxCap;
    uint256 daily24hCap;
    uint256 monthlyRollingCap;
    uint256 allowedCategories;
    uint256 escalationThreshold;
    bool requireAllowlist;
}

/// @notice Module key used by GuardedWallet.rotateModule.
library ModuleKeys {
    bytes32 internal constant POLICY_ENGINE = keccak256("ARCANUM_POLICY_ENGINE");
    bytes32 internal constant ESCALATION_MANAGER = keccak256("ARCANUM_ESCALATION_MANAGER");
    bytes32 internal constant ANOMALY_ORACLE = keccak256("ARCANUM_ANOMALY_ORACLE");
    bytes32 internal constant VENDOR_REGISTRY = keccak256("ARCANUM_VENDOR_REGISTRY");
}
