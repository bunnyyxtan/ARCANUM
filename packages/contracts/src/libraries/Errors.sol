// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { EscalationReason } from "./PolicyTypes.sol";

error NotOwner();
error NotSigner();
error NotEscalationManager();
error NotAnomalyOracle();
error FrozenWallet();
error ZeroAddress();
error InvalidModule();
error TransferDenied(EscalationReason reason);
error USDCIsProtected();
error InvalidPolicy();
error InvalidThreshold();
error InvalidCouncil();
error InvalidCategory();
error WalletNotRegistered();
error NotRequiredSigner();
error AlreadySigned();
error EscalationNotPending();
error EscalationExpiredError();
error EscalationNotExpired();
error EscalationMissing();
error SignatureInvalid();
error OracleOptOut();
error ThresholdNotMet();
error VendorMissing();
error WalletAlreadyRegistered();
error ProtectedUSDC();
