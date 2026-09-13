import type { Agent, Policy, Wallet } from "@arcanum/db/schema";
import { ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import { readWalletAuthorityState } from "../chain";
import type { ApiContext } from "../context";
import { computePostureScore } from "../posture";
import { readCallerMembership } from "./auth";
import type { SupabaseRow } from "./client";
import {
  type SupabaseWriteResult,
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
import { ownerScope, requiredStringField, rowsForWallets, scopedRows } from "./scope";
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
  const owner = ownerScope(ctx);
  if (!owner) {
    return [];
  }

  const membership = await readCallerMembership(ctx);
  const walletFactory = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();

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
              wallet_factory_address: walletFactory,
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
        filters: { owner_address: owner, wallet_factory_address: walletFactory },
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

  return merged.map(walletFromGovernedWalletRow);
}

export async function readSupabaseLegacyWalletCount(ctx: ApiContext) {
  const owner = ownerScope(ctx);
  if (!owner) {
    return 0;
  }

  const membership = await readCallerMembership(ctx);
  const walletFactory = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();
  const [orgRows, ownedRows] = await Promise.all([
    membership
      ? selectRowsExhaustive(
          ctx,
          "governed_wallets",
          { filters: { organization_id: membership.orgId }, order: "created_at.desc,id.desc" },
          { cursorColumn: "created_at", label: "legacy.governed_wallets.org.read" },
        )
      : Promise.resolve([] as SupabaseRow[]),
    selectRowsExhaustive(
      ctx,
      "governed_wallets",
      { filters: { owner_address: owner }, order: "created_at.desc,id.desc" },
      { cursorColumn: "created_at", label: "legacy.governed_wallets.owner.read" },
    ),
  ]);

  const legacyWalletIds = new Set<string>();
  for (const row of [...orgRows, ...scopedRows(ctx, ownedRows)]) {
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
  const doctrineRows = await selectRowsExhaustive(
    ctx,
    "doctrines",
    {
      inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
      order: "updated_at.desc,id.desc",
    },
    { cursorColumn: "updated_at", label: "doctrines.agents.read" },
  );
  const doctrinesByWallet = new Map<string, SupabaseRow>();
  for (const doctrine of doctrineRows) {
    const walletId = stringField(doctrine, ["governed_wallet_id"]);
    if (!walletId) {
      continue;
    }
    const current = doctrinesByWallet.get(walletId);
    if (!current || numberField(doctrine, ["version"], 0) > numberField(current, ["version"], 0)) {
      doctrinesByWallet.set(walletId, doctrine);
    }
  }

  return wallets.flatMap((wallet) => {
    const current = doctrinesByWallet.get(wallet.id);
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
