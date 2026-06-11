import { createHash } from "node:crypto";

import { FALLBACK_TENANT_ID, defaultTenantId } from "@arcanum/db";
import type {
  Agent,
  Anomaly,
  Escalation,
  Policy,
  Transfer,
  Vendor,
  Wallet,
} from "@arcanum/db/schema";
import { ARC_TESTNET_CHAIN_ID, isDemoOwnerWallet } from "@arcanum/shared";

import type { ApiContext } from "./context";
import { fallbackAgents, fallbackOrgId, fallbackWallets } from "./mock-fallback";

type SupabaseRow = Record<string, unknown>;

type SupabaseRequestOptions = {
  filters?: Record<string, string | number | boolean | null | undefined>;
  limit?: number;
  order?: string;
};

type SupabaseWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "unavailable"; message: string };

export type SupabaseRuntimeHealth = {
  api: {
    status: "available" | "unavailable" | "not_configured";
    urlConfigured: boolean;
    anonKeyConfigured: boolean;
    error: string | null;
  };
  serviceRole: {
    status: "configured" | "missing";
  };
  readModel: {
    status: "available" | "unavailable" | "not_configured";
    sampleRows: number;
    error: string | null;
  };
  indexerCheckpoint: {
    status: "available" | "empty" | "unavailable" | "not_configured";
    lastIndexedBlock: number | null;
    lastIndexedAt: string | null;
    error: string | null;
  };
};

export type SupabasePublicWalletProfile = {
  walletAddress: string;
  label: string;
  postureScore: number | null;
  state: string;
  spend: string | null;
  threatsBlocked: number | null;
  governedDays: number | null;
  dataSource: "supabase" | "demo_seed" | "local_fallback" | "none";
};

export type SupabaseCreatedWalletInput = {
  walletAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  label: string;
  deployTxHash: `0x${string}`;
  chainId: number;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  requireAllowlist: boolean;
  signers: `0x${string}`[];
  council: `0x${string}`[];
  quorum: number;
};

export type SupabaseServiceRoleClient = {
  configured: boolean;
  selectRows: (table: string, options?: SupabaseRequestOptions) => Promise<SupabaseRow[]>;
  upsertRows: (table: string, rows: SupabaseRow[], onConflict?: string) => Promise<SupabaseRow[]>;
  patchRows: (
    table: string,
    patch: SupabaseRow,
    filters: Record<string, string | number | boolean>,
  ) => Promise<SupabaseRow[]>;
};

const warningLabels = new Set<string>();

