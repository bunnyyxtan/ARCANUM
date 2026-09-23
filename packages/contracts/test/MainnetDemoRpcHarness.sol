// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GuardedWallet } from "../src/GuardedWallet.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import {
    EscalationReason, PolicyEnvelope, RestraintCategory
} from "../src/libraries/PolicyTypes.sol";

contract RpcCouncilHelper {
    function approve(IEscalationManager manager, bytes32 escalationId) external {
        manager.approve(escalationId);
    }
}

/// @notice Runtime used only as an eth_call state override. It is never deployed.
contract MainnetDemoRpcHarness {
    uint256 private constant USDC_1 = 1e6;
    address private constant FACTORY = 0x7077A28C003D9274d45263b04Ac9cB9a58Ab5342;
    address private constant USDC = 0x3600000000000000000000000000000000000000;
    address private constant VENDOR = 0x000000000000000000000000000000000000a111;
    address private constant RECOVERY = 0x000000000000000000000000000000000000A222;
    uint256 private escalationNonce;

    struct Result {
        address wallet;
        uint256 fundedBalance;
        uint256 walletFinalBalance;
        uint256 vendorBalance;
        uint256 recoveryBalance;
        uint256 dailySpent;
        uint256 monthlySpent;
        uint8 approvedStatus;
        uint8 rejectedStatus;
        uint8 cancelledStatus;
        bool denied12;
        bool freezeCycle;
    }

    function run() external returns (Result memory result) {
        RpcCouncilHelper helper = new RpcCouncilHelper();
        address[] memory signers = new address[](1);
        signers[0] = address(this);
        address[] memory council = new address[](2);
        council[0] = address(this);
        council[1] = address(helper);

        GuardedWallet wallet = GuardedWallet(
            WalletFactory(FACTORY).createWallet(
                address(this), "rpc-read-only-gate", _policy(), signers, council, 2, 1 hours
            )
        );
        wallet.addVendor(
            VENDOR, uint8(RestraintCategory.API), 0, keccak256(bytes("rpc-read-only-vendor"))
        );

        require(IERC20(USDC).transfer(address(wallet), 15 * USDC_1), "fund transfer");
        result.fundedBalance = IERC20(USDC).balanceOf(address(wallet));
        require(result.fundedBalance == 15 * USDC_1, "fund balance");

        wallet.executeUSDC(VENDOR, 2 * USDC_1, bytes("allow 2"));
        try wallet.executeUSDC(VENDOR, 12 * USDC_1, bytes("deny 12")) {
            result.denied12 = false;
        } catch {
            result.denied12 = true;
        }

        IEscalationManager manager = wallet.escalationManager();
        bytes32 approveId = _hold(wallet, 6 * USDC_1, bytes("approve 6"));
        manager.approve(approveId);
        helper.approve(manager, approveId);
        result.approvedStatus = uint8(manager.statusOf(approveId));

        bytes32 rejectId = _hold(wallet, 5 * USDC_1, bytes("reject 5"));
        manager.reject(rejectId);
        result.rejectedStatus = uint8(manager.statusOf(rejectId));

        bytes32 cancelId = _hold(wallet, 5 * USDC_1, bytes("cancel 5"));
        wallet.cancelEscalation(cancelId);
        result.cancelledStatus = uint8(manager.statusOf(cancelId));

        wallet.freeze(bytes("rpc read-only safety stop"));
        bool wasFrozen = wallet.frozen();
        wallet.unfreeze();
        result.freezeCycle = wasFrozen && !wallet.frozen();

        wallet.withdrawUSDC(RECOVERY, 7 * USDC_1);
        result.wallet = address(wallet);
        result.walletFinalBalance = IERC20(USDC).balanceOf(address(wallet));
        result.vendorBalance = IERC20(USDC).balanceOf(VENDOR);
        result.recoveryBalance = IERC20(USDC).balanceOf(RECOVERY);
        result.dailySpent = wallet.dailySpent();
        result.monthlySpent = wallet.monthlySpent();
    }

    function _hold(GuardedWallet wallet, uint256 amount, bytes memory reason)
        private
        returns (bytes32 escalationId)
    {
        uint256 nonce = ++escalationNonce;
        escalationId =
            keccak256(abi.encode(address(wallet), VENDOR, amount, nonce, block.timestamp));
        wallet.executeUSDC(VENDOR, amount, reason);
    }

    function _policy() private pure returns (PolicyEnvelope memory policy) {
        policy = PolicyEnvelope({
            perTxCap: 8 * USDC_1,
            daily24hCap: 15 * USDC_1,
            monthlyCap: 30 * USDC_1,
            allowedCategories: uint256(1) << uint8(RestraintCategory.API),
            escalationThreshold: 3 * USDC_1,
            requireAllowlist: true,
            freezeOnBlockedVendor: true
        });
    }
}
