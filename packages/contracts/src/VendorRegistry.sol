// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IVendorRegistry } from "./interfaces/IVendorRegistry.sol";
import { InvalidCategory, ZeroAddress } from "./libraries/Errors.sol";
import { Events } from "./libraries/Events.sol";
import { RestraintCategory } from "./libraries/PolicyTypes.sol";

/// @notice Stores per-wallet vendor allowlists, blocklists, categories, and caps.
contract VendorRegistry is IVendorRegistry {
    mapping(address wallet => mapping(address vendor => Vendor vendorData)) private _vendors;

    /// @inheritdoc IVendorRegistry
    function addVendor(address vendor, uint8 category, uint256 perVendorCap, bytes32 metadataHash)
        external
    {
        _addVendor(msg.sender, vendor, category, perVendorCap, metadataHash);
    }

    /// @inheritdoc IVendorRegistry
    function blockVendor(address vendor) external {
        if (vendor == address(0)) {
            revert ZeroAddress();
        }

        Vendor storage vendorData = _vendors[msg.sender][vendor];
        vendorData.allowed = false;
        vendorData.blocked = true;
        emit Events.VendorBlocked(msg.sender, vendor);
    }

    /// @inheritdoc IVendorRegistry
    function removeVendor(address vendor) external {
        if (vendor == address(0)) {
            revert ZeroAddress();
        }

        delete _vendors[msg.sender][vendor];
        emit Events.VendorRemoved(msg.sender, vendor);
    }

    /// @inheritdoc IVendorRegistry
    function isAllowed(address vendor) external view returns (bool) {
        return isAllowedFor(msg.sender, vendor);
    }

    /// @inheritdoc IVendorRegistry
    function isBlocked(address vendor) external view returns (bool) {
        return isBlockedFor(msg.sender, vendor);
    }

    /// @inheritdoc IVendorRegistry
    function getVendor(address vendor) external view returns (Vendor memory vendorData) {
        return getVendorFor(msg.sender, vendor);
    }

    /// @inheritdoc IVendorRegistry
    function isAllowedFor(address wallet, address vendor) public view returns (bool) {
        Vendor memory vendorData = _vendors[wallet][vendor];
        return vendorData.allowed && !vendorData.blocked;
    }

    /// @inheritdoc IVendorRegistry
    function isBlockedFor(address wallet, address vendor) public view returns (bool) {
        return _vendors[wallet][vendor].blocked;
    }

    /// @inheritdoc IVendorRegistry
    function getVendorFor(address wallet, address vendor)
        public
        view
        returns (Vendor memory vendorData)
    {
        return _vendors[wallet][vendor];
    }

    function _addVendor(
        address wallet,
        address vendor,
        uint8 category,
        uint256 perVendorCap,
        bytes32 metadataHash
    ) private {
        if (vendor == address(0)) {
            revert ZeroAddress();
        }

        if (category > uint8(type(RestraintCategory).max)) {
            revert InvalidCategory();
        }

        _vendors[wallet][vendor] = Vendor({
            allowed: true,
            blocked: false,
            category: category,
            perVendorCap: perVendorCap,
            metadataHash: metadataHash
        });

        emit Events.VendorAdded(wallet, vendor, category, perVendorCap, metadataHash);
    }
}
