// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { DeployArcBase } from "./DeployArcBase.s.sol";

/// @notice Deploys Arcanum protocol modules to Arc Mainnet.
/// @dev Nothing about mainnet is hardcoded. Circle publishes the mainnet chain id and USDC
///      address at launch, so both are required environment values; the shared routine
///      reverts when either is missing or does not match the connected chain.
contract DeployArcMainnet is DeployArcBase {
    function run() external {
        _deploy(
            Network({
                name: "arc-mainnet",
                chainId: vm.envUint("ARC_MAINNET_CHAIN_ID"),
                usdc: vm.envAddress("ARC_MAINNET_USDC_ADDRESS"),
                manifestPath: "deployments/arc-mainnet.json"
            })
        );
    }
}
