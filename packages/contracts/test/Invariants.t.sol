// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { StdInvariant } from "forge-std/StdInvariant.sol";

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { GuardedWallet } from "../src/GuardedWallet.sol";
import { PolicyEnvelope } from "../src/libraries/PolicyTypes.sol";

contract ProtocolAttackerHandler is ArcanumTestBase {
    GuardedWallet internal targetWallet;
    address internal attackerAddress;

    constructor(GuardedWallet wallet_, address attacker_) {
        targetWallet = wallet_;
        attackerAddress = attacker_;
    }

    function tryExecute(uint96 rawAmount) external {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000_000);
        vm.prank(attackerAddress);
        (bool executeCallOk,) = address(targetWallet)
            .call(
                abi.encodeWithSelector(
                    targetWallet.executeUSDC.selector, address(0xAAAA), amount, bytes("attack")
                )
            );
        executeCallOk;
    }

    function tryOwnerFunctions(uint96 rawAmount) external {
        PolicyEnvelope memory nextPolicy = defaultPolicy();
        nextPolicy.perTxCap = bound(uint256(rawAmount), 1, 100 * USDC_1);
        vm.startPrank(attackerAddress);
        (bool setPolicyOk,) = address(targetWallet)
            .call(abi.encodeWithSelector(targetWallet.setPolicy.selector, nextPolicy));
        (bool addSignerOk,) = address(targetWallet)
            .call(abi.encodeWithSelector(targetWallet.addSigner.selector, attackerAddress));
        (bool unfreezeOk,) =
            address(targetWallet).call(abi.encodeWithSelector(targetWallet.unfreeze.selector));
        setPolicyOk;
        addSignerOk;
        unfreezeOk;
        vm.stopPrank();
    }
}

contract Invariants is StdInvariant, ArcanumTestBase {
    ProtocolAttackerHandler private handler;
    address private attacker = address(0xBAD);
    address[] private deployedWallets;
    bytes32 private expiredEscalationId;
    uint256 private expiredWalletBalance;

    function setUp() public {
        setUpProtocol();
        deployDefaultWallet();
        handler = new ProtocolAttackerHandler(wallet, attacker);
        targetContract(address(handler));

        for (uint160 i = 1; i <= 50; ++i) {
            address deployer = address(i + 0x9000);
            address targetOwner = address(i + 0xA000);
            vm.prank(deployer);
            deployedWallets.push(
                factory.createWallet(
                    targetOwner,
                    "Wallet",
                    defaultPolicy(),
                    _oneSigner(address(i + 0xB000)),
                    defaultCouncil(),
                    2
                )
            );
        }

        uint256 timestamp = block.timestamp;
        vm.prank(signer);
        wallet.executeUSDC(awsBedrock, 73 * USDC_1, bytes("expires"));
        expiredEscalationId =
            escalationIdFor(address(wallet), awsBedrock, 73 * USDC_1, 1, timestamp);
        expiredWalletBalance = usdc.balanceOf(address(wallet));
        vm.warp(block.timestamp + 1 hours + 1);
        escalationManager.sweepExpired(expiredEscalationId);
    }

    function invariant_NoProtocolAddressCanMoveFunds() public view {
        assertEq(usdc.balanceOf(attacker), 0);
        assertEq(usdc.balanceOf(address(handler)), 0);
    }

    function invariant_NoUpgradeKeyOnWallets() public {
        assertFalse(_selectorSucceeds(0x3659cfe6));
        assertFalse(_selectorSucceeds(0x4f1ef286));
        assertFalse(_selectorSucceeds(0x52d1902d));
        assertFalse(_selectorSucceeds(0x5c60da1b));
        assertFalse(_selectorSucceeds(0xf851a440));
    }

    function invariant_PolicyEnforcementIsOnChain() public {
        vm.prank(signer);
        (bool ok,) = address(wallet)
            .call(
                abi.encodeWithSelector(
                    wallet.executeUSDC.selector, openAi, 101 * USDC_1, bytes("over cap")
                )
            );
        assertFalse(ok);
    }

    function invariant_AnyoneCanDeploy() public view {
        assertEq(deployedWallets.length, 50);
        for (uint256 i = 0; i < deployedWallets.length; ++i) {
            assertGt(deployedWallets[i].code.length, 0);
        }
    }

    function invariant_ExpiredEscalationsDoNotExecute() public view {
        assertEq(usdc.balanceOf(address(wallet)), expiredWalletBalance);
        assertEq(usdc.balanceOf(awsBedrock), 0);
    }

    function _selectorSucceeds(bytes4 selector) private returns (bool ok) {
        (ok,) = address(wallet).call(abi.encodeWithSelector(selector, address(0), bytes("")));
    }

    function _oneSigner(address signer_) private pure returns (address[] memory signers) {
        signers = new address[](1);
        signers[0] = signer_;
    }
}
