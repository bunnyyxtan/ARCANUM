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

import { TRPCError } from "@trpc/server";

import type { ApiContext } from "./context";
import { computePostureScore } from "./posture";

/**
 * User-facing message for a read-model outage. Deliberately explicit that this
 * is an availability failure, never the same thing as "no activity yet".
 */
export const READ_MODEL_UNAVAILABLE_MESSAGE =
  "The live data service is unavailable, so recent activity cannot be shown right now. This is an outage, not an empty history — try again shortly.";

/**
 * Read-model failures fail closed (mirrors the vendor-flags review register):
 * a Supabase problem must surface as an error the UI can distinguish from an
 * empty result, never as a believable empty array.
 */
export function readModelUnavailable(label: string, error: unknown): TRPCError {
  warnSupabase(label, error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: READ_MODEL_UNAVAILABLE_MESSAGE,
    cause: error,
  });
}

/**
 * An agent enriched with the doctrine it spends under, so the dashboard can
 * show real caps and posture without an extra request per row.
 */
export type AgentWithDoctrine = Agent & {
  walletAddress: string | null;
  perTxCap: string | null;
  daily24hCap: string | null;
  monthlyRollingCap: string | null;
  escalationThreshold: string | null;
  policyVersion: number | null;
  postureScore: number | null;
};

/**
 * Widen an agent that has no doctrine attached. The doctrine fields stay null
 * so the UI can say "unknown" instead of rendering a zero cap that looks real.
 */
export function agentWithoutDoctrine(agent: Agent): AgentWithDoctrine {
  return {
    ...agent,
    walletAddress: null,
    perTxCap: null,
    daily24hCap: null,
    monthlyRollingCap: null,
    escalationThreshold: null,
    policyVersion: null,
    postureScore: null,
  };
}
import { fallbackOrgId, fallbackWallets } from "./mock-fallback";

type SupabaseRow = Record<string, unknown>;

type SupabaseRequestOptions = {
  filters?: Record<string, string | number | boolean | null | undefined>;
  limit?: number;
  order?: string;
};

/** How many recent ledger events the public trust figures are computed over. */
const PUBLIC_AGGREGATE_WINDOW = 2000;

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

export type SupabaseDeployedPolicyInput = {
  walletAddress: `0x${string}`;
  txHash: `0x${string}`;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  allowedCategories: string[];
  requireAllowlist: boolean;
};

export type SupabaseEscalationDecisionInput = {
  escalationKey: `0x${string}`;
  status: "released" | "denied" | "expired";
  txHash: `0x${string}`;
  approvalsCount: number;
};

export type SupabaseServiceRoleClient = {
  configured: boolean;
  selectRows: (
    table: string,
    options?: SupabaseRequestOptions
  ) => Promise<SupabaseRow[]>;
  upsertRows: (
    table: string,
    rows: SupabaseRow[],
    onConflict?: string
  ) => Promise<SupabaseRow[]>;
  patchRows: (
    table: string,
    patch: SupabaseRow,
    filters: Record<string, string | number | boolean>
  ) => Promise<SupabaseRow[]>;
};

const warningLabels = new Set<string>();

// Service-role access belongs only in server/API code. Never import this helper from client components.
export function createSupabaseServiceRoleClient(): SupabaseServiceRoleClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    warnSupabase(
      "service-role.env",
      "Supabase service-role env is not configured."
    );
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
    }
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
        `${table} ${method} failed with ${response.status}: ${safeSupabaseError(
          body
        )}`
      );
    }

    return (await response.json()) as SupabaseRow[];
  }

  return {
    configured: true,
    selectRows: (table, options) => request("GET", table, options),
    upsertRows: (table, rows, onConflict) =>
      request("POST", table, { body: rows, onConflict }),
    patchRows: (table, patch, filters) =>
      request("PATCH", table, { body: patch, filters }),
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

  try {
    await ensureOwnerWorkspaceForWallet(client, user.walletAddress);
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

/**
 * Resolve a governed wallet by its on-chain address WITHOUT scoping to the
 * signed-in owner. An escalation approver is often a council member rather than
 * the owner, so the owner-scoped lookup would hide the wallet from them.
 * Callers must enforce their own authorization (owner or on-chain signer)
 * before acting on the result.
 */
export async function readSupabaseWalletByAddressUnscoped(
  ctx: ApiContext,
  address: string
) {
  const rows = await selectRows(ctx, "governed_wallets", {
    filters: { wallet_address: address.toLowerCase() },
    limit: 1,
  });
  const [row] = rows;
  return row ? walletFromGovernedWalletRow(row) : null;
}

export async function readSupabaseWalletByLooseId(
  ctx: ApiContext,
  looseWalletId: string
) {
  const normalized = looseWalletId.toLowerCase();
  const wallets = await readSupabaseWallets(ctx);
  return (
    wallets.find(
      (wallet) =>
        wallet.id === looseWalletId ||
        wallet.address.toLowerCase() === normalized ||
        wallet.label.toLowerCase() === normalized
    ) ?? null
  );
}

export async function readSupabaseAgents(
  ctx: ApiContext,
  status?: Agent["status"]
) {
  const wallets = await readSupabaseWallets(ctx);
  const rows = await agentsForWallets(ctx, wallets);
  return status ? rows.filter((agent) => agent.status === status) : rows;
}

export async function readSupabaseAgentByLooseId(
  ctx: ApiContext,
  looseWalletId: string
) {
  const normalized = looseWalletId.toLowerCase();
  const wallets = await readSupabaseWallets(ctx);
  const agents = await agentsForWallets(ctx, wallets);

  // An agent is addressable by its own signer address, by its id, or by the
  // governed wallet it spends from (wallet address, wallet id, or label).
  const wallet = wallets.find(
    (item) =>
      item.id === looseWalletId ||
      item.address.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized
  );

  return (
    agents.find(
      (agent) =>
        agent.id === looseWalletId ||
        agent.signerAddress.toLowerCase() === normalized ||
        (wallet
          ? agent.walletId === wallet.id
          : agent.walletId === looseWalletId)
    ) ?? null
  );
}

/**
 * Agents are the authorized signers recorded on each wallet's doctrine — never
 * the wallet itself. A governed wallet with no authorized signer has no agent,
 * and we say so rather than inventing one from the wallet address.
 */
async function agentsForWallets(
  ctx: ApiContext,
  wallets: Wallet[]
): Promise<AgentWithDoctrine[]> {
  if (wallets.length === 0) {
    return [];
  }

  // Fetch only the current doctrine of each wallet the caller owns, rather
  // than reading whole tables and filtering afterwards. Posture is computed
  // from that doctrine, so no profile read is needed here.
  const doctrines = await Promise.all(
    wallets.map((wallet) =>
      selectRows(ctx, "doctrines", {
        filters: { governed_wallet_id: wallet.id },
        order: "updated_at.desc",
        limit: 1,
      })
    )
  );

  return wallets.flatMap((wallet, index) => {
    const [current] = doctrines[index] ?? [];
    if (!current) {
      return [];
    }

    const posture = postureFromDoctrineRow(current, wallet.frozen);

    return arrayField(current, ["signers"])
      .map((signer) => signer.toLowerCase())
      .filter((signer) => signer.startsWith("0x") && signer !== zeroWallet())
      .map((signer) => agentFromSigner(wallet, signer, current, posture));
  });
}

export async function readSupabasePolicy(
  ctx: ApiContext,
  wallet: Wallet | null
) {
  if (!wallet) {
    return null;
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { governed_wallet_id: wallet.id },
    order: "updated_at.desc",
    limit: 1,
  });

  return rows[0] ? policyFromDoctrineRow(rows[0], wallet) : null;
}

export async function syncSupabaseSignerState(
  ctx: ApiContext,
  input: { authorized: boolean; signerAddress: `0x${string}`; wallet: Wallet }
): Promise<SupabaseWriteResult<{ signers: `0x${string}`[]; status: string }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("signer state");
  }

  const signerAddress = input.signerAddress.toLowerCase() as `0x${string}`;

  try {
    const rows = await client.selectRows("doctrines", {
      filters: { governed_wallet_id: input.wallet.id },
      order: "updated_at.desc",
      limit: 1,
    });
    const existing = rows[0];
    if (!existing) {
      return unavailableWrite(
        "signer state",
        new Error("No doctrine row exists for this governed wallet.")
      );
    }

    const doctrineId = requiredStringField(existing, ["id"], "doctrines.id");
    const currentSigners = arrayField(existing, ["signers"])
      .map((address) => address.toLowerCase())
      .filter((address): address is `0x${string}` => address.startsWith("0x"));
    const nextSigners = input.authorized
      ? Array.from(new Set([...currentSigners, signerAddress]))
      : currentSigners.filter((address) => address !== signerAddress);

    await client.patchRows(
      "doctrines",
      {
        signers: nextSigners,
        updated_at: new Date().toISOString(),
      },
      { id: doctrineId }
    );

    return {
      ok: true,
      data: {
        signers: nextSigners,
        status: stringField(existing, ["status"], "active"),
      },
    };
  } catch (error) {
    warnSupabase("signer-state.write", error);
    return unavailableWrite("signer state", error);
  }
}

