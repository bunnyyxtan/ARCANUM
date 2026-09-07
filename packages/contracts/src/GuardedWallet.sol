// SPDX-License-Identifier: Apache-2.0
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
    NotContract,
    NotEscalationManager,
    NotOwner,
    NotPendingOwner,
    NotSigner,
    ProtectedUSDC,
    TransferDenied,
    ZeroAddress,
    ZeroAmount
} from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import {
    EscalationReason,
    FreezeSource,
    ModuleKeys,
    PolicyEnvelope,
    Verdict
} from "./libraries/PolicyTypes.sol";

/// @notice Per-agent wallet that enforces policy before moving USDC.
/// @dev The owner is the root of trust: it can rotate every module, so nothing in this
///      contract tries to constrain the owner. What it does guarantee is that agent
///      signers, the council and the oracle can each do exactly one thing.
contract GuardedWallet is IGuardedWallet, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 private constant DAY_WINDOW = 1 days;
    uint256 private constant MONTH_WINDOW = 30 days;

    address public immutable usdc;
    address public owner;
    address public pendingOwner;
    IPolicyEngine public policyEngine;
    IEscalationManager public escalationManager;
    IAnomalyOracle public anomalyOracle;
    IVendorRegistry public vendorRegistry;
    PolicyEnvelope public policy;
    uint256 public policyVersion;
    mapping(address signer => bool authorized) public agentSigners;
    bool public frozen;
    uint256 public dailySpent;
    uint256 public monthlySpent;
    /// @notice Index of the 24-hour window `dailySpent` belongs to (`timestamp / 1 days`).
    uint256 public spendDay;
    /// @notice Index of the 30-day window `monthlySpent` belongs to (`timestamp / 30 days`).
    uint256 public spendMonth;
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

    modifier notFrozen() {
        if (frozen) {
            revert FrozenWallet();
        }
        _;
    }

    /// @notice Initializes a governed wallet with its owner, USDC address and modules.
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
        uint8 escalationThreshold,
        uint64 escalationExpirySeconds
    ) {
        // A zero oracle is accepted by rotateModule (the recorded opt-out) but not here:
        // a wallet born opted out would carry that only in its constructor arguments.
        if (owner_ == address(0)) {
            revert ZeroAddress();
        }
        _requireContract(usdc_);
        _requireContract(address(policyEngine_));
        _requireContract(address(escalationManager_));
        _requireContract(address(anomalyOracle_));
        _requireContract(address(vendorRegistry_));
        _validatePolicy(initialPolicy);

        owner = owner_;
        usdc = usdc_;
        policyEngine = policyEngine_;
        escalationManager = escalationManager_;
        anomalyOracle = anomalyOracle_;
        vendorRegistry = vendorRegistry_;
        policy = initialPolicy;
        policyVersion = 1;
        spendDay = block.timestamp / DAY_WINDOW;
        spendMonth = block.timestamp / MONTH_WINDOW;
        anomalyFreezeThresholdBps = 500;

        emit Events.OwnershipTransferred(address(this), address(0), owner_);
        emit Events.PolicyUpdated(address(this), 1, initialPolicy);

        for (uint256 i = 0; i < initialSigners.length; ++i) {
            _addSigner(initialSigners[i]);
        }

        escalationManager_.configureWallet(
            escalationCouncil, escalationThreshold, escalationExpirySeconds
        );
    }

    /// @inheritdoc IGuardedWallet
    function executeUSDC(address to, uint256 amount, bytes calldata reason)
        external
        nonReentrant
        onlySigner
        notFrozen
    {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        _rollSpendWindow();
        (Verdict verdict, EscalationReason decisionReason) =
            policyEngine.evaluate(policy, to, amount, dailySpent, monthlySpent, vendorRegistry);

        if (verdict == Verdict.ALLOW) {
            _spend(msg.sender, to, amount, bytes32(0));
            return;
        }

        if (verdict == Verdict.ESCALATE) {
            IEscalationManager.Terms memory terms =
                escalationManager.holdTransfer(to, amount, reason, policyVersion);
            emit Events.TransferEscalated(
                terms.escalationId,
                address(this),
                to,
                amount,
                reason,
                terms.threshold,
                terms.expiresAt,
                policyVersion,
                terms.councilVersion
            );
            return;
        }

        if (verdict == Verdict.FREEZE) {
            _freeze(FreezeSource.POLICY, decisionReason, reason);
            return;
        }

        revert TransferDenied(decisionReason);
    }

    /// @inheritdoc IGuardedWallet
    function executeEscalatedTransfer(bytes32 escalationId, address to, uint256 amount)
        external
        nonReentrant
        notFrozen
        returns (bool executed, EscalationReason reason)
    {
        if (msg.sender != address(escalationManager)) {
            revert NotEscalationManager();
        }
        if (to == address(0)) {
            revert ZeroAddress();
        }

        _rollSpendWindow();
        Verdict verdict;
        (verdict, reason) = policyEngine.evaluateRelease(
            policy, to, amount, dailySpent, monthlySpent, vendorRegistry
        );

        if (verdict == Verdict.ALLOW) {
            _spend(msg.sender, to, amount, escalationId);
            return (true, EscalationReason.NONE);
        }

        if (verdict == Verdict.FREEZE) {
            _freeze(FreezeSource.POLICY, reason, abi.encodePacked(escalationId));
        }

        return (false, reason);
    }

    /// @inheritdoc IGuardedWallet
    function triggerFreeze(bytes calldata reason) external {
        if (msg.sender != address(anomalyOracle)) {
            revert NotAnomalyOracle();
        }
        _freeze(FreezeSource.ORACLE, EscalationReason.NONE, reason);
    }

    /// @notice Freezes the wallet on the owner's authority.
    function freeze(bytes calldata reason) external onlyOwner {
        _freeze(FreezeSource.OWNER, EscalationReason.NONE, reason);
    }

    /// @notice Clears a frozen state after owner review.
    function unfreeze() external onlyOwner {
        frozen = false;
        emit Events.Unfrozen(address(this));
    }

    /// @inheritdoc IGuardedWallet
    function setPolicy(PolicyEnvelope calldata nextPolicy) external onlyOwner {
        _validatePolicy(nextPolicy);
        policy = nextPolicy;
        uint256 version = ++policyVersion;
        emit Events.PolicyUpdated(address(this), version, nextPolicy);
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
            _requireContract(newModule);
            policyEngine = IPolicyEngine(newModule);
        } else if (module == ModuleKeys.ESCALATION_MANAGER) {
            _requireContract(newModule);
            escalationManager = IEscalationManager(newModule);
        } else if (module == ModuleKeys.ANOMALY_ORACLE) {
            // Zero is the owner's opt-out from oracle freezes; AnomalyOracle.triggerFreeze
            // reads it back to refuse. The other modules sit on the transfer path and
            // cannot be emptied.
            if (newModule != address(0)) {
                _requireContract(newModule);
            }
            anomalyOracle = IAnomalyOracle(newModule);
        } else if (module == ModuleKeys.VENDOR_REGISTRY) {
            _requireContract(newModule);
            vendorRegistry = IVendorRegistry(newModule);
        } else {
            revert InvalidModule();
        }

        emit Events.ModuleRotated(address(this), module, newModule);
    }

    /// @notice Updates the anomaly score threshold that permits oracle freezes.
    function setAnomalyFreezeThresholdBps(uint256 thresholdBps) external onlyOwner {
        anomalyFreezeThresholdBps = thresholdBps;
        emit Events.AnomalyFreezeThresholdUpdated(address(this), thresholdBps);
    }

    /// @notice Reconfigures the wallet's human escalation council.
    function configureEscalation(
        address[] calldata requiredSigners,
        uint8 threshold,
        uint64 expirySeconds
    ) external onlyOwner {
        escalationManager.configureWallet(requiredSigners, threshold, expirySeconds);
    }

    /// @notice Withdraws a pending escalation before the council resolves it.
    function cancelEscalation(bytes32 escalationId) external onlyOwner {
        escalationManager.cancel(escalationId);
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

    /// @notice Moves USDC out on the owner's authority, outside the agent policy.
    /// @dev Does not count against the agent's budget windows; the event keeps owner
    ///      exits distinguishable from agent spend in the ledger.
    function withdrawUSDC(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) {
            revert ZeroAddress();
        }
        if (amount == 0) {
            revert ZeroAmount();
        }

        IERC20(usdc).safeTransfer(to, amount);
        emit Events.OwnerWithdrawal(address(this), to, amount);
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

    /// @notice Starts a two-step ownership transfer. Passing zero cancels a pending one.
    function transferOwnership(address newOwner) external onlyOwner {
        pendingOwner = newOwner;
        emit Events.OwnershipTransferStarted(address(this), newOwner);
    }

    /// @notice Completes an ownership transfer; only the pending owner may call.
    function acceptOwnership() external {
        if (msg.sender != pendingOwner) {
            revert NotPendingOwner();
        }

        address previousOwner = owner;
        owner = msg.sender;
        pendingOwner = address(0);
        emit Events.OwnershipTransferred(address(this), previousOwner, msg.sender);
    }

    function _spend(address signer, address to, uint256 amount, bytes32 escalationId) private {
        dailySpent += amount;
        monthlySpent += amount;
        IERC20(usdc).safeTransfer(to, amount);
        emit Events.TransferExecuted(address(this), signer, to, amount, escalationId);
    }

    function _freeze(FreezeSource source, EscalationReason reason, bytes memory data) private {
        frozen = true;
        emit Events.Frozen(address(this), source, reason, data);
    }

    function _addSigner(address signer) private {
        if (signer == address(0)) {
            revert ZeroAddress();
        }

        agentSigners[signer] = true;
        emit Events.SignerAdded(address(this), signer);
    }

    function _rollSpendWindow() private {
        uint256 day = block.timestamp / DAY_WINDOW;
        if (day != spendDay) {
            dailySpent = 0;
            spendDay = day;
        }
        uint256 month = block.timestamp / MONTH_WINDOW;
        if (month != spendMonth) {
            monthlySpent = 0;
            spendMonth = month;
        }
    }

    function _requireContract(address target) private view {
        if (target == address(0)) {
            revert ZeroAddress();
        }
        if (target.code.length == 0) {
            revert NotContract();
        }
    }

    function _validatePolicy(PolicyEnvelope memory envelope) private pure {
        if (envelope.perTxCap == 0 || envelope.daily24hCap == 0) {
            revert InvalidPolicy();
        }
        if (envelope.perTxCap > envelope.daily24hCap) {
            revert InvalidPolicy();
        }
        if (envelope.monthlyCap != 0 && envelope.monthlyCap < envelope.daily24hCap) {
            revert InvalidPolicy();
        }
        if (envelope.escalationThreshold == 0 || envelope.escalationThreshold > envelope.perTxCap) {
            revert InvalidPolicy();
        }
    }
}
