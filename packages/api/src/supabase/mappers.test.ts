import { describe, expect, it } from "vitest";

import {
  vendorCapBaseUnitsFromRow,
  vendorFromRow,
  vendorStatusFromString,
  walletFromGovernedWalletRow,
} from "./mappers";

const OWNER = "0x1111111111111111111111111111111111111111";
process.env.ARCANUM_DEMO_OWNER_WALLET = OWNER;
const WORKSPACE_WALLET = walletFromGovernedWalletRow({
  id: "wallet-1",
  organization_id: "org-1",
  wallet_address: OWNER,
  owner_address: OWNER,
  label: "Workspace wallet",
  created_at: "2026-09-12T00:00:00.000Z",
  status: "active",
});

describe("vendor cap read-model mapping", () => {
  it("keeps the explicit base-unit value exact through the DTO", () => {
    const row = {
      id: "vendor-1",
      vendor_address: "0x2222222222222222222222222222222222222222",
      per_vendor_cap_base_units: "123456789012345678901234",
      status: "allowed",
    };

    expect(vendorCapBaseUnitsFromRow(row)).toBe("123456789012345678901234");
    expect(vendorFromRow(row, WORKSPACE_WALLET).perVendorCap).toBe("123456789012345678901234");
  });

  it("models JSON.parse precision loss for numeric wire values and text preservation", () => {
    const maxUint256 =
      "115792089237316195423570985008687907853269984665640564039457584007913129639935";
    const numericWire = JSON.parse(`{"per_vendor_cap_base_units":${maxUint256}}`) as Record<
      string,
      unknown
    >;
    const textWire = JSON.parse(`{"per_vendor_cap_base_units":"${maxUint256}"}`) as Record<
      string,
      unknown
    >;

    expect(typeof numericWire.per_vendor_cap_base_units).toBe("number");
    expect(vendorCapBaseUnitsFromRow(numericWire)).toBeNull();
    expect(vendorCapBaseUnitsFromRow(textWire)).toBe(maxUint256);
  });

  it("does not turn a missing mirror value into an unlimited cap", () => {
    expect(vendorCapBaseUnitsFromRow({})).toBeNull();
    expect(vendorFromRow({ vendor_address: OWNER }, WORKSPACE_WALLET).perVendorCap).toBeNull();
  });

  it("preserves removed status as a historical state", () => {
    expect(vendorStatusFromString("REMOVED")).toBe("removed");
    expect(
      vendorFromRow(
        {
          vendor_address: OWNER,
          status: "removed",
          per_vendor_cap_base_units: "0",
        },
        WORKSPACE_WALLET,
      ).status,
    ).toBe("removed");
  });
});