export async function readSupabasePolicies(
  ctx: ApiContext,
  wallet: Wallet | null
) {
  if (!wallet) {
    return [];
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { governed_wallet_id: wallet.id },
    order: "updated_at.desc",
  });

  return rows.map((row) => policyFromDoctrineRow(row, wallet));
}

export async function readSupabaseVendors(
  ctx: ApiContext,
  wallet?: Wallet | null
) {
  if (wallet) {
    const rows = await selectRows(ctx, "vendors", {
      filters: { organization_id: wallet.orgId },
      order: "created_at.desc",
    });
    return rows.map((row) => vendorFromRow(row, wallet));
  }

  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }

  const rows = await selectRows(ctx, "vendors", { order: "created_at.desc" });
  return orgScopedRowsForWallets(rows, wallets).map(({ row, wallet }) =>
    vendorFromRow(row, wallet)
  );
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
    status?: Vendor["status"];
  },
  wallet: Wallet
): Promise<
  SupabaseWriteResult<
    Vendor & { name: string; kycStatus: "public" | "arcanevm" }
  >
> {
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

export async function readSupabaseTransfers(ctx: ApiContext) {
  const rows = await selectRows(ctx, "ledger_events", {
    order: "event_time.desc",
  });
  const wallets = await readSupabaseWallets(ctx);
  return rowsForWalletIdentity(rows, wallets).map((row) =>
    transferFromRow(row, wallets)
  );
}

/** Governance event derived from an indexed ledger row. The field shape
 * matches what the dashboard event stream historically received from the local
 * `events` table. Categories are narrower by design: the indexed read model
 * currently only carries transfer outcomes (allowed / escalated / denied) —
 * freeze, policy, and signer changes are not indexed into Supabase yet, and
 * the retired local-Postgres indexer that once produced them no longer runs
 * anywhere. */
export type GovernanceEventRecord = {
  id: string;
  tenantId: string;
  walletId: string | null;
  type: string;
  severity: string;
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
};

function governanceEventFromRow(
  row: SupabaseRow,
  wallets: Wallet[]
): GovernanceEventRecord {
  const wallet = walletForRow(row, wallets);
  const status = stringField(row, ["status", "verdict"], "allowed").toLowerCase();
  const type =
    status === "escalated"
      ? "TRANSFER_ESCALATED"
      : status === "denied" || status === "blocked"
        ? "TRANSFER_DENIED"
        : "TRANSFER_ALLOWED";
  const severity =
    status === "escalated"
      ? "warning"
      : status === "denied" || status === "blocked"
        ? "danger"
        : "success";
  const txHash = stringField(
    row,
    ["tx_hash", "hash"],
    stableHash(`event:${JSON.stringify(row)}`)
  );

  return {
    id: stringField(row, ["id"], stableUuid(`event:${txHash}`)),
    tenantId: stringField(row, ["tenant_id", "organization_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stringField(row, ["governed_wallet_id", "wallet_id"], null),
    type,
    severity,
    payload: {
      category: stringField(row, ["category", "vendor_category"], "other"),
      counterparty: stringField(row, ["counterparty_name"], null),
      reason: stringField(row, ["decision_reason"], null),
    },
    blockNumber: numberField(row, ["block_number"], 0),
    txHash,
    timestamp: dateField(row, ["event_time", "created_at"]),
  };
}

/**
 * Owner-scoped governance event stream, read from the indexed Supabase ledger.
 * The dashboard's "Governed event stream" used to read the local Postgres
 * `events` table, which only exists in the development workspace — in a
 * deployed environment that read failed closed and the stream was permanently
 * "unavailable". The indexed read model is the real source of chain history,
 * so the stream now derives from it like every other read.
 */
export async function readSupabaseEvents(
  ctx: ApiContext,
  options?: { walletId?: string; page?: number; pageSize?: number }
): Promise<GovernanceEventRecord[]> {
  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }

  const rows = await selectRows(ctx, "ledger_events", {
    order: "event_time.desc",
  });

  const page = options?.page ?? 0;
  const pageSize = options?.pageSize ?? 50;

  return rowsForWalletIdentity(rows, wallets)
    .map((row) => governanceEventFromRow(row, wallets))
    .filter((event) => (options?.walletId ? event.walletId === options.walletId : true))
    .slice(page * pageSize, page * pageSize + pageSize);
}

/**
 * Public, unscoped ledger for one governed wallet. The explorer and badge pages
 * are meant to be verifiable by anyone, so they cannot use the owner-scoped
 * read: an anonymous visitor has no session and would always see zero rows.
 */
export async function readSupabasePublicLedger(
  ctx: ApiContext,
  address: string,
  limit = 100
): Promise<Transfer[]> {
  const wallet = await readSupabaseWalletByAddressUnscoped(ctx, address);
  if (!wallet) {
    return [];
  }

  const rows = await selectRows(ctx, "ledger_events", {
    filters: { governed_wallet_id: wallet.id },
    order: "event_time.desc",
    limit,
  });

  // The public record proves what the wallet did; it must not hand out the
  // tenant's internal wiring or the free-text decision rationale.
  return rows.map((row) => {
    const transfer = transferFromRow(row, [wallet]);
    return {
      ...transfer,
      tenantId: "",
      walletId: "",
      agentId: null,
      reason: "",
    };
  });
}

/** Base units (6dp USDC) to a decimal string without going through a float. */
function formatUsdcBaseUnits(value: bigint) {
  const whole = value / 1_000_000n;
  const cents = (value % 1_000_000n).toString().padStart(6, "0").slice(0, 2);
  return `${whole.toString()}.${cents}`;
}

export async function readSupabaseEscalations(
  ctx: ApiContext,
  status?: Escalation["status"]
) {
  const rows = await selectRows(ctx, "escalations", {
    order: "expires_at.asc",
  });
  const wallets = await readSupabaseWallets(ctx);
  const escalations = rowsForWallets(rows, wallets).map((row) =>
    escalationFromRow(row, wallets)
  );
  return status
    ? escalations.filter((item) => item.status === status)
    : escalations;
}

export async function readSupabaseEscalationByTxHash(
  ctx: ApiContext,
  txHash: string
) {
  const rows = await selectRows(ctx, "escalations", {
    filters: { escalation_key: txHash },
    limit: 1,
  });
  const wallets = await readSupabaseWallets(ctx);
  const [row] = rowsForWallets(rows, wallets);
  return row ? escalationFromRow(row, wallets) : null;
}

export async function readSupabaseAnomalies(ctx: ApiContext) {
  const rows = await selectRows(ctx, "anomalies", { order: "score.desc" });
  const wallets = await readSupabaseWallets(ctx);
  return rowsForWallets(rows, wallets).map((row) =>
    anomalyFromRow(row, wallets)
  );
}

/**
 * Persist a policy revision that is already live on-chain, so the read model
 * stops advertising caps the wallet no longer enforces.
 */
export async function recordSupabaseDeployedPolicy(
  ctx: ApiContext,
  wallet: Wallet,
  input: SupabaseDeployedPolicyInput
): Promise<SupabaseWriteResult<{ version: number }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("policy deployment");
  }

  try {
    const [current] = await client.selectRows("doctrines", {
      filters: { governed_wallet_id: wallet.id },
      order: "version.desc",
      limit: 1,
    });

    // Mirroring the same on-chain policy twice must not inflate the doctrine
    // version: a retry after a network blip should be a no-op.
    const currentCategories = arrayField(current, ["allowed_categories"])
      .map((category) => String(category).toLowerCase())
      .sort();
    const nextCategories = [...input.allowedCategories]
      .map((category) => category.toLowerCase())
      .sort();
    const unchanged =
      Boolean(current) &&
      numberField(current, ["daily_cap_usdc"], -1) === input.dailyCap &&
      numberField(current, ["per_tx_cap_usdc"], -1) === input.perTxCap &&
      numberField(current, ["monthly_cap_usdc"], -1) === input.monthlyCap &&
      numberField(current, ["escalate_above_usdc"], -1) ===
        input.escalationThreshold &&
      booleanField(current, ["require_vendor_allowlist"], false) ===
        input.requireAllowlist &&
      currentCategories.join(",") === nextCategories.join(",");

    if (unchanged) {
      return {
        ok: true,
        data: { version: numberField(current, ["version"], 1) },
      };
    }

    const version = numberField(current, ["version"], 0) + 1;
    const now = new Date().toISOString();

    await writeDoctrineRow(
      client,
      {
        governed_wallet_id: wallet.id,
        organization_id: current
          ? stringField(current, ["organization_id"], wallet.orgId)
          : wallet.orgId,
        name: stringField(current, ["name"], `${wallet.label} Doctrine`),
        version,
        daily_cap_usdc: input.dailyCap,
        per_tx_cap_usdc: input.perTxCap,
        per_vendor_daily_cap_usdc: input.perTxCap,
        monthly_cap_usdc: input.monthlyCap,
        escalate_above_usdc: input.escalationThreshold,
        allowed_categories: input.allowedCategories,
        require_vendor_allowlist: input.requireAllowlist,
        // Signers, council and quorum are governed by their own on-chain
        // transactions, so a policy deployment must carry them over untouched.
        signers: arrayField(current, ["signers"]),
        escalation_council: arrayField(current, ["escalation_council"]),
        quorum: numberField(current, ["quorum"], 1),
        status: "active",
        source: "on_chain",
        updated_at: now,
      },
      wallet.id
    );

    return { ok: true, data: { version } };
  } catch (error) {
    warnSupabase("policy-deployment.write", error);
    return unavailableWrite("policy deployment", error);
  }
}

