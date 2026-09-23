import type { Agent, Wallet } from "@arcanum/db/schema";
import { ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import { readWalletAuthorityState } from "../chain";
import type { ApiContext } from "../context";
import { readCallerMembership } from "./auth";
import type { SupabaseRow } from "./client";
import {
  type SupabaseWriteResult,
  readModelUnavailable,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { arrayField, numberField, stringField } from "./fields";
import {
  agentFromSigner,
  policyFromDoctrineRow,
  postureFromDoctrineRow,
  walletFromGovernedWalletRow,
  zeroWallet,
} from "./mappers";
import { ownerScope, requiredStringField, scopedRows } from "./scope";
import { scopedAnalyticsRpc } from "./scoped-analytics";
import { sharedRead } from "./snapshot";
import { selectRows, selectRowsExhaustive } from "./transport";

const MAX_DOCTRINE_VERSIONS_PER_WALLET = 500;

/**
 * An agent enriched with the doctrine it spends under, so the dashboard can
 * show real caps and posture without an extra request per row.
 */
export type AgentWithDoctrine = Agent & {
  walletAddress: string | null;
  perTxCap: string | null;
  daily24hCap: string | null;
  monthlyCap: string | null;
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
    monthlyCap: null,
    escalationThreshold: null,
    policyVersion: null,
    postureScore: null,
  };
}

export async function readSupabaseWallets(ctx: ApiContext): Promise<Wallet[]> {
  const walletFactory = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();
  return (await readWalletRows(ctx))
    .filter(
      (row) => stringField(row, ["wallet_factory_address"], "").toLowerCase() === walletFactory,
    )
    .map(walletFromGovernedWalletRow);
}

function readWalletRows(ctx: ApiContext): Promise<SupabaseRow[]> {
  return sharedRead(ctx, "wallet-population", () => discoverWalletRows(ctx));
}

async function discoverWalletRows(ctx: ApiContext): Promise<SupabaseRow[]> {
  const owner = ownerScope(ctx);
  if (!owner) {
    return [];
  }

  const membership = await readCallerMembership(ctx);

  // Everything in the caller's workspace, plus anything the caller owns
  // directly. The union matters in both directions: a teammate owns none of the
  // workspace's wallets, and an owner from before workspaces existed may hold
  // wallets the read model never filed under an organisation.
  const [orgRows, ownedRows] = await Promise.all([
    membership
      ? selectRowsExhaustive(
          ctx,
          "governed_wallets",
          {
            filters: {
              organization_id: membership.orgId,
            },
            order: "created_at.desc,id.desc",
          },
          { cursorColumn: "created_at", label: "governed_wallets.org.read" },
        )
      : Promise.resolve([] as SupabaseRow[]),
    selectRowsExhaustive(
      ctx,
      "governed_wallets",
      {
        filters: { owner_address: owner },
        order: "created_at.desc,id.desc",
      },
      { cursorColumn: "created_at", label: "governed_wallets.owner.read" },
    ),
  ]);

  const seen = new Set<string>();
  const merged: SupabaseRow[] = [];
  for (const row of [...orgRows, ...scopedRows(ctx, ownedRows)]) {
    const id = stringField(row, ["id"]);
    if (id && seen.has(id)) {
      continue;
    }
    if (id) {
      seen.add(id);
    }
    merged.push(row);
  }

  merged.sort((left, right) =>
    stringField(right, ["created_at"]).localeCompare(stringField(left, ["created_at"])),
  );

  return merged;
}

export async function readSupabaseLegacyWalletCount(ctx: ApiContext) {
  const walletFactory = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();
  const rows = await readWalletRows(ctx);

  const legacyWalletIds = new Set<string>();
  for (const row of rows) {
    if (stringField(row, ["wallet_factory_address"], "").toLowerCase() !== walletFactory) {
      legacyWalletIds.add(
        stringField(
          row,
          ["id"],
          `${stringField(row, ["chain_id"])}:${stringField(row, ["wallet_address"])}`,
        ),
      );
    }
  }
  return legacyWalletIds.size;
}

/**
 * Resolve a governed wallet by its onchain address WITHOUT scoping to the
 * signed-in owner. An escalation approver is often a council member rather than
 * the owner, so the owner-scoped lookup would hide the wallet from them.
 * Callers must enforce their own authorization (owner or onchain signer)
 * before acting on the result.
 */
export async function readSupabaseWalletByAddressUnscoped(ctx: ApiContext, address: string) {
  const walletFactory = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();
  const rows = await selectRows(ctx, "governed_wallets", {
    filters: {
      wallet_address: address.toLowerCase(),
      wallet_factory_address: walletFactory,
    },
    limit: 1,
  });
  const [row] = rows;
  return row ? walletFromGovernedWalletRow(row) : null;
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
  const rows = await agentsForWallets(ctx, wallets);
  return status ? rows.filter((agent) => agent.status === status) : rows;
}

export async function readSupabaseAgentByLooseId(ctx: ApiContext, looseWalletId: string) {
  const normalized = looseWalletId.toLowerCase();
  const wallets = await readSupabaseWallets(ctx);
  const agents = await agentsForWallets(ctx, wallets);

  // An agent is addressable by its own signer address, by its id, or by the
  // governed wallet it spends from (wallet address, wallet id, or label).
  const wallet = wallets.find(
    (item) =>
      item.id === looseWalletId ||
      item.address.toLowerCase() === normalized ||
      item.label.toLowerCase() === normalized,
  );

  return (
    agents.find(
      (agent) =>
        agent.id === looseWalletId ||
        agent.signerAddress.toLowerCase() === normalized ||
        (wallet ? agent.walletId === wallet.id : agent.walletId === looseWalletId),
    ) ?? null
  );
}

/**
 * Agents are the authorized signers recorded on each wallet's doctrine - never
 * the wallet itself. A governed wallet with no authorized signer has no agent,
 * and we say so rather than inventing one from the wallet address.
 */
async function agentsForWallets(ctx: ApiContext, wallets: Wallet[]): Promise<AgentWithDoctrine[]> {
  if (wallets.length === 0) {
    return [];
  }
  const doctrinesByWallet = await currentDoctrinesForWallets(ctx, wallets);
  return wallets.flatMap((wallet) => {
    const current = doctrinesByWallet.get(wallet.id);
    if (!current) {
      return [];
    }

    const posture = postureFromDoctrineRow(current, wallet.frozen);
    return doctrineSigners(current).map((signer) =>
      agentFromSigner(wallet, signer, current, posture),
    );
  });
}

function doctrineSigners(row: SupabaseRow) {
  return arrayField(row, ["signers"])
    .map((signer) => signer.toLowerCase())
    .filter((signer) => signer.startsWith("0x") && signer !== zeroWallet());
}

export async function readSupabaseAgentCounts(ctx: ApiContext) {
  const wallets = await readSupabaseWallets(ctx);
  if (!wallets.length) return { frozen: 0, active: 0 };
  const doctrines = await currentDoctrinesForWallets(ctx, wallets);
  const counts = { frozen: 0, active: 0 };
  for (const wallet of wallets) {
    const doctrine = doctrines.get(wallet.id);
    if (doctrine) {
      counts[wallet.frozen ? "frozen" : "active"] += doctrineSigners(doctrine).length;
    }
  }
  return counts;
}

function currentDoctrinesForWallets(ctx: ApiContext, wallets: Wallet[]) {
  const key = `current-doctrines:${JSON.stringify(wallets.map((wallet) => wallet.id))}`;
  return sharedRead(ctx, key, () => discoverCurrentDoctrines(ctx, wallets));
}

/** The current-schema RPC returns complete doctrine rows, not legacy projections. */
function validateCurrentDoctrine(value: unknown): asserts value is SupabaseRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid current doctrine row.");
  }
  const row = value as SupabaseRow;
  for (const key of ["id", "governed_wallet_id"]) {
    if (
      typeof row[key] !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row[key])
    ) {
      throw new Error(`Invalid current doctrine ${key}.`);
    }
  }
  if (typeof row.version !== "number" || !Number.isSafeInteger(row.version)) {
    throw new Error("Invalid current doctrine version.");
  }
  if (typeof row.updated_at !== "string" || Number.isNaN(new Date(row.updated_at).getTime())) {
    throw new Error("Invalid current doctrine updated_at.");
  }
  for (const key of ["signers", "escalation_council"]) {
    // SQL NULL is a legitimate empty legacy configuration; absent is not.
    if (
      row[key] !== null &&
      (!Array.isArray(row[key]) ||
        !(row[key] as unknown[]).every((item) => item === null || typeof item === "string"))
    ) {
      throw new Error(`Invalid current doctrine ${key}.`);
    }
  }
  for (const key of [
    "per_tx_cap_usdc",
    "daily_cap_usdc",
    "monthly_cap_usdc",
    "escalate_above_usdc",
  ]) {
    if (row[key] !== null && (typeof row[key] !== "number" || !Number.isFinite(row[key]))) {
      throw new Error(`Invalid current doctrine ${key}.`);
    }
  }
  if (
    row.quorum !== null &&
    (typeof row.quorum !== "number" || !Number.isSafeInteger(row.quorum))
  ) {
    throw new Error("Invalid current doctrine quorum.");
  }
  if (typeof row.require_vendor_allowlist !== "boolean") {
    throw new Error("Invalid current doctrine require_vendor_allowlist.");
  }
}

