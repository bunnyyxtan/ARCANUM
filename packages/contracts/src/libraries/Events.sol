// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { EscalationReason, FreezeSource, PolicyEnvelope } from "./PolicyTypes.sol";

/// @notice Events shared across Arcanum protocol contracts for indexer parity.
/// @dev Every decision input the read model needs is carried on the event itself so an
///      indexer never has to read contract state back to reconstruct history.
library Events {
    event OwnershipTransferStarted(address indexed wallet, address indexed pendingOwner);
    event OwnershipTransferred(
        address indexed wallet, address indexed previousOwner, address indexed newOwner
    );
    event PolicyUpdated(address indexed wallet, uint256 indexed version, PolicyEnvelope policy);
    event AnomalyFreezeThresholdUpdated(address indexed wallet, uint256 thresholdBps);
    event SignerAdded(address indexed wallet, address indexed signer);
    event SignerRemoved(address indexed wallet, address indexed signer);
    event ModuleRotated(address indexed wallet, bytes32 indexed module, address indexed newModule);
    event TransferExecuted(
        address indexed wallet,
        address indexed signer,
        address indexed to,
        uint256 amount,
        bytes32 escalationId
    );
    event TransferEscalated(
        bytes32 indexed escalationId,
        address indexed wallet,
        address indexed to,
        uint256 amount,
        bytes reason,
        uint256 threshold,
        uint256 expiresAt,
        uint256 policyVersion,
        uint256 councilVersion
    );
    event Frozen(
        address indexed wallet, FreezeSource indexed source, EscalationReason reason, bytes data
    );
    event Unfrozen(address indexed wallet);
    event OwnerWithdrawal(address indexed wallet, address indexed to, uint256 amount);
    event NonUSDCSwept(
        address indexed wallet, address indexed token, address indexed to, uint256 amount
    );
    event VendorAdded(
        address indexed wallet,
        address indexed vendor,
        uint8 category,
        uint256 perVendorCap,
        bytes32 metadataHash
    );
    event VendorBlocked(address indexed wallet, address indexed vendor);
    event VendorRemoved(address indexed wallet, address indexed vendor);
    event EscalationApproved(bytes32 indexed escalationId, address indexed signer, uint8 count);
    event EscalationRejected(bytes32 indexed escalationId, address indexed signer);
    event EscalationCancelled(bytes32 indexed escalationId);
    event EscalationExpired(bytes32 indexed escalationId);
    event EscalationInvalidated(bytes32 indexed escalationId, uint256 councilVersion);
    event EscalationDenied(bytes32 indexed escalationId, EscalationReason reason);
    event EscalationExecuted(bytes32 indexed escalationId);
    event WalletRegistered(
        address indexed wallet,
        uint256 indexed councilVersion,
        address[] requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    );
    event AnomalyScoreSubmitted(address indexed wallet, uint256 sigmaBps, uint256 timestamp);
    event OracleSignerRotated(address indexed previousSigner, address indexed newSigner);
    event MaxScoreAgeUpdated(uint256 maxScoreAgeSeconds);
    event DefaultsUpdated(
        uint256 indexed version,
        address policyEngine,
        address escalationManager,
        address anomalyOracle,
        address vendorRegistry
    );
    event WalletCreated(
        address indexed wallet,
        address indexed owner,
        string label,
        uint256 defaultsVersion,
        uint256 timestamp
    );
}
