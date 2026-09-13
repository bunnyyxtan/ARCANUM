import type { Anomaly, Escalation } from "@arcanum/db/schema";
import { ARC_CHAIN_ID, ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import { readWalletOwner } from "../chain";
import type { ApiContext } from "../context";
import { readCallerMembership } from "./auth";
import {
  type SupabaseWriteResult,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { dateField, moneyBaseUnits, numberField, stringField } from "./fields";
import {
  anomalyFromRow,
  escalationAmountBaseUnits,
  escalationFromRow,
  escalationStatusFromString,
} from "./mappers";
import { rowsForWallets } from "./scope";
import { selectRows } from "./transport";
import { readSupabaseWallets } from "./wallets";

const MAX_ESCALATIONS_PER_PAGE = 200;
const MAX_ANOMALIES_PER_PAGE = 200;

export async function readSupabaseEscalations(
  ctx: ApiContext,
  status?: Escalation["status"],
  cursor?: { createdAt: string; id: string },
  limit = 50,
) {
  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }
  const rows = await selectRows(ctx, "escalations", {
    inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
    order: "created_at.desc,id.desc",
    limit: Math.min(limit, MAX_ESCALATIONS_PER_PAGE),
    before: cursor,
  });
  const escalations = rowsForWallets(rows, wallets).map((row) => escalationFromRow(row, wallets));
  return status ? escalations.filter((item) => item.status === status) : escalations;
}

export async function readSupabaseEscalationByTxHash(ctx: ApiContext, txHash: string) {
  const rows = await selectRows(ctx, "escalations", {
    filters: { escalation_key: txHash },
    limit: 1,
  });
  const wallets = await readSupabaseWallets(ctx);
  const [row] = rowsForWallets(rows, wallets);
  return row ? escalationFromRow(row, wallets) : null;
}

export async function readSupabasePublicEscalationByKey(ctx: ApiContext, escalationKey: string) {
  const [row] = await selectRows(ctx, "escalations", {
    filters: { escalation_key: escalationKey.toLowerCase() },
    limit: 1,
  });
  const governedWalletId = stringField(row, ["governed_wallet_id"], "");
  if (!row || !governedWalletId) {
    return null;
  }

  const [wallet] = await selectRows(ctx, "governed_wallets", {
    filters: {
      id: governedWalletId,
      chain_id: ARC_CHAIN_ID,
      wallet_factory_address: deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase(),
    },
    limit: 1,
  });
  if (!wallet) {
    return null;
  }

  return {
    escalationKey: stringField(row, ["escalation_key"]),
    walletAddress: stringField(wallet, ["wallet_address"]),
    chainId: numberField(wallet, ["chain_id"]),
    amount: escalationAmountBaseUnits(row),
    amountBaseUnits: escalationAmountBaseUnits(row),
    counterpartyAddress: stringField(row, ["counterparty_address"], ""),
    counterparty: stringField(row, ["counterparty_address", "counterparty_name"]),
    threshold: numberField(row, ["quorum_required"], 1),
    signatureCount: numberField(row, ["approvals_count"], 0),
    expiresAt: dateField(row, ["expires_at"]),
    status: escalationStatusFromString(stringField(row, ["status"], "pending")),
    policyVersion: numberField(row, ["policy_version"], 1),
  };
}

export async function readSupabaseAnomalies(ctx: ApiContext) {
  const wallets = await readSupabaseWallets(ctx);
  if (wallets.length === 0) {
    return [];
  }
  const rows = await selectRows(ctx, "anomalies", {
    inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
    order: "created_at.desc,id.desc",
    limit: MAX_ANOMALIES_PER_PAGE,
  });
  return (
    rowsForWallets(rows, wallets)
      // A dismissed anomaly is settled review state, so it has to stay off the
      // board across a refresh rather than reappearing on the next read.
      .filter((row) => stringField(row, ["status"], "open").toLowerCase() !== "dismissed")
      .map((row) => anomalyFromRow(row, wallets))
  );
}

export type SupabaseAnomalyDecision = "acknowledged" | "dismissed";

// The read model stores anomaly review state as an enum, and "acknowledged" is
// not one of its values: writing it back verbatim fails the whole update.
const ANOMALY_DECISION_STATUS: Record<SupabaseAnomalyDecision, "resolved" | "dismissed"> = {
  acknowledged: "resolved",
  dismissed: "dismissed",
};

/**
 * Record an operator's decision on an anomaly.
 *
 * These decisions used to be written through the Drizzle client, which has no
 * reachable database in production, so acknowledging or dismissing an anomaly
 * failed with a read-model outage error. Supabase is the read model every other
 * surface uses, so the decision is recorded there instead. `data: null` means
 * the anomaly is not visible to this caller, which the router reports as a
 * not-found rather than a silent success.
 */
export async function recordSupabaseAnomalyDecision(
  ctx: ApiContext,
  anomalyId: string,
  decision: SupabaseAnomalyDecision,
  decisionReason: string,
): Promise<SupabaseWriteResult<{ id: string; status: SupabaseAnomalyDecision } | null>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("anomaly decision");
  }

  try {
    const [row] = await client.selectRows("anomalies", {
      filters: { id: anomalyId },
      limit: 1,
    });

    // Scope the write to wallets this caller's organisation owns: an anomaly id
    // from another tenant must read as not-found, never as a successful write.
    const wallets = await readSupabaseWallets(ctx);
    if (!row || rowsForWallets([row], wallets).length === 0) {
      return { ok: true, data: null };
    }

    const walletId = stringField(row, ["governed_wallet_id"], "");
    const wallet = wallets.find((item) => item.id === walletId);
    const caller = ctx.session?.walletAddress.toLowerCase();
    const membership = await readCallerMembership(ctx);
    const chainOwner =
      wallet && caller
        ? (await readWalletOwner(ctx.publicClient, wallet.address as `0x${string}`)).toLowerCase()
        : null;
    const authorized =
      Boolean(wallet && caller && chainOwner === caller) ||
      membership?.role.toLowerCase() === "operator";
    if (!authorized || !caller) {
      return {
        ok: false,
        reason: "forbidden",
        message: "Only the governed wallet owner or an operator can decide an anomaly.",
      };
    }

    // Scope the write by the wallet that was just authorised rather than by id
    // alone. A service-role PATCH bypasses row-level security, so a row that is
    // reassigned or deleted between the check and the write must not be touched
    // on the strength of a check that no longer holds.
    const updated = await client.patchRows(
      "anomalies",
      {
        status: ANOMALY_DECISION_STATUS[decision],
        decided_by: caller,
        decided_at: new Date().toISOString(),
        decision_reason: decisionReason,
        updated_at: new Date().toISOString(),
      },
      walletId ? { id: anomalyId, governed_wallet_id: walletId } : { id: anomalyId },
    );

    // PostgREST reports the rows it actually changed. Anything other than the
    // single expected row means the decision did not land, which the caller has
    // to hear as a miss instead of a success.
    if (!Array.isArray(updated) || updated.length !== 1) {
      return { ok: true, data: null };
    }

    return { ok: true, data: { id: anomalyId, status: decision } };
  } catch (error) {
    warnSupabase("anomaly-decision.write", error);
    return unavailableWrite("anomaly decision", error);
  }
}

/**
 * Persist a policy revision that is already live onchain, so the read model
 * stops advertising caps the wallet no longer enforces.
 */
