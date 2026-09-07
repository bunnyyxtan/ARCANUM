import type { Vendor, Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import {
  type SupabaseWriteResult,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { stringField } from "./fields";
import { vendorFromRow } from "./mappers";
import { orgScopedRowsForWallets } from "./scope";
import { selectRows } from "./transport";
import { readSupabaseWallets } from "./wallets";

// Vendor registers are intentionally bounded to keep workspace reads predictable.
const MAX_VENDORS_PER_ORG = 1_000;

export async function readSupabaseVendors(
  ctx: ApiContext,
  wallet?: Wallet | null,
  cursor?: { createdAt: string; id: string },
) {
  if (wallet) {
    const rows = await selectRows(ctx, "vendors", {
      filters: { organization_id: wallet.orgId },
      order: "created_at.desc,id.desc",
      limit: MAX_VENDORS_PER_ORG,
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
      organization_id: Array.from(new Set(wallets.map((item) => item.orgId))).filter(Boolean),
    },
    order: "created_at.desc,id.desc",
    limit: MAX_VENDORS_PER_ORG,
    before: cursor,
  });
  return orgScopedRowsForWallets(rows, wallets).map(({ row, wallet }) =>
    vendorFromRow(row, wallet),
  );
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
): Promise<SupabaseWriteResult<Vendor & { name: string; kycStatus: "public" | "arcanevm" }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("vendor");
  }

  const now = new Date().toISOString();
  const row = {
    organization_id: wallet.orgId,
    vendor_address: input.address.toLowerCase(),
    name: input.name,
    category: input.category,
    status: input.status ?? "allowed",
    confidential: input.kycStatus === "arcanevm",
    data_source: "live",
    source: "supabase",
    updated_at: now,
  };

  try {
    const [existing] = await client.selectRows("vendors", {
      filters: {
        organization_id: wallet.orgId,
        vendor_address: input.address.toLowerCase(),
      },
      limit: 1,
    });
    const existingId = stringField(existing, ["id"], "");
    const [written] = existingId
      ? await client.patchRows("vendors", row, { id: existingId })
      : await client.upsertRows("vendors", [{ ...row, created_at: now }]);
    return {
      ok: true,
      data: vendorFromRow(written ?? row, wallet),
    };
  } catch (error) {
    warnSupabase("vendor.write", error);
    return unavailableWrite("vendor", error);
  }
}
