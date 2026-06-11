// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { EscalationReason, PolicyEnvelope, Verdict } from "../src/libraries/PolicyTypes.sol";

contract PolicyEngineTest is ArcanumTestBase {
    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
    }

    function test_evaluateBlockedVendorFreezes() public {
        (Verdict verdict, EscalationReason reason) = _evaluate(evilVendor, 1 * USDC_1, 0);
        assertEq(uint256(verdict), uint256(Verdict.FREEZE));
        assertEq(uint256(reason), uint256(EscalationReason.BLOCKED_VENDOR));
    }

    function test_evaluateUnknownVendorDeniesWhenAllowlistRequired() public {
        (Verdict verdict, EscalationReason reason) = _evaluate(recipient, 1 * USDC_1, 0);
        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.ALLOWLIST_REQUIRED));
    }

    function test_evaluateEscalatesAboveThreshold() public {
        (Verdict verdict, EscalationReason reason) = _evaluate(awsBedrock, 73 * USDC_1, 0);
        assertEq(uint256(verdict), uint256(Verdict.ESCALATE));
        assertEq(uint256(reason), uint256(EscalationReason.ESCALATION_THRESHOLD));
    }

    function test_evaluateDeniesDisabledCategory() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.allowedCategories &= ~(uint256(1) << uint8(0));

        vm.prank(address(wallet));
        (Verdict verdict, EscalationReason reason) =
            policyEngine.evaluate(policy, openAi, 10 * USDC_1, 0, vendorRegistry);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.CATEGORY_DISABLED));
    }

    function test_evaluateDeniesAbovePerVendorCap() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.perTxCap = 1_000 * USDC_1;
        policy.daily24hCap = 2_000 * USDC_1;
        policy.escalationThreshold = 1_000 * USDC_1;

        vm.prank(address(wallet));
        (Verdict verdict, EscalationReason reason) =
            policyEngine.evaluate(policy, awsBedrock, 501 * USDC_1, 0, vendorRegistry);

        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.PER_TX_CAP));
    }

    function test_evaluateAllowsUnknownVendorWhenAllowlistDisabled() public {
        PolicyEnvelope memory policy = defaultPolicy();
        policy.requireAllowlist = false;

        vm.prank(address(wallet));
        (Verdict verdict, EscalationReason reason) =
            policyEngine.evaluate(policy, recipient, 10 * USDC_1, 0, vendorRegistry);

        assertEq(uint256(verdict), uint256(Verdict.ALLOW));
        assertEq(uint256(reason), uint256(EscalationReason.NONE));
    }

    function testFuzz_evaluateDeniesAbovePerTxCap(uint256 amount) public {
        amount = bound(amount, 101 * USDC_1, type(uint128).max);
        (Verdict verdict, EscalationReason reason) = _evaluate(openAi, amount, 0);
        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.PER_TX_CAP));
    }

    function testFuzz_evaluateDeniesAboveDailyCap(uint256 dailySpent, uint256 amount) public {
        dailySpent = bound(dailySpent, 990 * USDC_1, 999 * USDC_1);
        uint256 minAmount = (1_000 * USDC_1) - dailySpent + 1;
        amount = bound(amount, minAmount, 49 * USDC_1);
        (Verdict verdict, EscalationReason reason) = _evaluate(openAi, amount, dailySpent);
        assertEq(uint256(verdict), uint256(Verdict.DENY));
        assertEq(uint256(reason), uint256(EscalationReason.DAILY_CAP));
    }

    function test_evaluateAllowsWithinPolicy() public {
        (Verdict verdict, EscalationReason reason) = _evaluate(openAi, 10 * USDC_1, 0);
        assertEq(uint256(verdict), uint256(Verdict.ALLOW));
        assertEq(uint256(reason), uint256(EscalationReason.NONE));
    }

    function _evaluate(address to, uint256 amount, uint256 dailySpent)
        private
        returns (Verdict verdict, EscalationReason reason)
    {
        PolicyEnvelope memory policy = defaultPolicy();
        vm.prank(address(wallet));
        return policyEngine.evaluate(policy, to, amount, dailySpent, vendorRegistry);
    }
}
