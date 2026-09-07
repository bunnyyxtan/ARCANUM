// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";

import { IAnomalyOracle } from "./interfaces/IAnomalyOracle.sol";
import { IEscalationManager } from "./interfaces/IEscalationManager.sol";
import { IPolicyEngine } from "./interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "./interfaces/IVendorRegistry.sol";
import { GuardedWallet } from "./GuardedWallet.sol";
import { NotContract, ZeroAddress } from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import { PolicyEnvelope } from "./libraries/PolicyTypes.sol";

/// @notice Permissionless CREATE2 factory for deterministic GuardedWallet deployment.
/// @dev Wallet creation is open to anyone. Only the module defaults handed to new wallets
///      are governed, so a module fix ships as a new default rather than a new factory.
///      Wallets already created keep their modules until their owner rotates them.
contract WalletFactory is Ownable2Step {
    struct Defaults {
        IPolicyEngine policyEngine;
        IEscalationManager escalationManager;
        IAnomalyOracle anomalyOracle;
        IVendorRegistry vendorRegistry;
    }

    address public immutable usdc;
    Defaults public defaults;
    uint256 public defaultsVersion;
    mapping(address deployer => uint256 nonce) public nonces;

    /// @notice Sets the USDC address and the first generation of module defaults.
    constructor(address owner_, address usdc_, Defaults memory initialDefaults) Ownable(owner_) {
        _requireContract(usdc_);
        usdc = usdc_;
        _setDefaults(initialDefaults);
    }

    /// @notice Creates a GuardedWallet for any owner without deployment allowlists.
    function createWallet(
        address owner,
        string calldata label,
        PolicyEnvelope calldata initialPolicy,
        address[] calldata initialSigners,
        address[] calldata escalationCouncil,
        uint8 escalationThreshold,
        uint64 escalationExpirySeconds
    ) external returns (address wallet) {
        if (owner == address(0)) {
            revert ZeroAddress();
        }

        uint256 nonce = nonces[msg.sender]++;
        bytes32 salt = keccak256(abi.encode(msg.sender, owner, label, nonce));
        Defaults memory modules = defaults;
        wallet = address(
            new GuardedWallet{ salt: salt }(
                owner,
                usdc,
                modules.policyEngine,
                modules.escalationManager,
                modules.anomalyOracle,
                modules.vendorRegistry,
                initialPolicy,
                initialSigners,
                escalationCouncil,
                escalationThreshold,
                escalationExpirySeconds
            )
        );

        emit Events.WalletCreated(wallet, owner, label, defaultsVersion, block.timestamp);
    }

    /// @notice Predicts a wallet address for the provided deployment inputs and the
    ///         current module defaults.
    function predictWallet(
        address deployer,
        address owner,
        string calldata label,
        uint256 nonce,
        PolicyEnvelope calldata initialPolicy,
        address[] calldata initialSigners,
        address[] calldata escalationCouncil,
        uint8 escalationThreshold,
        uint64 escalationExpirySeconds
    ) external view returns (address predicted) {
        bytes32 salt = keccak256(abi.encode(deployer, owner, label, nonce));
        Defaults memory modules = defaults;
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(
                type(GuardedWallet).creationCode,
                abi.encode(
                    owner,
                    usdc,
                    modules.policyEngine,
                    modules.escalationManager,
                    modules.anomalyOracle,
                    modules.vendorRegistry,
                    initialPolicy,
                    initialSigners,
                    escalationCouncil,
                    escalationThreshold,
                    escalationExpirySeconds
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

    /// @notice Replaces the module defaults handed to wallets created from now on.
    function setDefaults(Defaults calldata nextDefaults) external onlyOwner {
        _setDefaults(nextDefaults);
    }

    function _setDefaults(Defaults memory nextDefaults) private {
        // Opting out of the oracle is a per-wallet act (rotateModule), never a default.
        _requireContract(address(nextDefaults.policyEngine));
        _requireContract(address(nextDefaults.escalationManager));
        _requireContract(address(nextDefaults.anomalyOracle));
        _requireContract(address(nextDefaults.vendorRegistry));

        defaults = nextDefaults;
        uint256 version = ++defaultsVersion;
        emit Events.DefaultsUpdated(
            version,
            address(nextDefaults.policyEngine),
            address(nextDefaults.escalationManager),
            address(nextDefaults.anomalyOracle),
            address(nextDefaults.vendorRegistry)
        );
    }

    function _requireContract(address target) private view {
        if (target == address(0)) {
            revert ZeroAddress();
        }
        if (target.code.length == 0) {
            revert NotContract();
        }
    }
}
