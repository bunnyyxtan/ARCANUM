// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { GuardedWallet } from "../src/GuardedWallet.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import {
    EscalationReason, PolicyEnvelope, RestraintCategory
} from "../src/libraries/PolicyTypes.sol";

contract RpcTenAgent {
    function execute(GuardedWallet wallet, address to, uint256 amount, bytes calldata reason)
        external
    {
        wallet.executeUSDC(to, amount, reason);
    }
}

contract RpcTenCouncil {
    function approve(IEscalationManager manager, bytes32 escalationId) external {
        manager.approve(escalationId);
    }

    function reject(IEscalationManager manager, bytes32 escalationId) external {
        manager.reject(escalationId);
    }

    function returnFunds(IERC20 token, address operator, uint256 amount) external {
        require(token.transfer(operator, amount), "return transfer");
    }
}

/// @notice Revised 10-USDC runtime used only through eth_call state overrides.
contract MainnetDemoRpcTenHarness {
    uint256 private constant USDC_1 = 1e6;
    address private constant FACTORY = 0x7077A28C003D9274d45263b04Ac9cB9a58Ab5342;
    address private constant USDC = 0x3600000000000000000000000000000000000000;
    address private constant AGENT = 0x000000000000000000000000000000000000a601;
    address private constant CONTROLLED_COUNCIL = 0x049d94DDCE32B06B5D16E496967f107B20Ef0a95;
    uint256 private escalationNonce;

    struct Result {
        address wallet;
        uint256 operatorStart;
        uint256 fundedBalance;
        uint256 vendorBeforeReturn;
        uint256 recoveredByOwner;
        uint256 returnedByCouncil;
        uint256 operatorFinal;
        uint256 walletFinal;
        uint256 councilFinal;
        uint256 dailySpent;
        uint256 monthlySpent;
        uint256 executionGas;
        uint256 baseFee;
        uint8 rejectedStatus;
        uint8 cancelledStatus;
        uint8 approvedStatus;
        bool denied12;
        bool freezeCycle;
        bool finalFrozen;
    }

    function run() external returns (Result memory result) {
        uint256 startGas = gasleft();
        result.operatorStart = IERC20(USDC).balanceOf(address(this));
        require(result.operatorStart >= 10 * USDC_1, "operator below 10 USDC");

        address[] memory signers = new address[](1);
        signers[0] = AGENT;
        address[] memory council = new address[](2);
        council[0] = address(this);
        council[1] = CONTROLLED_COUNCIL;

        GuardedWallet wallet = GuardedWallet(
            WalletFactory(FACTORY).createWallet(
                address(this), "rpc-read-only-10-usdc", _policy(), signers, council, 2, 1 hours
            )
        );
        wallet.addVendor(
            CONTROLLED_COUNCIL,
            uint8(RestraintCategory.API),
            0,
            keccak256(bytes("controlled-report-council"))
        );

        require(IERC20(USDC).transfer(address(wallet), 10 * USDC_1), "fund transfer");
        result.fundedBalance = IERC20(USDC).balanceOf(address(wallet));

        RpcTenAgent(AGENT).execute(wallet, CONTROLLED_COUNCIL, 2 * USDC_1, bytes("record allow 2"));
        try RpcTenAgent(AGENT).execute(
            wallet, CONTROLLED_COUNCIL, 12 * USDC_1, bytes("record deny 12")
        ) {
            result.denied12 = false;
        } catch {
            result.denied12 = true;
        }

        IEscalationManager manager = wallet.escalationManager();
        bytes32 rejectId = _hold(wallet, manager, 5 * USDC_1, bytes("record reject 5"));
        RpcTenCouncil(CONTROLLED_COUNCIL).reject(manager, rejectId);
        result.rejectedStatus = uint8(manager.statusOf(rejectId));

        bytes32 cancelId = _hold(wallet, manager, 5 * USDC_1, bytes("record cancel 5"));
        wallet.cancelEscalation(cancelId);
        result.cancelledStatus = uint8(manager.statusOf(cancelId));

        bytes32 approveId = _hold(wallet, manager, 6 * USDC_1, bytes("record approve 6"));
        manager.approve(approveId);
        RpcTenCouncil(CONTROLLED_COUNCIL).approve(manager, approveId);
        result.approvedStatus = uint8(manager.statusOf(approveId));

        wallet.freeze(bytes("record freeze cycle"));
        bool wasFrozen = wallet.frozen();
        wallet.unfreeze();
        result.freezeCycle = wasFrozen && !wallet.frozen();
        wallet.freeze(bytes("record final freeze"));
        result.finalFrozen = wallet.frozen();

        uint256 operatorBeforeRecovery = IERC20(USDC).balanceOf(address(this));
        wallet.withdrawUSDC(address(this), 2 * USDC_1);
        result.recoveredByOwner = IERC20(USDC).balanceOf(address(this)) - operatorBeforeRecovery;

        result.vendorBeforeReturn = IERC20(USDC).balanceOf(CONTROLLED_COUNCIL);
        RpcTenCouncil(CONTROLLED_COUNCIL).returnFunds(
            IERC20(USDC), address(this), result.vendorBeforeReturn
        );
        result.returnedByCouncil = result.vendorBeforeReturn;

        result.wallet = address(wallet);
        result.operatorFinal = IERC20(USDC).balanceOf(address(this));
        result.walletFinal = IERC20(USDC).balanceOf(address(wallet));
        result.councilFinal = IERC20(USDC).balanceOf(CONTROLLED_COUNCIL);
        result.dailySpent = wallet.dailySpent();
        result.monthlySpent = wallet.monthlySpent();
        result.executionGas = startGas - gasleft();
        result.baseFee = block.basefee;
    }

    function _hold(
        GuardedWallet wallet,
        IEscalationManager manager,
        uint256 amount,
        bytes memory reason
    ) private returns (bytes32 escalationId) {
        uint256 nonce = ++escalationNonce;
        escalationId = keccak256(
            abi.encode(address(wallet), CONTROLLED_COUNCIL, amount, nonce, block.timestamp)
        );
        RpcTenAgent(AGENT).execute(wallet, CONTROLLED_COUNCIL, amount, reason);
        require(manager.statusOf(escalationId) == IEscalationManager.Status.PENDING, "not held");
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
