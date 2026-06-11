// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Per-wallet vendor allowlist and blocklist registry.
interface IVendorRegistry {
    struct Vendor {
        bool allowed;
        bool blocked;
        uint8 category;
        uint256 perVendorCap;
        bytes32 metadataHash;
    }

    /// @notice Adds or updates a vendor in the caller wallet namespace.
    function addVendor(address vendor, uint8 category, uint256 perVendorCap, bytes32 metadataHash)
        external;

    /// @notice Blocks a vendor in the caller wallet namespace.
    function blockVendor(address vendor) external;

    /// @notice Removes a vendor from the caller wallet namespace.
    function removeVendor(address vendor) external;

    /// @notice Returns whether a vendor is allowed in the caller namespace.
    function isAllowed(address vendor) external view returns (bool);

    /// @notice Returns whether a vendor is blocked in the caller namespace.
    function isBlocked(address vendor) external view returns (bool);

    /// @notice Returns vendor metadata in the caller namespace.
    function getVendor(address vendor) external view returns (Vendor memory vendorData);

    /// @notice Returns whether a vendor is allowed for a wallet namespace.
    function isAllowedFor(address wallet, address vendor) external view returns (bool);

    /// @notice Returns whether a vendor is blocked for a wallet namespace.
    function isBlockedFor(address wallet, address vendor) external view returns (bool);

    /// @notice Returns vendor metadata for a wallet namespace.
    function getVendorFor(address wallet, address vendor)
        external
        view
        returns (Vendor memory vendorData);
}