async function discoverCurrentDoctrines(ctx: ApiContext, wallets: Wallet[]) {
  if (!wallets.length) return new Map<string, SupabaseRow>();
  const aggregate = await scopedAnalyticsRpc(ctx, wallets, "scoped_current_doctrines");
  if (aggregate.available) {
    try {
      if (!Array.isArray(aggregate.data)) throw new Error("Invalid current doctrines.");
      const ids = new Set(wallets.map((wallet) => wallet.id));
      const result = new Map<string, SupabaseRow>();
      for (const row of aggregate.data) {
        validateCurrentDoctrine(row);
        const id = stringField(row, ["governed_wallet_id"]);
        if (!ids.has(id) || result.has(id)) throw new Error("Invalid current doctrine identity.");
        result.set(id, row);
      }
      return result;
    } catch (error) {
      throw readModelUnavailable("doctrines.current", error);
    }
  }
  // Fetch only the current doctrine of each wallet the caller owns, rather
  // than reading whole tables and filtering afterwards. Posture is computed
  // from that doctrine, so no profile read is needed here.
  // Doctrines are versioned, so this read is deliberately unbounded: a cap
  // across all wallets would let one busy wallet's history push another
  // wallet's current doctrine out of the window.
  // The exhaustive reader pages by its cursor column, so the wire order must
  // stay on that column; the current doctrine is picked by chain version in
  // memory because `updated_at` says when a row was mirrored, not which
  // policy the wallet enforces.
  const doctrinesByWallet = new Map<string, SupabaseRow>();
  await selectRowsExhaustive(
    ctx,
    "doctrines",
    {
      inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
      order: "updated_at.desc,id.desc",
    },
    {
      cursorColumn: "updated_at",
      label: "doctrines.agents.read",
      onPage(rows) {
        for (const doctrine of rows) {
          const walletId = stringField(doctrine, ["governed_wallet_id"]);
          if (!walletId) continue;
          const current = doctrinesByWallet.get(walletId);
          if (
            !current ||
            numberField(doctrine, ["version"], 0) > numberField(current, ["version"], 0)
          ) {
            doctrinesByWallet.set(walletId, doctrine);
          }
        }
      },
    },
  );

  return doctrinesByWallet;
}

