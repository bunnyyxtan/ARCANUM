// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import {
    EscalationReason,
    PolicyEnvelope,
    RestraintCategory,
    Verdict
} from "../src/libraries/PolicyTypes.sol";

contract PolicyEngineTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    function test_evaluateBlockedVendorFreezesWhenConfigured() public {
        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), evilVendor, 1 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.FREEZE));
        assertEq(uint256(reason), uint256(EscalationReason.BLOCKED_VENDOR));
    }

    function test_evaluateBlockedVendorDeniesWhenFreezeDisabled() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.freezeOnBlockedVendor = false;

        (Verdict verdict, EscalationReason reason) = _evaluate(policy, evilVendor, 1 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.BLOCKED_VENDOR));
    }

    function test_evaluateUnknownVendorDeniesWhenAllowlistRequired() public {
        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), recipient, 1 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.ALLOWLIST_REQUIRED));
    }

    function test_evaluateAllowsUnknownVendorWhenAllowlistDisabledDespiteCategoryMask() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.requireAllowlist = false;
        policy.allowedCategories = 0;

        (Verdict verdict, EscalationReason reason) = _evaluate(policy, recipient, 10 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.ALLOW));
        assertEq(uint256(reason), uint256(EscalationReason.NONE));
    }

    function test_evaluateDeniesDisabledCategoryForRegisteredVendor() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.allowedCategories &= ~(uint256(1) << uint8(RestraintCategory.API));

        (Verdict verdict, EscalationReason reason) = _evaluate(policy, openAi, 10 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.CATEGORY_DISABLED));
    }

    function test_evaluateDeniesAbovePerVendorCapWithPerVendorReason() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.perTxCap = 1_000 * USDC_1;
        policy.daily24hCap = 2_000 * USDC_1;
        policy.monthlyCap = 60_000 * USDC_1;
        policy.escalationThreshold = 1_000 * USDC_1;

        (Verdict verdict, EscalationReason reason) =
            _evaluate(policy, awsBedrock, 501 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.PER_VENDOR_CAP));
    }

    function test_evaluateDailyCapDeniesBeforeEscalationThreshold() public {
        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), awsBedrock, 73 * USDC_1, 990 * USDC_1, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.DAILY_CAP));
    }

    function test_evaluateMonthlyCapDeniesBeforeEscalationThreshold() public {
        PolicyEnvelope memory policy = defaultPolicy();

        (Verdict verdict, EscalationReason reason) =
            _evaluate(policy, awsBedrock, 73 * USDC_1, 0, 29_950 * USDC_1);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.MONTHLY_CAP));
    }

    function test_evaluateEscalatesAboveThreshold() public {
        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), awsBedrock, 73 * USDC_1, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.ESCALATE));
        assertEq(uint256(reason), uint256(EscalationReason.ESCALATION_THRESHOLD));
    }

    function test_evaluateReleaseAllowsTransferThatOnlyBreachesEscalationThreshold() public {
        PolicyEnvelope memory policy = defaultPolicy();

        (Verdict evaluateVerdict, EscalationReason evaluateReason) =
            _evaluate(policy, awsBedrock, 73 * USDC_1, 0, 0);
        (Verdict releaseVerdict, EscalationReason releaseReason) =
            _evaluateRelease(policy, awsBedrock, 73 * USDC_1, 0, 0);

        assertEq(uint256(evaluateVerdict), uint256(Verdict.ESCALATE));
        assertEq(uint256(evaluateReason), uint256(EscalationReason.ESCALATION_THRESHOLD));
        assertEq(uint256(releaseVerdict), uint256(Verdict.ALLOW));
        assertEq(uint256(releaseReason), uint256(EscalationReason.NONE));
    }

    function test_evaluateReleaseMatchesEveryNonEscalationDenial() public {
        PolicyEnvelope memory policy = defaultPolicy();
        _assertReleaseMatches(policy, evilVendor, 1 * USDC_1, 0, 0);
        policy.freezeOnBlockedVendor = false;
        _assertReleaseMatches(policy, evilVendor, 1 * USDC_1, 0, 0);
        policy.freezeOnBlockedVendor = true;
        _assertReleaseMatches(policy, recipient, 1 * USDC_1, 0, 0);

        policy.allowedCategories &= ~(uint256(1) << uint8(RestraintCategory.API));
        _assertReleaseMatches(policy, openAi, 1 * USDC_1, 0, 0);

        policy = defaultPolicy();
        _assertReleaseMatches(policy, openAi, 101 * USDC_1, 0, 0);

        policy.perTxCap = 1_000 * USDC_1;
        policy.daily24hCap = 2_000 * USDC_1;
        policy.monthlyCap = 60_000 * USDC_1;
        policy.escalationThreshold = 1_000 * USDC_1;
        _assertReleaseMatches(policy, awsBedrock, 501 * USDC_1, 0, 0);

        policy = defaultPolicy();
        _assertReleaseMatches(policy, openAi, 20 * USDC_1, 990 * USDC_1, 0);
        _assertReleaseMatches(policy, openAi, 20 * USDC_1, 0, 29_990 * USDC_1);
    }

    function test_evaluateTreatsZeroMonthlyCapAsUnlimited() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.monthlyCap = 0;

        (Verdict verdict, EscalationReason reason) =
            _evaluate(policy, openAi, 30 * USDC_1, 0, 1_000_000 * USDC_1);

        assertEq(uint256(verdict), uint256(Verdict.ALLOW));
        assertEq(uint256(reason), uint256(EscalationReason.NONE));
    }

    function testFuzz_evaluateDeniesAbovePerTxCap(uint256 amount) public {
        amount = bound(amount, 101 * USDC_1, type(uint128).max);
        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), openAi, amount, 0, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.PER_TX_CAP));
    }

    function testFuzz_evaluateDeniesAboveDailyCap(uint256 dailySpent, uint256 amount) public {
        dailySpent = bound(dailySpent, 990 * USDC_1, 999 * USDC_1);
        amount = bound(amount, (1_000 * USDC_1) - dailySpent + 1, 49 * USDC_1);

        (Verdict verdict, EscalationReason reason) =
            _evaluate(defaultPolicy(), openAi, amount, dailySpent, 0);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.DAILY_CAP));
    }

    function _assertReleaseMatches(
        PolicyEnvelope memory policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent
    ) private {
        (Verdict verdict, EscalationReason reason) =
            _evaluate(policy, to, amount, dailySpent, monthlySpent);
        (Verdict releaseVerdict, EscalationReason releaseReason) =
            _evaluateRelease(policy, to, amount, dailySpent, monthlySpent);

        assertEq(uint256(releaseVerdict), uint256(verdict));
        assertEq(uint256(releaseReason), uint256(reason));
    }

    function _evaluate(
        PolicyEnvelope memory policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent
    ) private returns (Verdict verdict, EscalationReason reason) {
        vm.prank(address(wallet));
        return policyEngine.evaluate(policy, to, amount, dailySpent, monthlySpent, vendorRegistry);
    }

    function _evaluateRelease(
        PolicyEnvelope memory policy,
        address to,
        uint256 amount,
        uint256 dailySpent,
        uint256 monthlySpent
    ) private returns (Verdict verdict, EscalationReason reason) {
        vm.prank(address(wallet));
        return policyEngine.evaluateRelease(
            policy, to, amount, dailySpent, monthlySpent, vendorRegistry
        );
    }
}
