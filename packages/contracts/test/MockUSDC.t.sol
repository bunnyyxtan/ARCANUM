// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { MockUSDC } from "../src/mocks/MockUSDC.sol";

contract MockUSDCTest {
    function testDeployMintAndTransfer() external {
        MockUSDC token = new MockUSDC();
        address recipient = address(0xBEEF);

        token.mint(address(this), 1_000e6);
        bool transferred = token.transfer(recipient, 250e6);

        require(transferred, "transfer failed");
        require(token.balanceOf(address(this)) == 750e6, "sender balance mismatch");
        require(token.balanceOf(recipient) == 250e6, "recipient balance mismatch");
    }
}