// Service-role access belongs only in server/API code. Never import this helper from client components.
export function createSupabaseServiceRoleClient(): SupabaseServiceRoleClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    warnSupabase("service-role.env", "Supabase service-role env is not configured.");
    return null;
  }

  const baseUrl = url.replace(/\/+$/, "");
  const adminKey = serviceRoleKey;

  async function request(
    method: "GET" | "POST" | "PATCH",
    table: string,
    options?: SupabaseRequestOptions & {
      body?: SupabaseRow | SupabaseRow[];
      onConflict?: string;
    },
  ) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${table}`);
    endpoint.searchParams.set("select", "*");

    if (options?.order) {
      endpoint.searchParams.set("order", options.order);
    }

    if (options?.limit) {
      endpoint.searchParams.set("limit", String(options.limit));
    }

    for (const [key, value] of Object.entries(options?.filters ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        endpoint.searchParams.set(key, `eq.${String(value)}`);
      }
    }

    if (options?.onConflict) {
      endpoint.searchParams.set("on_conflict", options.onConflict);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
        Prefer:
          method === "GET"
            ? "return=representation"
            : "return=representation,resolution=merge-duplicates",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `${table} ${method} failed with ${response.status}: ${safeSupabaseError(body)}`,
      );
    }

    return (await response.json()) as SupabaseRow[];
  }

  return {
    configured: true,
    selectRows: (table, options) => request("GET", table, options),
    upsertRows: (table, rows, onConflict) => request("POST", table, { body: rows, onConflict }),
    patchRows: (table, patch, filters) => request("PATCH", table, { body: patch, filters }),
  };
}

export async function syncSupabaseAuthSession(user: {
  walletAddress: string;
  tenantId: string;
  role: string;
}) {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return { synced: false as const, reason: "unconfigured" as const };
  }

  const walletAddress = user.walletAddress.toLowerCase();
  const demoSession = isDemoOwnerWallet(walletAddress, process.env.ARCANUM_DEMO_OWNER_WALLET);
  const orgSlug = demoSession
    ? (process.env.ARCANUM_DEMO_ORG_SLUG ?? "demo-workspace")
    : `wallet-${walletAddress.slice(2, 10)}`;
  const orgName = demoSession
    ? (process.env.ARCANUM_DEMO_ORG_NAME ?? "Demo Workspace")
    : `${shortAddress(walletAddress)} Workspace`;

  try {
    const [profile] = await client.upsertRows(
      "profiles",
      [
        {
          wallet_address: walletAddress,
          display_name: shortAddress(walletAddress),
          role: user.role,
        },
      ],
      "wallet_address",
    );

    const [organization] = await client.upsertRows(
      "organizations",
      [
        {
          slug: orgSlug,
          name: orgName,
          owner_wallet: walletAddress,
          chain_id: ARC_TESTNET_CHAIN_ID,
          data_source: "supabase",
        },
      ],
      "slug",
    );

    await client.upsertRows(
      "organization_members",
      [
        {
          organization_id: stringField(organization, ["id"], orgSlug),
          profile_id: stringField(profile, ["id"], walletAddress),
          role: user.role,
        },
      ],
      "organization_id,profile_id",
    );

    return { synced: true as const };
  } catch (error) {
    warnSupabase("auth.sync", error);
    return { synced: false as const, reason: "unavailable" as const };
  }
}

export async function readSupabaseWallets(ctx: ApiContext): Promise<Wallet[]> {
  const owner = ownerScope(ctx);
  if (!owner) {
    return [];
  }

  const rows = await selectRows(ctx, "governed_wallets", {
    filters: { owner_address: owner },
    order: "created_at.desc",
  });
  if (rows.length === 0) {
    return [];
  }

  return scopedRows(ctx, rows).map(walletFromGovernedWalletRow);
}

export async function readSupabaseWalletByLooseId(ctx: ApiContext, looseWalletId: string) {
  const normalized = looseWalletId.toLowerCase();
  const wallets = await readSupabaseWallets(ctx);
  return (
    wallets.find(
      (wallet) =>
        wallet.id === looseWalletId ||
        wallet.address.toLowerCase() === normalized ||
        wallet.label.toLowerCase() === normalized,
    ) ?? null
  );
}

export async function readSupabaseAgents(ctx: ApiContext, status?: Agent["status"]) {
  const wallets = await readSupabaseWallets(ctx);
  const rows = wallets.map((wallet) => agentFromWallet(wallet));
  return status ? rows.filter((agent) => agent.status === status) : rows;
}

export async function readSupabaseAgentByLooseId(ctx: ApiContext, looseWalletId: string) {
  const normalized = looseWalletId.toLowerCase();
  const wallet = await readSupabaseWalletByLooseId(ctx, looseWalletId);
  if (wallet) {
    return agentFromWallet(wallet);
  }

  const agents = await readSupabaseAgents(ctx);
  return (
    agents.find(
      (agent) =>
        agent.id === looseWalletId ||
        agent.walletId === looseWalletId ||
        agent.signerAddress.toLowerCase() === normalized,
    ) ?? null
  );
}

export async function readSupabasePolicy(ctx: ApiContext, wallet: Wallet | null) {
  if (!wallet) {
    return null;
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { wallet_address: wallet.address.toLowerCase() },
    order: "updated_at.desc",
    limit: 1,
  });

  return rows[0] ? policyFromDoctrineRow(rows[0], wallet) : null;
}

export async function readSupabasePolicies(ctx: ApiContext, wallet: Wallet | null) {
  if (!wallet) {
    return [];
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { wallet_address: wallet.address.toLowerCase() },
    order: "updated_at.desc",
  });

  return rows.map((row) => policyFromDoctrineRow(row, wallet));
}

export async function readSupabaseVendors(ctx: ApiContext, wallet?: Wallet | null) {
  const filters = wallet ? { wallet_address: wallet.address.toLowerCase() } : undefined;
  const rows = await selectRows(ctx, "vendors", { filters, order: "created_at.desc" });
  const visibleRows = wallet ? rows : scopedRows(ctx, rows);
  return visibleRows.map((row) => vendorFromRow(row, wallet));
}

export async function writeSupabaseVendor(
  ctx: ApiContext,
  input: {
    walletId?: string;
    name: string;
    address: `0x${string}`;
    category: string;
    perVendorCap: number;
    kycStatus: "public" | "arcanevm";
  },
  wallet: Wallet,
): Promise<SupabaseWriteResult<Vendor & { name: string; kycStatus: "public" | "arcanevm" }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("vendor");
  }

  const row = {
    wallet_address: wallet.address.toLowerCase(),
    owner_address: wallet.ownerAddress.toLowerCase(),
    address: input.address.toLowerCase(),
    name: input.name,
    category: input.category,
    status: "allowed",
    per_vendor_cap: Math.round(input.perVendorCap * 1_000_000),
    kyc_status: input.kycStatus,
    data_source: "supabase",
    added_by: ctx.session?.walletAddress ?? wallet.ownerAddress,
    created_at: new Date().toISOString(),
  };

  try {
    const [written] = await client.upsertRows("vendors", [row], "wallet_address,address");
    return {
      ok: true,
      data: vendorFromRow(written ?? row, wallet),
    };
  } catch (error) {
    warnSupabase("vendor.write", error);
    return unavailableWrite("vendor", error);
  }
}

export async function readSupabaseTransfers(ctx: ApiContext) {
  const rows = await selectFirstAvailableTable(ctx, ["ledger_events", "transfers"], {
    order: "block_number.desc",
  });
  const wallets = await readSupabaseWallets(ctx);
  return rowsForWallets(rows, wallets).map((row) => transferFromRow(row, wallets));
}

export async function readSupabaseEscalations(ctx: ApiContext, status?: Escalation["status"]) {
  const rows = await selectRows(ctx, "escalations", {
    order: "expires_at.asc",
  });
  const wallets = await readSupabaseWallets(ctx);
  const escalations = rowsForWallets(rows, wallets).map((row) => escalationFromRow(row, wallets));
  return status ? escalations.filter((item) => item.status === status) : escalations;
}

export async function readSupabaseEscalationByTxHash(ctx: ApiContext, txHash: string) {
  const rows = await selectRows(ctx, "escalations", {
    filters: { id: txHash },
    limit: 1,
  });
  const wallets = await readSupabaseWallets(ctx);
  const [row] = rowsForWallets(rows, wallets);
  return row ? escalationFromRow(row, wallets) : null;
}

export async function readSupabaseAnomalies(ctx: ApiContext) {
  const rows = await selectRows(ctx, "anomalies", { order: "sigma.desc" });
  const wallets = await readSupabaseWallets(ctx);
  return rowsForWallets(rows, wallets).map((row) => anomalyFromRow(row, wallets));
}

export async function recordSupabaseCreatedWallet(
  ctx: ApiContext,
  input: SupabaseCreatedWalletInput,
): Promise<SupabaseWriteResult<{ wallet: Wallet; agent: Agent }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("created wallet");
  }

  const walletAddress = input.walletAddress.toLowerCase();
  const ownerAddress = input.ownerAddress.toLowerCase();
  const now = new Date().toISOString();
  const walletRow = {
    wallet_address: walletAddress,
    owner_address: ownerAddress,
    label: input.label,
    deploy_tx_hash: input.deployTxHash.toLowerCase(),
    chain_id: input.chainId,
    status: "pending_indexer",
    indexer_status: "pending",
    data_source: "supabase",
    created_at: now,
    wallet_factory_address: process.env.NEXT_PUBLIC_WALLET_FACTORY,
  };
  const doctrineRow = {
    wallet_address: walletAddress,
    owner_address: ownerAddress,
    version: 1,
    max_spend_per_tx: input.perTxCap,
    max_spend_per_day: input.dailyCap,
    max_spend_per_month: input.monthlyCap,
    allowed_categories: 31,
    allowed_vendors: [],
    requires_quorum_above: input.escalationThreshold,
    require_allowlist: input.requireAllowlist,
    signers: input.signers.map((address) => address.toLowerCase()),
    escalation_council: input.council.map((address) => address.toLowerCase()),
    quorum: input.quorum,
    updated_by: ownerAddress,
    updated_at: now,
    data_source: "supabase",
  };
  const publicProfileRow = {
    wallet_address: walletAddress,
    label: input.label,
    posture_score: 78,
    status: "PENDING INDEXER",
    data_source: "supabase",
    deploy_tx_hash: input.deployTxHash.toLowerCase(),
    created_at: now,
  };

  try {
    const [writtenWallet] = await client.upsertRows(
      "governed_wallets",
      [walletRow],
      "wallet_address,chain_id",
    );
    await client.upsertRows("doctrines", [doctrineRow], "wallet_address,version");
    await client.upsertRows("public_wallet_profiles", [publicProfileRow], "wallet_address");

    const wallet = walletFromGovernedWalletRow(writtenWallet ?? walletRow);
    return { ok: true, data: { wallet, agent: agentFromWallet(wallet) } };
  } catch (error) {
    warnSupabase("created-wallet.write", error);
    return unavailableWrite("created wallet", error);
  }
}

export async function readSupabaseRuntimeHealth(ctx: ApiContext): Promise<SupabaseRuntimeHealth> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const base = {
    api: {
      status: "not_configured" as const,
      urlConfigured: Boolean(url),
      anonKeyConfigured: Boolean(anonKey),
      error: null,
    },
    serviceRole: {
      status: serviceRoleKey ? ("configured" as const) : ("missing" as const),
    },
  };

  if (!url) {
    return {
      ...base,
      api: { ...base.api, error: "NEXT_PUBLIC_SUPABASE_URL is missing." },
      readModel: {
        status: "not_configured",
        sampleRows: 0,
        error: "Supabase URL is missing.",
      },
      indexerCheckpoint: {
        status: "not_configured",
        lastIndexedBlock: null,
        lastIndexedAt: null,
        error: "Supabase URL is missing.",
      },
    };
  }

  if (!serviceRoleKey || !ctx.supabase) {
    return {
      ...base,
      readModel: {
        status: "not_configured",
        sampleRows: 0,
        error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
      },
      indexerCheckpoint: {
        status: "not_configured",
        lastIndexedBlock: null,
        lastIndexedAt: null,
        error: "SUPABASE_SERVICE_ROLE_KEY is missing.",
      },
    };
  }

  const client = ctx.supabase;
  const readModel = await safeHealthRead(() => client.selectRows("governed_wallets", { limit: 1 }));
  const checkpoint = await safeHealthRead(() =>
    client.selectRows("indexer_checkpoints", { limit: 1 }),
  );
  const readModelError = readModel.ok ? null : safeSupabaseError(readModel.error);
  const checkpointError = checkpoint.ok ? null : safeSupabaseError(checkpoint.error);
  const checkpointRow = checkpoint.ok ? checkpoint.data[0] : undefined;

  return {
    ...base,
    api: {
      ...base.api,
      status: readModel.ok || checkpoint.ok ? "available" : "unavailable",
      error: readModel.ok || checkpoint.ok ? null : (readModelError ?? checkpointError),
    },
    readModel: {
      status: readModel.ok ? "available" : "unavailable",
      sampleRows: readModel.ok ? readModel.data.length : 0,
      error: readModelError,
    },
    indexerCheckpoint: {
      status: checkpoint.ok ? (checkpointRow ? "available" : "empty") : "unavailable",
      lastIndexedBlock: checkpointRow ? checkpointBlock(checkpointRow) : null,
      lastIndexedAt: checkpointRow ? checkpointTime(checkpointRow) : null,
      error: checkpointError,
    },
  };
}

export async function readSupabasePublicWalletProfile(ctx: ApiContext, address: string) {
  const walletAddress = address.toLowerCase();
  const rows = await selectRows(ctx, "public_wallet_profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });

  if (rows[0]) {
    return publicProfileFromRow(rows[0], "supabase");
  }

  const wallet = await readSupabaseWalletByLooseId(ctx, address);
  if (!wallet) {
    return null;
  }

  return {
    walletAddress: wallet.address,
    label: wallet.label,
    postureScore: wallet.frozen ? 42 : 87,
    state: wallet.frozen ? "UNDER RESTRAINT" : "FORTIFIED",
    spend: null,
    threatsBlocked: wallet.frozen ? 63 : 12,
    governedDays: null,
    dataSource: "supabase",
  } satisfies SupabasePublicWalletProfile;
}

async function selectRows(ctx: ApiContext, table: string, options?: SupabaseRequestOptions) {
  const client = ctx.supabase;
  if (!client) {
    return [];
  }

  try {
    return await client.selectRows(table, options);
  } catch (error) {
    warnSupabase(`${table}.read`, error);
    return [];
  }
}

async function selectFirstAvailableTable(
  ctx: ApiContext,
  tables: string[],
  options?: SupabaseRequestOptions,
) {
  for (const table of tables) {
    const rows = await selectRows(ctx, table, options);
    if (rows.length > 0) {
      return rows;
    }
  }

  return [];
}

function scopedRows(ctx: ApiContext, rows: SupabaseRow[]) {
  const scope = ownerScope(ctx);
  if (!scope) {
    return [];
  }

  const filtered = rows.filter((row) => {
    const owner = stringField(row, ["owner_address", "owner_wallet", "wallet_owner"]);
    // Private read-model rows must be wallet-owned; rows without owner metadata fail closed.
    return Boolean(owner) && owner.toLowerCase() === scope;
  });

  return filtered;
}

function rowsForWallets(rows: SupabaseRow[], wallets: Wallet[]) {
  const walletAddresses = new Set(wallets.map((wallet) => wallet.address.toLowerCase()));
  if (walletAddresses.size === 0) {
    return [];
  }

  return rows.filter((row) => {
    const walletAddress = stringField(row, ["wallet_address"], "").toLowerCase();
    return Boolean(walletAddress) && walletAddresses.has(walletAddress);
  });
}

function ownerScope(ctx: ApiContext) {
  return ctx.session?.walletAddress.toLowerCase() ?? null;
}

function walletFromGovernedWalletRow(row: SupabaseRow): Wallet {
  const walletAddress = stringField(row, ["wallet_address", "address"], zeroWallet());
  const label = stringField(row, ["label", "name"], shortAddress(walletAddress));
  const status = stringField(row, ["status", "indexer_status"], "active").toLowerCase();

  return {
    id: stableUuid(`wallet:${walletAddress}`),
    tenantId: defaultTenantId(),
    orgId: stringField(row, ["organization_id", "org_id"], fallbackOrgId),
    address: walletAddress.toLowerCase(),
    label,
    ownerAddress: stringField(row, ["owner_address", "owner_wallet"], ownerScopeFromEnv()),
    createdBlock: numberField(row, ["created_block", "block_number"], 0),
    createdAt: dateField(row, ["created_at", "deployed_at"]),
    factoryAddress: stringField(
      row,
      ["wallet_factory_address"],
      process.env.NEXT_PUBLIC_WALLET_FACTORY ?? zeroWallet(),
    ),
    frozen: status.includes("frozen") || status.includes("restraint"),
    policyVersion: numberField(row, ["policy_version", "doctrine_version"], 1),
  };
}

function agentFromWallet(wallet: Wallet): Agent {
  const label = wallet.label || shortAddress(wallet.address);
  return {
    id: stableUuid(`agent:${wallet.address}`),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    signerAddress: wallet.ownerAddress,
    label,
    type: agentTypeFromLabel(label),
    createdAt: wallet.createdAt,
    lastSeenAt: wallet.createdAt,
    status: wallet.frozen ? "frozen" : "active",
  };
}

function policyFromDoctrineRow(row: SupabaseRow, wallet: Wallet): Policy {
  return {
    id: stableUuid(`policy:${wallet.address}:${stringField(row, ["version"], "1")}`),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    version: numberField(row, ["version", "policy_version"], wallet.policyVersion),
    perTxCap: moneyBaseUnits(row, ["per_tx_cap", "max_spend_per_tx"]),
    daily24hCap: moneyBaseUnits(row, ["daily_24h_cap", "daily_cap", "max_spend_per_day"]),
    monthlyRollingCap: moneyBaseUnits(row, [
      "monthly_rolling_cap",
      "monthly_cap",
      "max_spend_per_month",
    ]),
    allowedCategories: numberField(row, ["allowed_categories"], 31),
    escalationThreshold: moneyBaseUnits(row, [
      "escalation_threshold",
      "requires_quorum_above",
      "escalation_amount",
    ]),
    requireAllowlist: booleanField(row, ["require_allowlist"], true),
    updatedAt: dateField(row, ["updated_at"]),
    updatedBy: stringField(row, ["updated_by"], wallet.ownerAddress),
  };
}

function vendorFromRow(
  row: SupabaseRow,
  wallet?: Wallet | null,
): Vendor & { name: string; kycStatus: "public" | "arcanevm"; walletAddress: string } {
  const vendorAddress = stringField(row, ["address"], zeroWallet());
  const walletAddress = stringField(
    row,
    ["wallet_address"],
    wallet?.address ?? primaryFallbackWallet().address,
  );
  const walletId = wallet?.id ?? stableUuid(`wallet:${walletAddress}`);

  return {
    id: stringField(row, ["id"], stableUuid(`vendor:${walletAddress}:${vendorAddress}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId,
    address: vendorAddress.toLowerCase(),
    category: stringField(row, ["category"], "other"),
    status: vendorStatusFromString(stringField(row, ["status"], "allowed")),
    perVendorCap: moneyBaseUnits(row, ["per_vendor_cap", "cap"]),
    metadataHash: stringField(row, ["metadata_hash"], stableHash(`vendor:${vendorAddress}`)),
    addedAt: dateField(row, ["created_at"]),
    addedBy: stringField(row, ["added_by"], ownerScopeFromEnv()),
    name: stringField(row, ["name", "label"], shortAddress(vendorAddress)),
    kycStatus: stringField(row, ["kyc_status"], "public") === "arcanevm" ? "arcanevm" : "public",
    walletAddress,
  };
}