/**
 * Mirror an escalation decision that is already settled on-chain. Callers must
 * verify the on-chain status first; this only writes what the chain reports.
 */
export async function recordSupabaseEscalationDecision(
  ctx: ApiContext,
  wallet: Wallet,
  input: SupabaseEscalationDecisionInput
): Promise<SupabaseWriteResult<{ status: string }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("escalation decision");
  }

  try {
    const patch: SupabaseRow = {
      status: input.status,
      approvals_count: input.approvalsCount,
      updated_at: new Date().toISOString(),
    };

    if (input.status === "released") {
      patch.release_tx_hash = input.txHash;
    }
    if (input.status === "denied") {
      patch.deny_tx_hash = input.txHash;
    }

    const updated = await client.patchRows("escalations", patch, {
      escalation_key: input.escalationKey,
      governed_wallet_id: wallet.id,
    });

    // Reporting success for a patch that matched nothing would leave the queue
    // showing a decision that was never mirrored.
    if (!updated || updated.length === 0) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "The escalation is settled on-chain but no matching row exists in the read model yet.",
      };
    }

    return { ok: true, data: { status: input.status } };
  } catch (error) {
    return unavailableWrite("escalation decision", error);
  }
}

export async function recordSupabaseCreatedWallet(
  ctx: ApiContext,
  input: SupabaseCreatedWalletInput
): Promise<SupabaseWriteResult<{ wallet: Wallet; agent: Agent | null }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("created wallet");
  }

  const walletAddress = input.walletAddress.toLowerCase();
  const ownerAddress = input.ownerAddress.toLowerCase();

  try {
    const workspace = await ensureOwnerWorkspaceForWallet(client, ownerAddress);
    const now = new Date().toISOString();
    const walletRow = {
      organization_id: workspace.organizationId,
      wallet_address: walletAddress,
      owner_address: ownerAddress,
      label: input.label,
      deploy_tx_hash: input.deployTxHash.toLowerCase(),
      chain_id: input.chainId,
      status: "pending_indexer",
      indexer_status: "pending",
      data_source: "live",
      created_at: now,
      updated_at: now,
      wallet_factory_address: process.env.NEXT_PUBLIC_WALLET_FACTORY,
      policy_engine_address: process.env.NEXT_PUBLIC_POLICY_ENGINE,
      vendor_registry_address: process.env.NEXT_PUBLIC_VENDOR_REGISTRY,
      escalation_manager_address: process.env.NEXT_PUBLIC_ESCALATION_MANAGER,
      anomaly_oracle_address: process.env.NEXT_PUBLIC_ANOMALY_ORACLE,
      created_by: workspace.profileId,
    };
    const [writtenWallet] = await client.upsertRows(
      "governed_wallets",
      [walletRow],
      "wallet_address,chain_id"
    );
    const walletId = requiredStringField(
      writtenWallet ?? walletRow,
      ["id"],
      "governed_wallets.id"
    );

    const doctrineRow = {
      governed_wallet_id: walletId,
      organization_id: workspace.organizationId,
      name: `${input.label} Doctrine`,
      version: 1,
      daily_cap_usdc: input.dailyCap,
      per_tx_cap_usdc: input.perTxCap,
      per_vendor_daily_cap_usdc: input.perTxCap,
      monthly_cap_usdc: input.monthlyCap,
      escalate_above_usdc: input.escalationThreshold,
      allowed_categories: ["api", "compute", "data", "other"],
      require_vendor_allowlist: input.requireAllowlist,
      signers: input.signers.map((address) => address.toLowerCase()),
      escalation_council: input.council.map((address) => address.toLowerCase()),
      quorum: input.quorum,
      status: "active",
      source: "supabase",
      updated_at: now,
    };
    const publicProfileRow = {
      governed_wallet_id: walletId,
      wallet_address: walletAddress,
      show_public_badge: false,
      posture_score: postureFromDoctrineRow(doctrineRow as SupabaseRow, false),
      health_grade: "PENDING INDEXER",
      summary: `${input.label} is synced in Supabase. On-chain event history may lag.`,
      updated_at: now,
    };

    await writeDoctrineRow(client, doctrineRow, walletId);
    await writePublicWalletProfileRow(client, publicProfileRow, walletAddress);

    const wallet = walletFromGovernedWalletRow(writtenWallet ?? walletRow);
    const [primarySigner] = doctrineRow.signers;
    return {
      ok: true,
      data: {
        wallet,
        agent: primarySigner
          ? agentFromSigner(
              wallet,
              primarySigner,
              doctrineRow,
              publicProfileRow.posture_score
            )
          : null,
      },
    };
  } catch (error) {
    warnSupabase("created-wallet.write", error);
    return unavailableWrite("created wallet", error);
  }
}

