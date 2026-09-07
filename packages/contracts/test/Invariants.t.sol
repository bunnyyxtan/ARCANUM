// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { StdInvariant } from "forge-std/StdInvariant.sol";
import { Test } from "forge-std/Test.sol";

import { AnomalyOracle } from "../src/AnomalyOracle.sol";
import { EscalationManager } from "../src/EscalationManager.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import { ModuleKeys, PolicyEnvelope, RestraintCategory } from "../src/libraries/PolicyTypes.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { VendorRegistry } from "../src/VendorRegistry.sol";
import { ArcanumTestBase } from "./ArcanumTestBase.sol";

contract ProtocolHandler is Test {
    GuardedWallet internal wallet;
    EscalationManager internal manager;
    AnomalyOracle internal oracle;
    MockUSDC internal usdc;

    address internal owner;
    address internal signer;
    address internal councilOne;
    address internal councilTwo;
    address internal councilThree;
    address internal allowedVendor;
    address internal blockedVendor;
    address internal unknownVendor;
    uint256 internal oraclePrivateKey;

    bytes32[] internal escalationIds;
    mapping(bytes32 escalationId => uint256 amount) internal escalationAmounts;
    mapping(bytes32 escalationId => uint256 count) internal executionCounts;
    mapping(bytes32 escalationId => uint256 version) internal heldCouncilVersions;
    mapping(bytes32 escalationId => uint256 version) internal executionCouncilVersions;

    uint256 public ghostTransferOut;
    uint256 public ghostOwnerWithdrawals;
    uint256 public ghostEscalatedOut;
    bool public ghostTransferWhileFrozen;

    constructor(
        GuardedWallet wallet_,
        EscalationManager manager_,
        AnomalyOracle oracle_,
        MockUSDC usdc_,
        address owner_,
        address signer_,
        address[3] memory council_,
        address[3] memory vendors_,
        uint256 oraclePrivateKey_
    ) {
        wallet = wallet_;
        manager = manager_;
        oracle = oracle_;
        usdc = usdc_;
        owner = owner_;
        signer = signer_;
        councilOne = council_[0];
        councilTwo = council_[1];
        councilThree = council_[2];
        allowedVendor = vendors_[0];
        blockedVendor = vendors_[1];
        unknownVendor = vendors_[2];
        oraclePrivateKey = oraclePrivateKey_;
    }

    function executeUSDC(uint256 vendorSeed, uint256 rawAmount) external {
        uint256 balanceBefore = usdc.balanceOf(address(wallet));
        if (balanceBefore == 0) {
            return;
        }
        address to = _vendor(vendorSeed);
        uint256 amount = bound(rawAmount, 1, balanceBefore);
        uint256 nonceBefore = manager.walletNonces(address(wallet));
        bool frozenBefore = wallet.frozen();
        uint256 timestamp = block.timestamp;

        vm.prank(signer);
        (bool ok,) = address(wallet).call(
            abi.encodeWithSelector(wallet.executeUSDC.selector, to, amount, bytes("invariant"))
        );
        uint256 balanceAfter = usdc.balanceOf(address(wallet));
        _recordTransfer(balanceBefore, balanceAfter, frozenBefore);

        if (ok && manager.walletNonces(address(wallet)) == nonceBefore + 1) {
            bytes32 escalationId =
                keccak256(abi.encode(address(wallet), to, amount, nonceBefore + 1, timestamp));
            escalationIds.push(escalationId);
            escalationAmounts[escalationId] = amount;
            heldCouncilVersions[escalationId] = manager.councilVersion(address(wallet));
        }
    }

    function setPolicy(
        uint256 rawPerTx,
        uint256 rawDaily,
        uint256 rawMonthly,
        uint256 rawThreshold,
        bool requireAllowlist,
        bool freezeOnBlockedVendor
    ) external {
        uint256 minimumDaily = wallet.dailySpent();
        if (minimumDaily == 0) {
            minimumDaily = 1;
        }
        uint256 daily = bound(rawDaily, minimumDaily, 4_000_000_000);
        uint256 perTx = bound(rawPerTx, 1, daily);
        uint256 monthly = bound(rawMonthly, daily, 120_000_000_000);
        uint256 threshold = bound(rawThreshold, 1, perTx);
        PolicyEnvelope memory nextPolicy = PolicyEnvelope({
            perTxCap: perTx,
            daily24hCap: daily,
            monthlyCap: monthly,
            allowedCategories: type(uint256).max,
            escalationThreshold: threshold,
            requireAllowlist: requireAllowlist,
            freezeOnBlockedVendor: freezeOnBlockedVendor
        });

        vm.prank(owner);
        (bool ok,) =
            address(wallet).call(abi.encodeWithSelector(wallet.setPolicy.selector, nextPolicy));
        ok;
    }

    function freezeOrUnfreeze(bool shouldFreeze) external {
        vm.prank(owner);
        if (shouldFreeze) {
            (bool ok,) = address(wallet).call(
                abi.encodeWithSelector(wallet.freeze.selector, bytes("invariant"))
            );
            ok;
        } else {
            (bool ok,) = address(wallet).call(abi.encodeWithSelector(wallet.unfreeze.selector));
            ok;
        }
    }

    function withdrawUSDC(uint256 rawAmount) external {
        uint256 balanceBefore = usdc.balanceOf(address(wallet));
        if (balanceBefore == 0) {
            return;
        }
        uint256 amount = bound(rawAmount, 1, balanceBefore);
        vm.prank(owner);
        (bool ok,) = address(wallet).call(
            abi.encodeWithSelector(wallet.withdrawUSDC.selector, address(0xD00D), amount)
        );
        if (ok) {
            ghostOwnerWithdrawals += balanceBefore - usdc.balanceOf(address(wallet));
        }
    }

    function resolveEscalation(uint256 idSeed, uint256 councilSeed, bool approve) external {
        if (escalationIds.length == 0) {
            return;
        }
        bytes32 escalationId = escalationIds[idSeed % escalationIds.length];
        if (manager.statusOf(escalationId) != IEscalationManager.Status.PENDING) {
            return;
        }
        address council = _council(councilSeed);
        uint256 balanceBefore = usdc.balanceOf(address(wallet));
        bool frozenBefore = wallet.frozen();

        vm.prank(council);
        if (approve) {
            (bool ok,) = address(manager).call(
                abi.encodeWithSelector(manager.approve.selector, escalationId)
            );
            ok;
        } else {
            (bool ok,) =
                address(manager).call(abi.encodeWithSelector(manager.reject.selector, escalationId));
            ok;
        }

        uint256 balanceAfter = usdc.balanceOf(address(wallet));
        _recordTransfer(balanceBefore, balanceAfter, frozenBefore);
        if (
            manager.statusOf(escalationId) == IEscalationManager.Status.EXECUTED
                && executionCounts[escalationId] == 0
        ) {
            executionCounts[escalationId] = 1;
            executionCouncilVersions[escalationId] = manager.councilVersion(address(wallet));
            ghostEscalatedOut += balanceBefore - balanceAfter;
        }
    }

    function configureEscalation(uint256 rawSubset, uint256 rawThreshold, uint256 rawExpiry)
        external
    {
        uint256 subset = (rawSubset % 7) + 1;
        uint256 memberCount;
        for (uint256 i = 0; i < 3; ++i) {
            if ((subset & (uint256(1) << i)) != 0) {
                ++memberCount;
            }
        }

        address[] memory council = new address[](memberCount);
        uint256 nextIndex;
        for (uint256 i = 0; i < 3; ++i) {
            if ((subset & (uint256(1) << i)) != 0) {
                council[nextIndex++] = _council(i);
            }
        }
        uint8 threshold = uint8(bound(rawThreshold, 1, memberCount));
        uint64 expiry = uint64(bound(rawExpiry, 1 hours, 3 days));

        vm.prank(owner);
        (bool ok,) = address(wallet).call(
            abi.encodeWithSelector(wallet.configureEscalation.selector, council, threshold, expiry)
        );
        ok;
    }

    function cancelEscalation(uint256 idSeed) external {
        if (escalationIds.length == 0) {
            return;
        }
        bytes32 escalationId = escalationIds[idSeed % escalationIds.length];
        if (manager.statusOf(escalationId) != IEscalationManager.Status.PENDING) {
            return;
        }

        vm.prank(owner);
        (bool ok,) = address(wallet).call(
            abi.encodeWithSelector(wallet.cancelEscalation.selector, escalationId)
        );
        ok;
    }

    function rotateVendorRegistry() external {
        VendorRegistry nextRegistry = new VendorRegistry();
        vm.startPrank(owner);
        (bool rotated,) = address(wallet).call(
            abi.encodeWithSelector(
                wallet.rotateModule.selector, ModuleKeys.VENDOR_REGISTRY, address(nextRegistry)
            )
        );
        if (rotated) {
            wallet.addVendor(
                allowedVendor, uint8(RestraintCategory.API), 0, keccak256(bytes("allowed"))
            );
            wallet.addVendor(
                blockedVendor, uint8(RestraintCategory.DATA), 0, keccak256(bytes("blocked"))
            );
            wallet.blockVendor(blockedVendor);
        }
        vm.stopPrank();
    }

    function oracleScoreAndFreeze(uint256 rawScore) external {
        uint256 score = bound(rawScore, wallet.anomalyFreezeThresholdBps() + 1, 10_000);
        uint256 deadline = block.timestamp + 1 days;
        uint256 nonce = oracle.scoreNonce(address(wallet));
        bytes32 digest = keccak256(
            abi.encodePacked(
                "ARCANUM_ANOMALY_SCORE",
                block.chainid,
                address(oracle),
                address(wallet),
                score,
                nonce,
                deadline
            )
        );
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(oraclePrivateKey, MessageHashUtils.toEthSignedMessageHash(digest));
        bytes memory signature = abi.encodePacked(r, s, v);
        (bool submitted,) = address(oracle).call(
            abi.encodeWithSelector(
                oracle.submitScore.selector, address(wallet), score, deadline, signature
            )
        );
        if (!submitted) {
            return;
        }
        (bool frozen,) = address(oracle).call(
            abi.encodeWithSelector(
                oracle.triggerFreeze.selector, address(wallet), bytes("invariant")
            )
        );
        frozen;
    }

    function warpForward(uint256 rawSeconds) external {
        vm.warp(block.timestamp + bound(rawSeconds, 0, 2 days));
    }

    function escalationCount() external view returns (uint256) {
        return escalationIds.length;
    }

    function escalationAt(uint256 index)
        external
        view
        returns (
            bytes32 id,
            uint256 amount,
            uint256 executionCount,
            uint256 heldCouncilVersion,
            uint256 executionCouncilVersion
        )
    {
        id = escalationIds[index];
        amount = escalationAmounts[id];
        executionCount = executionCounts[id];
        heldCouncilVersion = heldCouncilVersions[id];
        executionCouncilVersion = executionCouncilVersions[id];
    }

    function _recordTransfer(uint256 beforeBalance, uint256 afterBalance, bool frozenBefore)
        private
    {
        if (afterBalance >= beforeBalance) {
            return;
        }
        uint256 delta = beforeBalance - afterBalance;
        ghostTransferOut += delta;
        if (frozenBefore) {
            ghostTransferWhileFrozen = true;
        }
    }

    function _vendor(uint256 seed) private view returns (address) {
        uint256 index = seed % 3;
        if (index == 0) {
            return allowedVendor;
        }
        if (index == 1) {
            return blockedVendor;
        }
        return unknownVendor;
    }

    function _council(uint256 seed) private view returns (address) {
        uint256 index = seed % 3;
        if (index == 0) {
            return councilOne;
        }
        if (index == 1) {
            return councilTwo;
        }
        return councilThree;
    }
}

