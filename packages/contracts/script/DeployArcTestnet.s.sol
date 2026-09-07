// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import { DeployArcBase } from "./DeployArcBase.s.sol";

/// @notice Deploys Arcanum protocol modules to Arc Testnet.
contract DeployArcTestnet is DeployArcBase {
    uint256 internal constant ARC_TESTNET_CHAIN_ID = 5042002;
    address internal constant ARC_TESTNET_USDC = 0x3600000000000000000000000000000000000000;

    function run() external {
        _deploy(
            Network({
                name: "arc-testnet",
                chainId: ARC_TESTNET_CHAIN_ID,
                usdc: ARC_TESTNET_USDC,
                manifestPath: "deployments/arc-testnet.json"
            })
        );
    }
}