async function ensureOwnerWorkspaceForWallet(
  client: SupabaseServiceRoleClient,
  ownerAddress: string
) {
  const walletAddress = ownerAddress.toLowerCase();
  const now = new Date().toISOString();
  const [existingProfile] = await client.selectRows("profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });
  const profile =
    existingProfile ??
    (
      await client.upsertRows("profiles", [
        {
          wallet_address: walletAddress,
          display_name: shortAddress(walletAddress),
          updated_at: now,
        },
      ])
    )[0];
  const profileId = requiredStringField(profile, ["id"], "profiles.id");

  const [existingOrganization] = await client.selectRows("organizations", {
    filters: { created_by: profileId },
    limit: 1,
    order: "created_at.asc",
  });
  const organization =
    existingOrganization ??
    (
      await client.upsertRows("organizations", [
        {
          name: workspaceNameForWallet(walletAddress),
          slug: workspaceSlugForWallet(walletAddress),
          safe_address: walletAddress,
          created_by: profileId,
          plan: "free",
          updated_at: now,
        },
      ])
    )[0];
  const organizationId = requiredStringField(
    organization,
    ["id"],
    "organizations.id"
  );

  await client.upsertRows(
    "organization_members",
    [
      {
        organization_id: organizationId,
        profile_id: profileId,
        role: "owner",
      },
    ],
    "organization_id,profile_id"
  );

  return { profileId, organizationId };
}

async function writeDoctrineRow(
  client: SupabaseServiceRoleClient,
  row: SupabaseRow,
  governedWalletId: string
) {
  const version = numberField(row, ["version"], 1);
  const [existing] = await client.selectRows("doctrines", {
    filters: { governed_wallet_id: governedWalletId, version },
    limit: 1,
  });
  const existingId = stringField(existing, ["id"], "");

  if (existingId) {
    await client.patchRows("doctrines", row, { id: existingId });
    return;
  }

  await client.upsertRows("doctrines", [
    { ...row, created_at: new Date().toISOString() },
  ]);
}

async function writePublicWalletProfileRow(
  client: SupabaseServiceRoleClient,
  row: SupabaseRow,
  walletAddress: string
) {
  const [existing] = await client.selectRows("public_wallet_profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });
  const existingId = stringField(existing, ["id"], "");

  if (existingId) {
    // The indexer owns health_grade/summary once it has seen on-chain events
    // for this wallet; re-recording a deploy must not knock the profile back
    // into the PENDING INDEXER state.
    const alreadyIndexed = Boolean(stringField(existing, ["last_indexed_at"], ""));
    const patch = alreadyIndexed
      ? Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "health_grade" && key !== "summary"),
        )
      : row;
    await client.patchRows("public_wallet_profiles", patch, { id: existingId });
    return;
  }

  await client.upsertRows("public_wallet_profiles", [
    { ...row, created_at: new Date().toISOString() },
  ]);
}