contract Invariants is StdInvariant, ArcanumTestBase {
    ProtocolHandler private handler;
    uint256 private initialMint;

    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
        initialMint = usdc.balanceOf(address(wallet));

        address[3] memory council = [councilOne, councilTwo, councilThree];
        address[3] memory vendors = [openAi, evilVendor, recipient];
        handler = new ProtocolHandler(
            wallet,
            escalationManager,
            anomalyOracle,
            usdc,
            owner,
            signer,
            council,
            vendors,
            oraclePrivateKey
        );
        targetContract(address(handler));
    }

    function invariant_NoTransferExecutesWhileFrozen() public view {
        assertFalse(handler.ghostTransferWhileFrozen());
    }

    function invariant_DailySpendNeverExceedsCurrentPolicyCap() public view {
        (, uint256 daily24hCap,,,,,) = wallet.policy();
        assertLe(wallet.dailySpent(), daily24hCap);
    }

    function invariant_EscalationsExecuteAtMostOnceAndReconcile() public view {
        uint256 executedTotal;
        uint256 count = handler.escalationCount();
        for (uint256 i = 0; i < count; ++i) {
            (bytes32 id, uint256 amount, uint256 executionCount,,) = handler.escalationAt(i);
            assertLe(executionCount, 1);
            if (escalationManager.statusOf(id) == IEscalationManager.Status.EXECUTED) {
                executedTotal += amount;
                assertEq(executionCount, 1);
            }
        }
        assertEq(handler.ghostEscalatedOut(), executedTotal);
    }

    function invariant_ExecutedEscalationsUseTheirHeldCouncilVersion() public view {
        uint256 count = handler.escalationCount();
        for (uint256 i = 0; i < count; ++i) {
            (bytes32 id,,, uint256 heldCouncilVersion, uint256 executionCouncilVersion) =
                handler.escalationAt(i);
            (,,,,,,,, IEscalationManager.Status status,, uint256 storedCouncilVersion) =
                escalationManager.getEscalation(id);
            assertEq(storedCouncilVersion, heldCouncilVersion);
            if (status == IEscalationManager.Status.EXECUTED) {
                assertEq(executionCouncilVersion, heldCouncilVersion);
            }
        }
    }

    function invariant_WalletBalanceReconcilesAllOutflows() public view {
        assertEq(
            usdc.balanceOf(address(wallet)),
            initialMint - handler.ghostTransferOut() - handler.ghostOwnerWithdrawals()
        );
    }
}
