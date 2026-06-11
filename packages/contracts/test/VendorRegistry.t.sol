// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { ArcanumTestBase } from "./ArcanumTestBase.sol";
import { InvalidCategory, ZeroAddress } from "../src/libraries/Errors.sol";
import { RestraintCategory } from "../src/libraries/PolicyTypes.sol";

contract VendorRegistryTest is ArcanumTestBase {
    address private namespace = address(0xCAFE);
    address private vendor = address(0xA11);

    function setUp() public {
        setUpProtocol();
    }

    function test_addVendorAllowsInNamespace() public {
        vm.prank(namespace);
        vendorRegistry.addVendor(
            vendor, uint8(RestraintCategory.API), 25 * USDC_1, keccak256(bytes("api"))
        );

        assertTrue(vendorRegistry.isAllowedFor(namespace, vendor));
        assertFalse(vendorRegistry.isAllowedFor(address(0xB0B), vendor));
        assertEq(vendorRegistry.getVendorFor(namespace, vendor).perVendorCap, 25 * USDC_1);
    }

    function test_directNamespaceViewsUseCaller() public {
        bytes32 metadataHash = keccak256(bytes("caller namespace"));

        vm.prank(namespace);
        vendorRegistry.addVendor(vendor, uint8(RestraintCategory.API), 25 * USDC_1, metadataHash);

        vm.startPrank(namespace);
        assertTrue(vendorRegistry.isAllowed(vendor));
        assertFalse(vendorRegistry.isBlocked(vendor));
        assertEq(vendorRegistry.getVendor(vendor).metadataHash, metadataHash);
        vm.stopPrank();
    }

    function test_blockVendorOverridesAllowed() public {
        vm.startPrank(namespace);
        vendorRegistry.addVendor(vendor, uint8(RestraintCategory.DATA), 0, keccak256(bytes("data")));
        vendorRegistry.blockVendor(vendor);
        vm.stopPrank();

        assertFalse(vendorRegistry.isAllowedFor(namespace, vendor));
        assertTrue(vendorRegistry.isBlockedFor(namespace, vendor));
    }

    function test_removeVendorClearsState() public {
        vm.startPrank(namespace);
        vendorRegistry.addVendor(
            vendor, uint8(RestraintCategory.OTHER), 0, keccak256(bytes("other"))
        );
        vendorRegistry.removeVendor(vendor);
        vm.stopPrank();

        assertFalse(vendorRegistry.isAllowedFor(namespace, vendor));
        assertFalse(vendorRegistry.isBlockedFor(namespace, vendor));
    }

    function test_invalidCategoryReverts() public {
        vm.expectRevert(InvalidCategory.selector);
        vm.prank(namespace);
        vendorRegistry.addVendor(vendor, 99, 0, keccak256(bytes("bad")));
    }

    function test_zeroVendorReverts() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(namespace);
        vendorRegistry.blockVendor(address(0));
    }

    function test_zeroVendorRevertsOnAddAndRemove() public {
        vm.expectRevert(ZeroAddress.selector);
        vm.prank(namespace);
        vendorRegistry.addVendor(address(0), uint8(RestraintCategory.API), 0, bytes32(0));

        vm.expectRevert(ZeroAddress.selector);
        vm.prank(namespace);
        vendorRegistry.removeVendor(address(0));
    }
}
