// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { EscalationReason } from "./PolicyTypes.sol";

error NotOwner();
error NotPendingOwner();
error NotSigner();
error NotEscalationManager();
error NotAnomalyOracle();
error NotEscalationWallet();
error FrozenWallet();
error ZeroAddress();
error ZeroAmount();
error NotContract();
error InvalidModule();
error TransferDenied(EscalationReason reason);
error InvalidPolicy();
error InvalidThreshold();
error InvalidExpiry();
error InvalidCouncil();
error InvalidCategory();
error WalletNotRegistered();
error NotRequiredSigner();
error AlreadySigned();
error EscalationNotPending();
error EscalationNotExpired();
error EscalationMissing();
error SignatureInvalid();
error SignatureExpired();
error ScoreStale();
error OracleOptOut();
error ThresholdNotMet();
error ProtectedUSDC();
