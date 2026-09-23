// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { Test } from "forge-std/Test.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

import { GuardedWallet } from "../src/GuardedWallet.sol";
import { WalletFactory } from "../src/WalletFactory.sol";
import { MockUSDC } from "../src/mocks/MockUSDC.sol";
import { IAnomalyOracle } from "../src/interfaces/IAnomalyOracle.sol";
import { IEscalationManager } from "../src/interfaces/IEscalationManager.sol";
import { IPolicyEngine } from "../src/interfaces/IPolicyEngine.sol";
import { IVendorRegistry } from "../src/interfaces/IVendorRegistry.sol";
import {
    EscalationNotPending,
    FrozenWallet,
    NotRequiredSigner,
    TransferDenied
} from "../src/libraries/Errors.sol";
import {
    EscalationReason, PolicyEnvelope, RestraintCategory
} from "../src/libraries/PolicyTypes.sol";

/// @notice Local-only verification against the immutable Arc mainnet deployment.
/// @dev No test in this file broadcasts. The MockUSDC case is deliberately separate from
///      the native-USDC precompile probe and still uses the deployed mainnet modules.
contract MainnetDemoForkTest is Test {
    uint256 internal constant FORK_BLOCK = 22_201_692;
    uint256 internal constant USDC_1 = 1e6;

    address internal constant FACTORY = 0x7077A28C003D9274d45263b04Ac9cB9a58Ab5342;
    address internal constant POLICY_ENGINE = 0xb74De5aD09a75dea03f5ddD77A25e1Ca11724483;
    address internal constant ESCALATION_MANAGER = 0x2a653D3d90BFA13bE9d8F9eB2Cc87578967128EF;
    address internal constant ANOMALY_ORACLE = 0xb2ae97dB77c8fdF8D9CE00743A4B095E4f2AdD8F;
    address internal constant VENDOR_REGISTRY = 0x722C2f83ca55503Cf3104bABeb3EaA9d676B1469;
    address internal constant PROTOCOL_ADMIN = 0x77d9Da1f1a29f499da7f238a1CbD896c0Da27cAD;
    address internal constant NATIVE_USDC = 0x3600000000000000000000000000000000000000;
    // Public on-chain holder used only through vm.prank against the local fork.
    address internal constant FORK_FUNDING_HOLDER = 0x63C5c895fC5A7F119511bf8729cE71a3BB1f81c3;

    address internal owner = makeAddr("fork-local-owner");
    address internal agent = makeAddr("fork-local-agent");
    address internal councilOne = makeAddr("fork-local-council-1");
    address internal councilTwo = makeAddr("fork-local-council-2");
    address internal vendor = makeAddr("fork-local-vendor");
    address internal recovery = makeAddr("fork-local-recovery");
    address internal outsider = makeAddr("fork-local-outsider");

    /// @dev Set ARC_MAINNET_FORK_RPC_URL (for example https://rpc.mainnet.arc.io) to run
    ///      these tests. They need an Arc mainnet node that still serves state at
    ///      FORK_BLOCK, so they are skipped when the variable is unset and `forge test`
    ///      stays offline in CI.
    function setUp() public {
        string memory rpcUrl = vm.envOr("ARC_MAINNET_FORK_RPC_URL", string(""));
        if (bytes(rpcUrl).length == 0) {
            vm.skip(true);
            return;
        }
        vm.createSelectFork(rpcUrl, FORK_BLOCK);
        assertEq(block.chainid, 5042);
    }

    function testFork_deployedFactoryManifestAndDefaults() public view {
        WalletFactory factory = WalletFactory(FACTORY);
        (
            IPolicyEngine policyEngine,
            IEscalationManager escalationManager,
            IAnomalyOracle anomalyOracle,
            IVendorRegistry vendorRegistry
        ) = factory.defaults();

        assertEq(factory.owner(), PROTOCOL_ADMIN);
        assertEq(factory.usdc(), NATIVE_USDC);
        assertEq(IERC20Metadata(NATIVE_USDC).decimals(), 6);
        assertEq(address(policyEngine), POLICY_ENGINE);
        assertEq(address(escalationManager), ESCALATION_MANAGER);
        assertEq(address(anomalyOracle), ANOMALY_ORACLE);
        assertEq(address(vendorRegistry), VENDOR_REGISTRY);
        assertEq(factory.defaultsVersion(), 1);
        assertGt(FACTORY.code.length, 0);
        assertGt(NATIVE_USDC.code.length, 0);
    }

    /// @dev Uses 6-decimal ERC20 units. The facade scales 15e6 to 15e18 before calling
    ///      Arc's 0x18 native-token precompile, which Foundry does not implement.
    function testFork_nativeUsdcPrecompile_inheritedBalanceBoundary() public {
        GuardedWallet wallet = _createFromDeployedFactory("native-usdc-inherited-boundary");
        IERC20 nativeUsdc = IERC20(NATIVE_USDC);
        uint256 holderBefore = nativeUsdc.balanceOf(FORK_FUNDING_HOLDER);
        assertGe(holderBefore, 15 * USDC_1);

        vm.expectRevert();
        vm.prank(FORK_FUNDING_HOLDER);
        nativeUsdc.transfer(address(wallet), 15 * USDC_1);
        assertEq(nativeUsdc.balanceOf(address(wallet)), 0);
        assertEq(nativeUsdc.balanceOf(FORK_FUNDING_HOLDER), holderBefore);
    }

    /// @dev Exact Foundry boundary: vm.deal changes the generic EVM balance, not the
    ///      forked native-USDC ERC20 facade. Real settlement above uses inherited fork state.
    function testFork_nativeUsdcPrecompile_vmDealBoundary() public {
        GuardedWallet wallet = _createFromDeployedFactory("native-usdc-vm-deal-boundary");
        vm.deal(address(wallet), 15 * USDC_1);

        assertEq(address(wallet).balance, 15 * USDC_1);
        assertEq(IERC20(NATIVE_USDC).balanceOf(address(wallet)), 0);
        vm.expectRevert(bytes("ERC20: transfer amount exceeds balance"));
        vm.prank(agent);
        wallet.executeUSDC(vendor, 2 * USDC_1, bytes("allow 2"));

        assertEq(IERC20(NATIVE_USDC).balanceOf(vendor), 0);
        assertEq(wallet.dailySpent(), 0);
    }

    /// @dev Settlement uses MockUSDC, not native USDC. Policy, registry, escalation and
    ///      oracle are the actual contracts at the mainnet manifest addresses.
    function testFork_deployedModules_mockUsdc_demoSequence() public {
        MockUSDC mockUsdc = new MockUSDC();
        GuardedWallet wallet = _createWithToken(address(mockUsdc));
        mockUsdc.mint(address(wallet), 15 * USDC_1);

        _verifyDemoSequence(wallet, mockUsdc);
    }

    function _verifyDemoSequence(GuardedWallet wallet, IERC20 token) private {
        IEscalationManager escalationManager = IEscalationManager(ESCALATION_MANAGER);
        assertEq(wallet.owner(), owner);
        assertTrue(wallet.agentSigners(agent));
        assertTrue(escalationManager.isRequiredSigner(address(wallet), councilOne));
        assertTrue(escalationManager.isRequiredSigner(address(wallet), councilTwo));

        vm.prank(agent);
        wallet.executeUSDC(vendor, 2 * USDC_1, bytes("allow 2"));
        assertEq(token.balanceOf(vendor), 2 * USDC_1);

        vm.expectRevert(
            abi.encodeWithSelector(TransferDenied.selector, EscalationReason.PER_TX_CAP)
        );
        vm.prank(agent);
        wallet.executeUSDC(vendor, 12 * USDC_1, bytes("deny 12"));

        bytes32 approveId = _hold(wallet, 6 * USDC_1, 1, "escalate 6");
        vm.expectRevert(NotRequiredSigner.selector);
        vm.prank(outsider);
        escalationManager.approve(approveId);
        vm.prank(councilOne);
        escalationManager.approve(approveId);
        assertEq(
            uint256(escalationManager.statusOf(approveId)),
            uint256(IEscalationManager.Status.PENDING)
        );
        vm.prank(councilTwo);
        escalationManager.approve(approveId);
        assertEq(
            uint256(escalationManager.statusOf(approveId)),
            uint256(IEscalationManager.Status.EXECUTED)
        );
        assertEq(token.balanceOf(vendor), 8 * USDC_1);

        bytes32 rejectId = _hold(wallet, 5 * USDC_1, 2, "reject 5");
        vm.prank(councilOne);
        escalationManager.reject(rejectId);
        assertEq(
            uint256(escalationManager.statusOf(rejectId)),
            uint256(IEscalationManager.Status.REJECTED)
        );

        bytes32 cancelId = _hold(wallet, 5 * USDC_1, 3, "cancel 5");
        vm.prank(owner);
        wallet.cancelEscalation(cancelId);
        assertEq(
            uint256(escalationManager.statusOf(cancelId)),
            uint256(IEscalationManager.Status.CANCELLED)
        );
        vm.expectRevert(EscalationNotPending.selector);
        vm.prank(councilOne);
        escalationManager.approve(cancelId);

        vm.prank(owner);
        wallet.freeze(bytes("local safety stop"));
        assertTrue(wallet.frozen());
        vm.expectRevert(FrozenWallet.selector);
        vm.prank(agent);
        wallet.executeUSDC(vendor, USDC_1, bytes("frozen"));
        vm.prank(owner);
        wallet.unfreeze();
        assertFalse(wallet.frozen());

        vm.prank(owner);
        wallet.withdrawUSDC(recovery, 7 * USDC_1);
        assertEq(token.balanceOf(recovery), 7 * USDC_1);
        assertEq(token.balanceOf(address(wallet)), 0);
        assertEq(wallet.dailySpent(), 8 * USDC_1);
        assertEq(wallet.monthlySpent(), 8 * USDC_1);
    }

    function _createFromDeployedFactory(string memory label)
        private
        returns (GuardedWallet wallet)
    {
        address walletAddress = WalletFactory(FACTORY).createWallet(
            owner, label, _policy(), _signers(), _council(), 2, 1 hours
        );
        wallet = GuardedWallet(walletAddress);
        vm.prank(owner);
        wallet.addVendor(
            vendor, uint8(RestraintCategory.API), 0, keccak256(bytes("fork-local-vendor"))
        );
    }

    function _createWithToken(address token) private returns (GuardedWallet wallet) {
        wallet = new GuardedWallet(
            owner,
            token,
            IPolicyEngine(POLICY_ENGINE),
            IEscalationManager(ESCALATION_MANAGER),
            IAnomalyOracle(ANOMALY_ORACLE),
            IVendorRegistry(VENDOR_REGISTRY),
            _policy(),
            _signers(),
            _council(),
            2,
            1 hours
        );
        vm.prank(owner);
        wallet.addVendor(
            vendor, uint8(RestraintCategory.API), 0, keccak256(bytes("fork-local-vendor"))
        );
    }

    function _hold(GuardedWallet wallet, uint256 amount, uint256 nonce, string memory reason)
        private
        returns (bytes32 id)
    {
        uint256 timestamp = block.timestamp;
        vm.prank(agent);
        wallet.executeUSDC(vendor, amount, bytes(reason));
        id = keccak256(abi.encode(address(wallet), vendor, amount, nonce, timestamp));
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

    function _signers() private view returns (address[] memory signers) {
        signers = new address[](1);
        signers[0] = agent;
    }

    function _council() private view returns (address[] memory council) {
        council = new address[](2);
        council[0] = councilOne;
        council[1] = councilTwo;
    }
}