export async function readSupabaseRuntimeHealth(
  ctx: ApiContext
): Promise<SupabaseRuntimeHealth> {
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
  const readModel = await safeHealthRead(() =>
    client.selectRows("governed_wallets", { limit: 1 })
  );
  const checkpoint = await safeHealthRead(() =>
    client.selectRows("indexer_checkpoints", { limit: 1 })
  );
  const readModelError = readModel.ok
    ? null
    : safeSupabaseError(readModel.error);
  const checkpointError = checkpoint.ok
    ? null
    : safeSupabaseError(checkpoint.error);
  const checkpointRow = checkpoint.ok ? checkpoint.data[0] : undefined;

  return {
    ...base,
    api: {
      ...base.api,
      status: readModel.ok || checkpoint.ok ? "available" : "unavailable",
      error:
        readModel.ok || checkpoint.ok
          ? null
          : readModelError ?? checkpointError,
    },
    readModel: {
      status: readModel.ok ? "available" : "unavailable",
      sampleRows: readModel.ok ? readModel.data.length : 0,
      error: readModelError,
    },
    indexerCheckpoint: {
      status: checkpoint.ok
        ? checkpointRow
          ? "available"
          : "empty"
        : "unavailable",
      lastIndexedBlock: checkpointRow ? checkpointBlock(checkpointRow) : null,
      lastIndexedAt: checkpointRow ? checkpointTime(checkpointRow) : null,
      error: checkpointError,
    },
  };
}

