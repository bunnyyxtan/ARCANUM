// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ReentrancyGuard } from "@solady/utils/ReentrancyGuard.sol";

import { IEscalationManager } from "./interfaces/IEscalationManager.sol";
import { IAnomalyOracle } from "./interfaces/IAnomalyOracle.sol";
import { IGuardedWallet } from "./interfaces/IGuardedWallet.sol";
import { IPolicyEngine } from "./interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "./interfaces/IVendorRegistry.sol";
import {
    FrozenWallet,
    InvalidModule,
    InvalidPolicy,
    NotAnomalyOracle,
    NotEscalationManager,
    NotOwner,
    NotSigner,
    ProtectedUSDC,
    TransferDenied,
    ZeroAddress
} from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import { EscalationReason, ModuleKeys, PolicyEnvelope, Verdict } from "./libraries/PolicyTypes.sol";

/// @notice Immutable per-agent wallet that enforces policy before moving USDC.
contract GuardedWallet is IGuardedWallet, ReentrancyGuard {
    using SafeERC20 for IERC20;

    address public immutable owner;
    address public immutable usdc;
    IPolicyEngine public policyEngine;
    IEscalationManager public escalationManager;
    IAnomalyOracle public anomalyOracle;
    IVendorRegistry public vendorRegistry;
    PolicyEnvelope public policy;
    mapping(address signer => bool authorized) public agentSigners;
    bool public frozen;
    uint256 public dailySpent;
    uint256 public lastSpendReset;
    uint256 public anomalyFreezeThresholdBps;

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert NotOwner();
        }
        _;
    }

    modifier onlySigner() {
        if (!agentSigners[msg.sender]) {
            revert NotSigner();
        }
        _;
    }

    /// @notice Initializes a governed wallet with immutable owner and USDC address.
    constructor(
        address owner_,
        address usdc_,
        IPolicyEngine policyEngine_,
        IEscalationManager escalationManager_,
        IAnomalyOracle anomalyOracle_,
        IVendorRegistry vendorRegistry_,
        PolicyEnvelope memory initialPolicy,
        address[] memory initialSigners,
        address[] memory escalationCouncil,
        uint8 escalationThreshold
    ) {
        if (
            owner_ == address(0) || usdc_ == address(0) || address(policyEngine_) == address(0)
                || address(escalationManager_) == address(0)
                || address(vendorRegistry_) == address(0)
        ) {
            revert ZeroAddress();
        }
        _validatePolicy(initialPolicy);

        owner = owner_;
        usdc = usdc_;
        policyEngine = policyEngine_;
        escalationManager = escalationManager_;
        anomalyOracle = anomalyOracle_;
        vendorRegistry = vendorRegistry_;
        policy = initialPolicy;
        lastSpendReset = block.timestamp;
        anomalyFreezeThresholdBps = 500;

        for (uint256 i = 0; i < initialSigners.length; ++i) {
            _addSigner(initialSigners[i]);
        }

        escalationManager_.configureWallet(escalationCouncil, escalationThreshold, 1 hours);
    }

    /// @inheritdoc IGuardedWallet
    function executeUSDC(address to, uint256 amount, bytes calldata reason)
        external
        nonReentrant
        onlySigner
    {
        if (frozen) {
            revert FrozenWallet();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }

        _rollSpendWindow();
        (Verdict verdict, EscalationReason decisionReason) =
            policyEngine.evaluate(policy, to, amount, dailySpent, vendorRegistry);

        if (verdict == Verdict.ALLOW) {
            dailySpent += amount;
            IERC20(usdc).safeTransfer(to, amount);
            emit Events.TransferExecuted(address(this), msg.sender, to, amount);
            return;
        }

        if (verdict == Verdict.ESCALATE) {
            bytes32 escalationId = escalationManager.holdTransfer(to, amount, reason);
            emit Events.TransferEscalated(escalationId, address(this), to, amount, reason);
            return;
        }

        if (verdict == Verdict.FREEZE) {
            frozen = true;
            emit Events.Frozen(address(this), decisionReason, reason);
            return;
        }

        revert TransferDenied(decisionReason);
    }

    /// @inheritdoc IGuardedWallet
    function executeEscalatedTransfer(address to, uint256 amount) external nonReentrant {
        if (msg.sender != address(escalationManager)) {
            revert NotEscalationManager();
        }
        if (frozen) {
            revert FrozenWallet();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }

        _rollSpendWindow();
        dailySpent += amount;
        IERC20(usdc).safeTransfer(to, amount);
        emit Events.TransferExecuted(address(this), msg.sender, to, amount);
    }

    /// @inheritdoc IGuardedWallet
    function triggerFreeze(bytes calldata reason) external {
        if (msg.sender != address(anomalyOracle)) {
            revert NotAnomalyOracle();
        }
        frozen = true;
        emit Events.Frozen(address(this), EscalationReason.NONE, reason);
    }

    /// @inheritdoc IGuardedWallet
    function setPolicy(PolicyEnvelope calldata nextPolicy) external onlyOwner {
        _validatePolicy(nextPolicy);
        policy = nextPolicy;
        emit Events.PolicyUpdated(address(this));
    }

    /// @notice Adds an agent signer that may request governed transfers.
    function addSigner(address signer) external onlyOwner {
        _addSigner(signer);
    }

    /// @notice Removes an agent signer from the wallet.
    function removeSigner(address signer) external onlyOwner {
        agentSigners[signer] = false;
        emit Events.SignerRemoved(address(this), signer);
    }

    /// @notice Rotates a wallet module by key.
    function rotateModule(bytes32 module, address newModule) external onlyOwner {
        if (module == ModuleKeys.POLICY_ENGINE) {
            if (newModule == address(0)) {
                revert ZeroAddress();
            }
            policyEngine = IPolicyEngine(newModule);
        } else if (module == ModuleKeys.ESCALATION_MANAGER) {
            if (newModule == address(0)) {
                revert ZeroAddress();
            }
            escalationManager = IEscalationManager(newModule);
        } else if (module == ModuleKeys.ANOMALY_ORACLE) {
            anomalyOracle = IAnomalyOracle(newModule);
        } else if (module == ModuleKeys.VENDOR_REGISTRY) {
            if (newModule == address(0)) {
                revert ZeroAddress();
            }
            vendorRegistry = IVendorRegistry(newModule);
        } else {
            revert InvalidModule();
        }

        emit Events.ModuleRotated(address(this), module, newModule);
    }

    /// @notice Updates the anomaly score threshold that permits oracle freezes.
    function setAnomalyFreezeThresholdBps(uint256 thresholdBps) external onlyOwner {
        anomalyFreezeThresholdBps = thresholdBps;
    }

    /// @notice Reconfigures the wallet's human escalation council.
    function configureEscalation(
        address[] calldata requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    ) external onlyOwner {
        escalationManager.configureWallet(requiredSigners, threshold, expirySeconds);
    }

    /// @notice Adds or updates a vendor in this wallet's registry namespace.
    function addVendor(address vendor, uint8 category, uint256 perVendorCap, bytes32 metadataHash)
        external
        onlyOwner
    {
        vendorRegistry.addVendor(vendor, category, perVendorCap, metadataHash);
    }

    /// @notice Blocks a vendor in this wallet's registry namespace.
    function blockVendor(address vendor) external onlyOwner {
        vendorRegistry.blockVendor(vendor);
    }

    /// @notice Removes a vendor from this wallet's registry namespace.
    function removeVendor(address vendor) external onlyOwner {
        vendorRegistry.removeVendor(vendor);
    }

    /// @notice Clears a frozen state after owner review.
    function unfreeze() external onlyOwner {
        frozen = false;
        emit Events.Unfrozen(address(this));
    }

    /// @notice Sweeps non-USDC ERC20 tokens accidentally sent to this wallet.
    function sweepNonUSDC(address token, address to, uint256 amount) external onlyOwner {
        if (token == usdc) {
            revert ProtectedUSDC();
        }
        if (token == address(0) || to == address(0)) {
            revert ZeroAddress();
        }

        IERC20(token).safeTransfer(to, amount);
        emit Events.NonUSDCSwept(address(this), token, to, amount);
    }

    function _addSigner(address signer) private {
        if (signer == address(0)) {
            revert ZeroAddress();
        }

        agentSigners[signer] = true;
        emit Events.SignerAdded(address(this), signer);
    }

    function _rollSpendWindow() private {
        if (block.timestamp >= lastSpendReset + 1 days) {
            dailySpent = 0;
            lastSpendReset = block.timestamp;
        }
    }

    function _validatePolicy(PolicyEnvelope memory envelope) private pure {
        if (envelope.perTxCap == 0 || envelope.daily24hCap == 0) {
            revert InvalidPolicy();
        }
        if (envelope.perTxCap > envelope.daily24hCap) {
            revert InvalidPolicy();
        }
        if (envelope.escalationThreshold == 0) {
            revert InvalidPolicy();
        }
    }
}
