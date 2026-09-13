import type { Vendor, Wallet } from "@arcanum/db/schema";
import { decimalUsdcToBaseUnits } from "@arcanum/shared";
import type { ApiContext } from "../context";
import {
  type SupabaseWriteResult,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { stringField } from "./fields";
import { type SupabaseVendor, vendorFromRow } from "./mappers";
import { walletForRow } from "./scope";
import { selectRows } from "./transport";
import { readSupabaseWallets } from "./wallets";

// Vendor registers are intentionally bounded to keep wallet reads predictable.
const MAX_VENDORS = 1_000;

export async function readSupabaseVendors(
  ctx: ApiContext,
  wallet?: Wallet | null,
  cursor?: { createdAt: string; id: string },
) {
  if (wallet) {
    const rows = await selectRows(ctx, "vendors", {
      filters: { wallet_address: wallet.address.toLowerCase() },
      order: "created_at.desc,id.desc",
      limit: MAX_VENDORS,
      before: cursor,
    });
    return rows.map((row) => vendorFromRow(row, wallet));
  }

  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }

  const rows = await selectRows(ctx, "vendors", {
    inFilters: {
      wallet_address: wallets.map((item) => item.address.toLowerCase()),
    },
    order: "created_at.desc,id.desc",
    limit: MAX_VENDORS,
    before: cursor,
  });
  return rows.flatMap((row) => {
    const rowWallet = walletForRow(row, wallets);
    return rowWallet ? [vendorFromRow(row, rowWallet)] : [];
  });
}

export async function writeSupabaseVendor(
  ctx: ApiContext,
  input: {
    walletId?: string;
    name: string;
    address: `0x${string}`;
    category: string;
    perVendorCap: string;
    kycStatus: "public" | "arcanevm";
    status?: Vendor["status"];
  },
  wallet: Wallet,
): Promise<
  SupabaseWriteResult<SupabaseVendor & { name: string; kycStatus: "public" | "arcanevm" }>
> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("vendor");
  }

  const now = new Date().toISOString();
  const row = {
    organization_id: wallet.orgId,
    wallet_address: wallet.address.toLowerCase(),
    vendor_address: input.address.toLowerCase(),
    name: input.name,
    category: input.category,
    status: input.status ?? "allowed",
    confidential: input.kycStatus === "arcanevm",
    data_source: "live",
    source: "supabase",
    // `perVendorCap` arrives from the chain as display-USDC text. Convert
    // exactly once to the explicitly named six-decimal base-unit mirror.
    per_vendor_cap_base_units: decimalUsdcToBaseUnits(input.perVendorCap).toString(),
    updated_at: now,
  };

  try {
    const [existing] = await client.selectRows("vendors", {
      filters: {
        wallet_address: wallet.address.toLowerCase(),
        vendor_address: input.address.toLowerCase(),
      },
      limit: 1,
    });
    const existingId = stringField(existing, ["id"], "");
    const [written] = existingId
      ? await client.patchRows("vendors", row, { id: existingId })
      : await client.upsertRows(
          "vendors",
          [{ ...row, created_at: now }],
          "wallet_address,vendor_address",
        );
    return {
      ok: true,
      data: vendorFromRow(written ?? row, wallet),
    };
  } catch (error) {
    warnSupabase("vendor.write", error);
    return unavailableWrite("vendor", error);
  }
}
