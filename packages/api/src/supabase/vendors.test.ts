import { describe, expect, it } from "vitest";

import type { Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import { readSupabaseVendors, writeSupabaseVendor } from "./vendors";

const OWNER = "0x1111111111111111111111111111111111111111";
const VENDOR = "0x2222222222222222222222222222222222222222";

describe("vendor cap write/read projection", () => {
  it("writes display USDC as exact six-decimal base-unit text", async () => {
    let written: Record<string, unknown> | undefined;
    const supabase = {
      configured: true,
      selectRows: async () => [],
      insertRows: async () => [],
      patchRows: async () => [],
      upsertRows: async (_table: string, rows: Record<string, unknown>[]) => {
        written = rows[0];
        return rows;
      },
      callFunction: async () => null,
    };
    const result = await writeSupabaseVendor(
      {
        supabase,
      } as unknown as ApiContext,
      {
        address: VENDOR,
        category: "api",
        kycStatus: "arcanevm",
        name: "Exact vendor",
        perVendorCap: "123.456789",
      },
      {
        id: "wallet-1",
        orgId: "org-1",
        address: OWNER,
        ownerAddress: OWNER,
      } as unknown as Wallet,
    );

    expect(written?.per_vendor_cap_base_units).toBe("123456789");
    expect(written?.wallet_address).toBe(OWNER);
    expect(result.ok && result.data.perVendorCap).toBe("123456789");
  });

  it("reads and updates vendor terms by wallet identity, never organization", async () => {
    const walletA = {
      id: "wallet-a",
      orgId: "former-org",
      address: OWNER,
      ownerAddress: OWNER,
    } as unknown as Wallet;
    const walletB = {
      id: "wallet-b",
      orgId: "former-org",
      address: "0x3333333333333333333333333333333333333333",
      ownerAddress: OWNER,
    } as unknown as Wallet;
    const rows = [
      {
        id: "vendor-a",
        organization_id: "former-org",
        wallet_address: walletA.address,
        vendor_address: VENDOR,
        name: "A",
        category: "api",
        per_vendor_cap_base_units: "1",
      },
      {
        id: "vendor-b",
        organization_id: "former-org",
        wallet_address: walletB.address,
        vendor_address: VENDOR,
        name: "B",
        category: "compute",
        per_vendor_cap_base_units: "2",
      },
    ];
    let patchedId = "";
    const supabase = {
      configured: true,
      selectRows: async (table: string, options: { filters?: Record<string, string> }) =>
        table === "vendors"
          ? rows.filter(
              (row) =>
                !options.filters?.wallet_address ||
                row.wallet_address === options.filters.wallet_address,
            )
          : [],
      insertRows: async () => [],
      patchRows: async (
        _table: string,
        patch: Record<string, unknown>,
        filters: { id: string },
      ) => {
        patchedId = filters.id;
        return [{ ...rows.find((row) => row.id === filters.id), ...patch }];
      },
      upsertRows: async () => [],
      callFunction: async () => null,
    };
    const ctx = { supabase } as unknown as ApiContext;
    const [forA, forB] = await Promise.all([
      readSupabaseVendors(ctx, walletA),
      readSupabaseVendors(ctx, walletB),
    ]);
    expect(forA.map((vendor) => vendor.name)).toEqual(["A"]);
    expect(forB.map((vendor) => vendor.name)).toEqual(["B"]);

    await writeSupabaseVendor(
      ctx,
      {
        address: VENDOR,
        category: "data",
        kycStatus: "public",
        name: "A updated",
        perVendorCap: "3",
      },
      walletA,
    );
    expect(patchedId).toBe("vendor-a");
  });
});