export async function readSupabasePublicWalletProfile(
  ctx: ApiContext,
  address: string
) {
  const walletAddress = address.toLowerCase();
  // Anonymous visitors have no session, so the wallet must be resolved unscoped
  // or the public trust pages would always report "no public profile".
  const [rows, wallet] = await Promise.all([
    selectRows(ctx, "public_wallet_profiles", {
      filters: { wallet_address: walletAddress },
      limit: 1,
    }),
    readSupabaseWalletByAddressUnscoped(ctx, walletAddress),
  ]);

  if (!rows[0] && !wallet) {
    return null;
  }

  const stored = rows[0] ? publicProfileFromRow(rows[0], "supabase") : null;
  // Aggregates cover the most recent PUBLIC_AGGREGATE_WINDOW events; the read
  // model has no aggregate endpoint, so very long histories would need the
  // indexer to maintain running totals.
  const [ledger, doctrineRows] = await Promise.all([
    readSupabasePublicLedger(ctx, walletAddress, PUBLIC_AGGREGATE_WINDOW),
    wallet
      ? selectRows(ctx, "doctrines", {
          filters: { governed_wallet_id: wallet.id },
          order: "updated_at.desc",
          limit: 1,
        })
      : Promise.resolve([] as SupabaseRow[]),
  ]);

  // Every published figure is derived from indexed activity: a trust mark that
  // invents numbers is worse than one that shows nothing.
  const settledBaseUnits = ledger
    .filter((transfer) => transfer.verdict === "ALLOW")
    .reduce((total, transfer) => total + BigInt(transfer.amount || "0"), 0n);
  const blocked = ledger.filter(
    (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE"
  ).length;
  const governedSince = wallet ? new Date(wallet.createdAt).getTime() : NaN;
  const governedDays = Number.isFinite(governedSince)
    ? Math.max(0, Math.floor((Date.now() - governedSince) / 86_400_000))
    : null;

  return {
    walletAddress: wallet?.address ?? stored?.walletAddress ?? walletAddress,
    label: wallet?.label ?? stored?.label ?? shortAddress(walletAddress),
    // Posture is recomputed from the live doctrine so the public number always
    // matches what the doctrine actually enforces; the stored score is only a
    // fallback for wallets whose doctrine is not readable.
    postureScore:
      wallet && doctrineRows[0]
        ? postureFromDoctrineRow(doctrineRows[0], wallet.frozen)
        : stored?.postureScore ?? null,
    state: wallet
      ? wallet.frozen
        ? "UNDER RESTRAINT"
        : "FORTIFIED"
      : stored?.state ?? "UNKNOWN",
    spend:
      ledger.length > 0
        ? formatUsdcBaseUnits(settledBaseUnits)
        : stored?.spend ?? null,
    threatsBlocked:
      ledger.length > 0 ? blocked : stored?.threatsBlocked ?? null,
    governedDays: governedDays ?? stored?.governedDays ?? null,
    dataSource: "supabase",
  } satisfies SupabasePublicWalletProfile;
}

async function selectRows(
  ctx: ApiContext,
  table: string,
  options?: SupabaseRequestOptions
) {
  const client = ctx.supabase;
  if (!client) {
    // A missing configuration must never look like "no rows": for a product
    // whose promise is showing what an agent spent, a calm empty dashboard on
    // top of a broken read model is worse than an error.
    throw readModelUnavailable(
      `${table}.read`,
      new Error("Supabase read model is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")
    );
  }

  try {
    return await client.selectRows(table, options);
  } catch (error) {
    throw readModelUnavailable(`${table}.read`, error);
  }
}

function scopedRows(ctx: ApiContext, rows: SupabaseRow[]) {
  const scope = ownerScope(ctx);
  if (!scope) {
    return [];
  }

  const filtered = rows.filter((row) => {
    const owner = stringField(row, ["owner_address"]);
    // Private read-model rows must be wallet-owned; rows without owner metadata fail closed.
    return Boolean(owner) && owner.toLowerCase() === scope;
  });

  return filtered;
}

/**
 * Keep only the rows that belong to a wallet the caller owns. Uses the same
 * identity precedence as walletForRow so a row is never listed for one wallet
 * and then attributed to another.
 */
function rowsForWallets(rows: SupabaseRow[], wallets: Wallet[]) {
  if (wallets.length === 0) {
    return [];
  }

  return rows.filter((row) => walletForRow(row, wallets) !== null);
}

/**
 * Vendors are organisation-scoped: the table has no wallet column, so a row can
 * only be tied to the org. Keep every row for an org the caller owns a wallet
 * in, and attribute it to that org's first wallet purely for display.
 */
function orgScopedRowsForWallets(rows: SupabaseRow[], wallets: Wallet[]) {
  if (wallets.length === 0) {
    return [] as { row: SupabaseRow; wallet: Wallet }[];
  }

  const walletsByOrg = new Map<string, Wallet>();
  for (const wallet of wallets) {
    if (!walletsByOrg.has(wallet.orgId)) {
      walletsByOrg.set(wallet.orgId, wallet);
    }
  }

  const matched: { row: SupabaseRow; wallet: Wallet }[] = [];
  for (const row of rows) {
    const wallet =
      walletForRow(row, wallets) ??
      walletsByOrg.get(stringField(row, ["organization_id"], ""));
    if (wallet) {
      matched.push({ row, wallet });
    }
  }

  return matched;
}

function rowsForWalletIdentity(rows: SupabaseRow[], wallets: Wallet[]) {
  const walletAddresses = new Set(
    wallets.map((wallet) => wallet.address.toLowerCase())
  );
  const walletIds = new Set(wallets.map((wallet) => wallet.id));
  if (walletAddresses.size === 0) {
    return [];
  }

  return rows.filter((row) => {
    const walletAddress = stringField(
      row,
      ["wallet_address"],
      ""
    ).toLowerCase();
    const governedWalletId = stringField(
      row,
      ["governed_wallet_id", "wallet_id"],
      ""
    );
    return (
      (Boolean(walletAddress) && walletAddresses.has(walletAddress)) ||
      (Boolean(governedWalletId) && walletIds.has(governedWalletId))
    );
  });
}

/**
 * Resolve the wallet a Supabase row belongs to, strongest identity first.
 *
 * The organization is a last resort and only decides the row when the org owns
 * exactly one wallet: every wallet in an org shares its id, so matching on it
 * first would file each row under whichever wallet happened to be listed first.
 */
function walletForRow(row: SupabaseRow, wallets: Wallet[]) {
  const walletAddress = stringField(row, ["wallet_address"], "").toLowerCase();
  if (walletAddress) {
    const byAddress = wallets.find(
      (wallet) => wallet.address.toLowerCase() === walletAddress
    );
    if (byAddress) {
      return byAddress;
    }
  }

  const governedWalletId = stringField(
    row,
    ["governed_wallet_id", "wallet_id"],
    ""
  );
  if (governedWalletId) {
    const byId = wallets.find((wallet) => wallet.id === governedWalletId);
    if (byId) {
      return byId;
    }
  }

  // A row that names a wallet we do not own is not ours to reassign.
  if (walletAddress || governedWalletId) {
    return null;
  }

  const organizationId = stringField(row, ["organization_id"], "");
  if (!organizationId) {
    return null;
  }

  const orgWallets = wallets.filter(
    (wallet) => wallet.orgId === organizationId
  );
  return orgWallets.length === 1 ? orgWallets[0] : null;
}

function ownerScope(ctx: ApiContext) {
  return ctx.session?.walletAddress.toLowerCase() ?? null;
}

function requiredStringField(
  row: SupabaseRow | undefined,
  keys: string[],
  label: string
) {
  const value = stringField(row, keys, "");
  if (!value) {
    throw new Error(`${label} was not returned by Supabase.`);
  }

  return value;
}

function workspaceNameForWallet(walletAddress: string) {
  return "Arcanum Workspace";
}

function workspaceSlugForWallet(walletAddress: string) {
  return `arcanum-${walletAddress.slice(2, 10)}`;
}

function walletFromGovernedWalletRow(row: SupabaseRow): Wallet {
  const walletAddress = stringField(
    row,
    ["wallet_address", "address"],
    zeroWallet()
  );
  const label = stringField(
    row,
    ["label", "name"],
    shortAddress(walletAddress)
  );
  const status = stringField(
    row,
    ["status", "indexer_status"],
    "active"
  ).toLowerCase();

  return {
    id: stringField(row, ["id"], stableUuid(`wallet:${walletAddress}`)),
    tenantId: defaultTenantId(),
    orgId: stringField(row, ["organization_id", "org_id"], fallbackOrgId),
    address: walletAddress.toLowerCase(),
    label,
    ownerAddress: stringField(row, ["owner_address"], ownerScopeFromEnv()),
    createdBlock: numberField(row, ["created_block", "block_number"], 0),
    createdAt: dateField(row, ["created_at", "deployed_at"]),
    factoryAddress: stringField(
      row,
      ["wallet_factory_address"],
      process.env.NEXT_PUBLIC_WALLET_FACTORY ?? zeroWallet()
    ),
    frozen: status.includes("frozen") || status.includes("restraint"),
    policyVersion: numberField(row, ["policy_version", "doctrine_version"], 1),
  };
}

/**
 * Posture is computed from the doctrine that actually restrains the wallet,
 * never read from a stored constant, so every agent's score reflects its own
 * controls and reacts when the policy changes.
 */
function postureFromDoctrineRow(row: SupabaseRow, frozen: boolean): number {
  return computePostureScore({
    requireVendorAllowlist: booleanField(row, ["require_vendor_allowlist"], false),
    quorum: numberField(row, ["quorum"], 0),
    councilSize: arrayField(row, ["escalation_council"]).length,
    perTxCapUsd: numberField(row, ["per_tx_cap_usdc"], 0),
    dailyCapUsd: numberField(row, ["daily_cap_usdc"], 0),
    monthlyCapUsd: numberField(row, ["monthly_cap_usdc"], 0),
    escalateAboveUsd: numberField(row, ["escalate_above_usdc"], 0),
    doctrineVersion: numberField(row, ["version", "policy_version"], 1),
    frozen,
  });
}

function agentFromSigner(
  wallet: Wallet,
  signerAddress: string,
  doctrine: SupabaseRow,
  postureScore: number
): AgentWithDoctrine {
  const label = wallet.label || shortAddress(wallet.address);
  return {
    id: stableUuid(`agent:${wallet.address}:${signerAddress}`),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    signerAddress,
    label,
    type: agentTypeFromLabel(label),
    createdAt: wallet.createdAt,
    lastSeenAt: wallet.createdAt,
    // An authorized signer on an unfrozen wallet can spend right now; a frozen
    // wallet blocks every signer regardless of authorization.
    status: wallet.frozen ? "frozen" : "active",
    walletAddress: wallet.address,
    // The caps the agent actually spends under, so the UI never has to guess.
    perTxCap: moneyBaseUnits(doctrine, ["per_tx_cap_usdc"]),
    daily24hCap: moneyBaseUnits(doctrine, ["daily_cap_usdc"]),
    monthlyRollingCap: moneyBaseUnits(doctrine, ["monthly_cap_usdc"]),
    escalationThreshold: moneyBaseUnits(doctrine, ["escalate_above_usdc"]),
    policyVersion: numberField(
      doctrine,
      ["version", "policy_version"],
      wallet.policyVersion
    ),
    postureScore,
  };
}

function policyFromDoctrineRow(
  row: SupabaseRow,
  wallet: Wallet
): Policy & { doctrineStatus: string; signers: string[] } {
  return {
    id: stableUuid(
      `policy:${wallet.address}:${stringField(row, ["version"], "1")}`
    ),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    version: numberField(
      row,
      ["version", "policy_version"],
      wallet.policyVersion
    ),
    perTxCap: moneyBaseUnits(row, ["per_tx_cap_usdc"]),
    daily24hCap: moneyBaseUnits(row, ["daily_cap_usdc"]),
    monthlyRollingCap: moneyBaseUnits(row, ["monthly_cap_usdc"]),
    allowedCategories: allowedCategoryMask(row),
    escalationThreshold: moneyBaseUnits(row, ["escalate_above_usdc"]),
    requireAllowlist: booleanField(row, ["require_vendor_allowlist"], true),
    updatedAt: dateField(row, ["updated_at"]),
    updatedBy: wallet.ownerAddress,
    doctrineStatus: stringField(row, ["status"], "active"),
    signers: arrayField(row, ["signers"]),
  };
}

function vendorFromRow(
  row: SupabaseRow,
  wallet?: Wallet | null
): Vendor & {
  name: string;
  kycStatus: "public" | "arcanevm";
  walletAddress: string;
} {
  const vendorAddress = stringField(row, ["vendor_address"], zeroWallet());
  const walletAddress = wallet?.address ?? primaryFallbackWallet().address;
  const walletId = wallet?.id ?? stableUuid(`wallet:${walletAddress}`);

  return {
    id: stringField(
      row,
      ["id"],
      stableUuid(`vendor:${walletAddress}:${vendorAddress}`)
    ),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId,
    address: vendorAddress.toLowerCase(),
    category: stringField(row, ["category"], "other"),
    status: vendorStatusFromString(stringField(row, ["status"], "allowed")),
    perVendorCap: "0",
    metadataHash: stringField(
      row,
      ["metadata_hash"],
      stableHash(`vendor:${vendorAddress}`)
    ),
    addedAt: dateField(row, ["created_at"]),
    addedBy: wallet?.ownerAddress ?? ownerScopeFromEnv(),
    name: stringField(row, ["name", "label"], shortAddress(vendorAddress)),
    kycStatus: booleanField(row, ["confidential"], false)
      ? "arcanevm"
      : "public",
    walletAddress,
  };
}

function transferFromRow(row: SupabaseRow, wallets: Wallet[]): Transfer {
  const wallet = walletForRow(row, wallets);
  const walletAddress = wallet?.address ?? primaryFallbackWallet().address;
  const txHash = stringField(
    row,
    ["tx_hash", "hash"],
    stableHash(`transfer:${JSON.stringify(row)}`)
  );

  return {
    id: stringField(row, ["id"], stableUuid(`transfer:${txHash}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    txHash,
    blockNumber: numberField(row, ["block_number"], 0),
    timestamp: dateField(row, ["event_time", "created_at"]),
    toAddress: stringField(
      row,
      ["to_address", "counterparty_address"],
      zeroWallet()
    ),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
    verdict: verdictFromString(
      stringField(row, ["verdict", "status"], "ALLOW")
    ),
    reason: stringField(row, ["decision_reason"], "indexed from Supabase"),
    vendorCategory: stringField(row, ["vendor_category", "category"], "other"),
    dailySpentAfter: moneyBaseUnits(row, ["daily_spent_after"], 0),
  };
}

function escalationFromRow(row: SupabaseRow, wallets: Wallet[]): Escalation {
  const wallet = walletForRow(row, wallets);
  const walletAddress = wallet?.address ?? primaryFallbackWallet().address;
  // The dashboard and the public approver portal both call the escalation
  // manager with this id, so it must be the on-chain escalation key. Falling
  // back to the Supabase UUID leaves approve/reject permanently disabled.
  const id = stringField(
    row,
    ["escalation_key", "tx_hash", "id"],
    stableHash(`escalation:${JSON.stringify(row)}`)
  );

  return {
    id,
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    transferId: stringField(row, ["ledger_event_id"], null),
    toAddress: stringField(
      row,
      ["to_address", "counterparty_address"],
      zeroWallet()
    ),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
    reason: stringField(row, ["reason"], "Supabase escalation"),
    createdAt: dateField(row, ["created_at"]),
    expiresAt: dateField(
      row,
      ["expires_at"],
      new Date(Date.now() + 30 * 60_000)
    ),
    status: escalationStatusFromString(stringField(row, ["status"], "pending")),
    signaturesCount: numberField(row, ["approvals_count"], 0),
    threshold: numberField(row, ["quorum_required"], 1),
    signers: arrayField(row, ["signers"]),
    executedTxHash: stringField(row, ["release_tx_hash", "deny_tx_hash"], null),
  };
}

function anomalyFromRow(row: SupabaseRow, wallets: Wallet[]): Anomaly {
  const wallet = walletForRow(row, wallets);
  const walletAddress = wallet?.address ?? primaryFallbackWallet().address;

  return {
    id: stringField(row, ["id"], stableUuid(`anomaly:${JSON.stringify(row)}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    sigma: String(numberField(row, ["score"], 0)),
    reason: stringField(row, ["description", "title"], "Supabase anomaly"),
    blockNumber: numberField(row, ["block_number"], 0),
    txHash: stringField(row, ["tx_hash"], null),
    severity: anomalySeverityFromString(stringField(row, ["severity"], "low")),
    createdAt: dateField(row, ["detected_at", "created_at"]),
  };
}

function publicProfileFromRow(
  row: SupabaseRow,
  source: SupabasePublicWalletProfile["dataSource"]
): SupabasePublicWalletProfile {
  const walletAddress = stringField(
    row,
    ["wallet_address", "address"],
    zeroWallet()
  );

  return {
    walletAddress,
    label: stringField(row, ["label", "name"], shortAddress(walletAddress)),
    postureScore: numberOrNull(row, ["posture_score", "posture", "score"]),
    state: stringField(row, ["status", "state", "health_grade"], "PENDING INDEXER"),
    spend: stringField(row, ["total_spend", "spend"], null),
    threatsBlocked: numberOrNull(row, ["threats_blocked", "blocked"]),
    governedDays: numberOrNull(row, ["governed_days", "days_under_governance"]),
    dataSource: stringField(
      row,
      ["data_source"],
      source
    ) as SupabasePublicWalletProfile["dataSource"],
  };
}

function stableUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(
    13,
    16
  )}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function stableHash(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback?: string
): string;
function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: null
): string | null;
function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: string | null = ""
) {
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

function numberField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback = 0
) {
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

function booleanField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: boolean
) {
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

function dateField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback = new Date()
) {
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
  fallback: string | number = "0"
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

  return typeof fallback === "number"
    ? String(Math.round(fallback * 1_000_000))
    : fallback;
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
  const normalized = value.toLowerCase();
  if (
    normalized === "deny" ||
    normalized === "denied" ||
    normalized === "blocked" ||
    normalized === "rejected"
  ) {
    return "DENY";
  }
  if (normalized === "escalate" || normalized === "escalated") {
    return "ESCALATE";
  }
  if (normalized === "freeze" || normalized === "frozen") {
    return "FREEZE";
  }

  return "ALLOW";
}