export async function readSupabasePolicy(ctx: ApiContext, wallet: Wallet | null) {
  if (!wallet) {
    return null;
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { governed_wallet_id: wallet.id },
    order: "version.desc",
    limit: 1,
  });

  return rows[0] ? policyFromDoctrineRow(rows[0], wallet) : null;
}

export async function syncSupabaseSignerState(
  ctx: ApiContext,
  input: { signerAddress: `0x${string}`; wallet: Wallet },
): Promise<SupabaseWriteResult<{ signers: `0x${string}`[]; status: string }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("signer state");
  }

  const signerAddress = input.signerAddress.toLowerCase() as `0x${string}`;

  try {
    // Never treat the requested action as proof that the transaction landed.
    // The wallet's owner and signer mapping are the authority, and both are
    // read from chain immediately before changing the eventually-consistent
    // doctrine mirror.
    const authority = await readWalletAuthorityState(
      ctx.publicClient,
      input.wallet.address as `0x${string}`,
      signerAddress,
    );
    const caller = ctx.session?.walletAddress.toLowerCase();
    if (!caller || authority.owner.toLowerCase() !== caller) {
      return {
        ok: false,
        reason: "forbidden",
        message: "Only the current onchain wallet owner can sync signer state.",
      };
    }

    const rows = await client.selectRows("doctrines", {
      filters: { governed_wallet_id: input.wallet.id },
      order: "version.desc",
      limit: 1,
    });
    const existing = rows[0];
    if (!existing) {
      return unavailableWrite(
        "signer state",
        new Error("No doctrine row exists for this governed wallet."),
      );
    }

    const doctrineId = requiredStringField(existing, ["id"], "doctrines.id");
    const currentSigners = arrayField(existing, ["signers"])
      .map((address) => address.toLowerCase())
      .filter((address): address is `0x${string}` => address.startsWith("0x"));
    const nextSigners = authority.signerAuthorized
      ? Array.from(new Set([...currentSigners, signerAddress]))
      : currentSigners.filter((address) => address !== signerAddress);

    await client.patchRows(
      "doctrines",
      {
        signers: nextSigners,
        updated_at: new Date().toISOString(),
      },
      { id: doctrineId },
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

export async function readSupabasePolicies(ctx: ApiContext, wallet: Wallet | null) {
  if (!wallet) {
    return [];
  }

  const rows = await selectRows(ctx, "doctrines", {
    filters: { governed_wallet_id: wallet.id },
    order: "version.desc",
    limit: MAX_DOCTRINE_VERSIONS_PER_WALLET,
  });

  return rows.map((row) => policyFromDoctrineRow(row, wallet));
}

/** Count versions, retaining the exposed per-wallet 500-version contract. */
export async function readSupabasePolicyCount(ctx: ApiContext) {
  const wallets = await readSupabaseWallets(ctx);
  if (!wallets.length) return 0;
  const counts = new Map(wallets.map((wallet) => [wallet.id, 0]));
  await selectRowsExhaustive(
    ctx,
    "doctrines",
    {
      inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
      order: "updated_at.desc,id.desc",
    },
    {
      cursorColumn: "updated_at",
      label: "doctrines.count",
      onPage(rows) {
        for (const row of rows) {
          const id = stringField(row, ["governed_wallet_id"]);
          const count = counts.get(id);
          if (count !== undefined && count < MAX_DOCTRINE_VERSIONS_PER_WALLET) {
            counts.set(id, count + 1);
          }
        }
      },
    },
  );
  return [...counts.values()].reduce((sum, count) => sum + count, 0);
}
