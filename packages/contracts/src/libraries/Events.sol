// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { EscalationReason } from "./PolicyTypes.sol";

/// @notice Events shared across Arcanum protocol contracts for indexer parity.
library Events {
    event PolicyUpdated(address indexed wallet);
    event SignerAdded(address indexed wallet, address indexed signer);
    event SignerRemoved(address indexed wallet, address indexed signer);
    event ModuleRotated(address indexed wallet, bytes32 indexed module, address indexed newModule);
    event TransferExecuted(
        address indexed wallet, address indexed signer, address indexed to, uint256 amount
    );
    event TransferEscalated(
        bytes32 indexed escalationId,
        address indexed wallet,
        address indexed to,
        uint256 amount,
        bytes reason
    );
    event Frozen(address indexed wallet, EscalationReason indexed reason, bytes data);
    event Unfrozen(address indexed wallet);
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
    event EscalationExpired(bytes32 indexed escalationId);
    event EscalationExecuted(bytes32 indexed escalationId);
    event WalletRegistered(address indexed wallet, uint8 threshold, uint64 expirySeconds);
    event AnomalyScoreSubmitted(address indexed wallet, uint256 sigmaBps, uint256 timestamp);
    event WalletCreated(
        address indexed wallet, address indexed owner, string label, uint256 timestamp
    );
}