function escalationStatusFromString(value: string): Escalation["status"] {
  const normalized = value.toLowerCase();
  if (
    normalized === "executed" ||
    normalized === "released" ||
    normalized === "approved"
  ) {
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
  const normalized = value.toLowerCase();
  if (
    normalized === "critical" ||
    normalized === "high" ||
    normalized === "danger"
  ) {
    return "danger";
  }
  if (normalized === "medium" || normalized === "warning") {
    return "warning";
  }

  return "info";
}

/** Bit positions of RestraintCategory in the on-chain policy bitmask. */
const CATEGORY_BITS: Record<string, number> = {
  api: 1,
  compute: 2,
  data: 4,
  subcontracting: 8,
  other: 16,
};

const ALL_CATEGORIES_MASK = 31;

/**
 * Inverse of allowedCategoryMask: turn the bitmask the wallet enforces back
 * into the category names the read model stores.
 */
export function categoryNamesFromMask(mask: number): string[] {
  return Object.entries(CATEGORY_BITS)
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([name]) => name);
}

/** VendorRegistry category enum order, mirrored from the contract. */
const VENDOR_CATEGORY_ORDER = [
  "api",
  "compute",
  "data",
  "subcontracting",
  "other",
] as const;

export function vendorCategoryFromIndex(index: number): string {
  return VENDOR_CATEGORY_ORDER[index] ?? "other";
}

