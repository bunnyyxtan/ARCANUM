// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IAnomalyOracle } from "./interfaces/IAnomalyOracle.sol";
import { IEscalationManager } from "./interfaces/IEscalationManager.sol";
import { IPolicyEngine } from "./interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "./interfaces/IVendorRegistry.sol";
import { GuardedWallet } from "./GuardedWallet.sol";
import { ZeroAddress } from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import { PolicyEnvelope } from "./libraries/PolicyTypes.sol";

/// @notice Permissionless CREATE2 factory for deterministic GuardedWallet deployment.
contract WalletFactory {
    address public immutable usdc;
    IPolicyEngine public immutable policyEngine;
    IEscalationManager public immutable escalationManager;
    IAnomalyOracle public immutable anomalyOracle;
    IVendorRegistry public immutable vendorRegistry;
    mapping(address owner => uint256 nonce) public nonces;

    /// @notice Sets immutable shared module addresses for newly created wallets.
    constructor(
        address usdc_,
        IPolicyEngine policyEngine_,
        IEscalationManager escalationManager_,
        IAnomalyOracle anomalyOracle_,
        IVendorRegistry vendorRegistry_
    ) {
        if (
            usdc_ == address(0) || address(policyEngine_) == address(0)
                || address(escalationManager_) == address(0)
                || address(vendorRegistry_) == address(0)
        ) {
            revert ZeroAddress();
        }

        usdc = usdc_;
        policyEngine = policyEngine_;
        escalationManager = escalationManager_;
        anomalyOracle = anomalyOracle_;
        vendorRegistry = vendorRegistry_;
    }

    /// @notice Creates a GuardedWallet for any owner without deployment allowlists.
    function createWallet(
        address owner,
        string calldata label,
        PolicyEnvelope calldata initialPolicy,
        address[] calldata initialSigners,
        address[] calldata escalationCouncil,
        uint8 escalationThreshold
    ) external returns (address wallet) {
        if (owner == address(0)) {
            revert ZeroAddress();
        }

        uint256 nonce = nonces[owner]++;
        bytes32 salt = keccak256(abi.encode(owner, label, nonce));
        wallet = address(
            new GuardedWallet{ salt: salt }(
                owner,
                usdc,
                policyEngine,
                escalationManager,
                anomalyOracle,
                vendorRegistry,
                initialPolicy,
                initialSigners,
                escalationCouncil,
                escalationThreshold
            )
        );

        emit Events.WalletCreated(wallet, owner, label, block.timestamp);
    }

    /// @notice Predicts a wallet address for the provided deployment inputs.
    function predictWallet(
        address owner,
        string calldata label,
        uint256 nonce,
        PolicyEnvelope calldata initialPolicy,
        address[] calldata initialSigners,
        address[] calldata escalationCouncil,
        uint8 escalationThreshold
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encode(owner, label, nonce));
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(GuardedWallet).creationCode,
                abi.encode(
                    owner,
                    usdc,
                    policyEngine,
                    escalationManager,
                    anomalyOracle,
                    vendorRegistry,
                    initialPolicy,
                    initialSigners,
                    escalationCouncil,
                    escalationThreshold
                )
            )
        );

        predicted = address(
            uint160(
                uint256(
                    keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, initCodeHash))
                )
            )
        );
    }
}