function transferFromRow(row: SupabaseRow, wallets: Wallet[]): Transfer {
  const walletAddress = stringField(row, ["wallet_address"], primaryFallbackWallet().address);
  const wallet = wallets.find((item) => item.address.toLowerCase() === walletAddress.toLowerCase());
  const txHash = stringField(
    row,
    ["tx_hash", "hash"],
    stableHash(`transfer:${JSON.stringify(row)}`),
  );

  return {
    id: stringField(row, ["id"], stableUuid(`transfer:${txHash}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    txHash,
    blockNumber: numberField(row, ["block_number"], 0),
    timestamp: dateField(row, ["timestamp", "created_at"]),
    toAddress: stringField(row, ["to_address", "counterparty_address"], zeroWallet()),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
    verdict: verdictFromString(stringField(row, ["verdict", "status"], "ALLOW")),
    reason: stringField(row, ["reason"], "indexed from Supabase"),
    vendorCategory: stringField(row, ["vendor_category", "category"], "other"),
    dailySpentAfter: moneyBaseUnits(row, ["daily_spent_after"], 0),
  };
}

function escalationFromRow(row: SupabaseRow, wallets: Wallet[]): Escalation {
  const walletAddress = stringField(row, ["wallet_address"], primaryFallbackWallet().address);
  const wallet = wallets.find((item) => item.address.toLowerCase() === walletAddress.toLowerCase());
  const id = stringField(row, ["id", "tx_hash"], stableHash(`escalation:${JSON.stringify(row)}`));

  return {
    id,
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    transferId: stringField(row, ["transfer_id"], null),
    toAddress: stringField(row, ["to_address", "counterparty_address"], zeroWallet()),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
    reason: stringField(row, ["reason"], "Supabase escalation"),
    createdAt: dateField(row, ["created_at"]),
    expiresAt: dateField(row, ["expires_at"], new Date(Date.now() + 30 * 60_000)),
    status: escalationStatusFromString(stringField(row, ["status"], "pending")),
    signaturesCount: numberField(row, ["signatures_count"], 0),
    threshold: numberField(row, ["threshold", "quorum"], 1),
    signers: arrayField(row, ["signers"]),
    executedTxHash: stringField(row, ["executed_tx_hash"], null),
  };
}

function anomalyFromRow(row: SupabaseRow, wallets: Wallet[]): Anomaly {
  const walletAddress = stringField(row, ["wallet_address"], primaryFallbackWallet().address);
  const wallet = wallets.find((item) => item.address.toLowerCase() === walletAddress.toLowerCase());

  return {
    id: stringField(row, ["id"], stableUuid(`anomaly:${JSON.stringify(row)}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    sigma: String(numberField(row, ["sigma", "score"], 0)),
    reason: stringField(row, ["reason", "narrative"], "Supabase anomaly"),
    blockNumber: numberField(row, ["block_number"], 0),
    txHash: stringField(row, ["tx_hash"], null),
    severity: anomalySeverityFromString(stringField(row, ["severity"], "warning")),
    createdAt: dateField(row, ["created_at"]),
  };
}

function publicProfileFromRow(
  row: SupabaseRow,
  source: SupabasePublicWalletProfile["dataSource"],
): SupabasePublicWalletProfile {
  const walletAddress = stringField(row, ["wallet_address", "address"], zeroWallet());

  return {
    walletAddress,
    label: stringField(row, ["label", "name"], shortAddress(walletAddress)),
    postureScore: numberOrNull(row, ["posture_score", "posture", "score"]),
    state: stringField(row, ["status", "state"], "PENDING INDEXER"),
    spend: stringField(row, ["total_spend", "spend"], null),
    threatsBlocked: numberOrNull(row, ["threats_blocked", "blocked"]),
    governedDays: numberOrNull(row, ["governed_days", "days_under_governance"]),
    dataSource: stringField(
      row,
      ["data_source"],
      source,
    ) as SupabasePublicWalletProfile["dataSource"],
  };
}

function stableUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(
    17,
    20,
  )}-${hex.slice(20, 32)}`;
}

function stableHash(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function stringField(row: SupabaseRow | undefined, keys: string[], fallback?: string): string;
function stringField(row: SupabaseRow | undefined, keys: string[], fallback: null): string | null;
function stringField(row: SupabaseRow | undefined, keys: string[], fallback: string | null = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return fallback;
}

function numberField(row: SupabaseRow | undefined, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function numberOrNull(row: SupabaseRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function booleanField(row: SupabaseRow | undefined, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "true";
    }
  }

  return fallback;
}

function arrayField(row: SupabaseRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
  }

  return [];
}

function dateField(row: SupabaseRow | undefined, keys: string[], fallback = new Date()) {
  for (const key of keys) {
    const value = row?.[key];
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return fallback;
}

function moneyBaseUnits(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: string | number = "0",
) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number") {
      return String(Math.round(value * 1_000_000));
    }
    if (typeof value === "string" && value.trim()) {
      if (/^\d+$/.test(value) && value.length > 6) {
        return value;
      }
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return String(Math.round(parsed * 1_000_000));
      }
    }
  }

  return typeof fallback === "number" ? String(Math.round(fallback * 1_000_000)) : fallback;
}

function agentTypeFromLabel(label: string): Agent["type"] {
  const normalized = label.toLowerCase();
  if (normalized.includes("research")) {
    return "research";
  }
  if (normalized.includes("marketing")) {
    return "marketing";
  }
  if (normalized.includes("treasury")) {
    return "treasury";
  }
  if (normalized.includes("support")) {
    return "support";
  }
  if (normalized.includes("dev")) {
    return "dev";
  }

  return "other";
}

function vendorStatusFromString(value: string): Vendor["status"] {
  if (value === "blocked" || value === "removed") {
    return value;
  }

  return "allowed";
}

function verdictFromString(value: string): Transfer["verdict"] {
  if (value === "DENY" || value === "ESCALATE" || value === "FREEZE") {
    return value;
  }

  return "ALLOW";
}

function escalationStatusFromString(value: string): Escalation["status"] {
  const normalized = value.toLowerCase();
  if (normalized === "executed" || normalized === "released" || normalized === "approved") {
    return "EXECUTED";
  }
  if (normalized === "rejected" || normalized === "denied") {
    return "REJECTED";
  }
  if (normalized === "expired") {
    return "EXPIRED";
  }

  return "PENDING";
}

function anomalySeverityFromString(value: string): Anomaly["severity"] {
  if (value === "info" || value === "danger") {
    return value;
  }

  return "warning";
}

function zeroWallet() {
  return "0x0000000000000000000000000000000000000000";
}

function primaryFallbackWallet() {
  const wallet = fallbackWallets[0];
  if (!wallet) {
    throw new Error("Missing primary fallback wallet fixture");
  }

  return wallet;
}

function ownerScopeFromEnv() {
  return (
    process.env.ARCANUM_DEMO_OWNER_WALLET?.toLowerCase() ?? primaryFallbackWallet().ownerAddress
  );
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function unconfiguredWrite<T>(label: string): SupabaseWriteResult<T> {
  return {
    ok: false,
    reason: "unconfigured",
    message: `Supabase service role is not configured; ${label} cannot be saved to the live read model.`,
  };
}

function unavailableWrite<T>(label: string, error: unknown): SupabaseWriteResult<T> {
  warnSupabase(`${label}.write-unavailable`, error);

  return {
    ok: false,
    reason: "unavailable",
    message: `Supabase ${label} write failed; save the on-chain address and retry sync.`,
  };
}

function warnSupabase(label: string, error: unknown) {
  if (warningLabels.has(label)) {
    return;
  }

  warningLabels.add(label);
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[arcanum-supabase] ${label}: ${safeSupabaseError(message)}`);
}

function safeSupabaseError(message: string) {
  return message
    .replaceAll(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "__never__", "[redacted]")
    .replaceAll(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "__never__", "[redacted]");
}

async function safeHealthRead(operation: () => Promise<SupabaseRow[] | undefined>) {
  try {
    return { ok: true as const, data: (await operation()) ?? [] };
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : String(error) };
  }
}

function checkpointBlock(row: SupabaseRow) {
  return numberOrNull(row, [
    "last_indexed_block",
    "last_block",
    "latest_block",
    "block_number",
    "block",
  ]);
}

function checkpointTime(row: SupabaseRow) {
  const value = stringField(
    row,
    ["last_indexed_at", "updated_at", "timestamp", "created_at"],
    null,
  );

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