function allowedCategoryMask(row: SupabaseRow) {
  const categories = arrayField(row, ["allowed_categories"]);
  if (categories.length === 0) {
    return ALL_CATEGORIES_MASK;
  }

  return categories.reduce(
    (mask, category) =>
      mask | (CATEGORY_BITS[category.trim().toLowerCase()] ?? 0),
    0
  );
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
    process.env.ARCANUM_DEMO_OWNER_WALLET?.toLowerCase() ??
    primaryFallbackWallet().ownerAddress
  );
}

function shortAddress(value: string) {
  return value.length > 12
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

function unconfiguredWrite<T>(label: string): SupabaseWriteResult<T> {
  return {
    ok: false,
    reason: "unconfigured",
    message: `Supabase service role is not configured; ${label} cannot be saved to the live read model.`,
  };
}

function unavailableWrite<T>(
  label: string,
  error: unknown
): SupabaseWriteResult<T> {
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
    .replaceAll(
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? "__never__",
      "[redacted]"
    )
    .replaceAll(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "__never__",
      "[redacted]"
    );
}

async function safeHealthRead(
  operation: () => Promise<SupabaseRow[] | undefined>
) {
  try {
    return { ok: true as const, data: (await operation()) ?? [] };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : String(error),
    };
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
    null
  );

  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
