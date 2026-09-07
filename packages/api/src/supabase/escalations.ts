import type { Anomaly, Escalation } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import {
  type SupabaseWriteResult,
  createSupabaseServiceRoleClient,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { stringField } from "./fields";
import { orgScopedRowsForWallets, rowsForWallets, selectRows } from "./internal";
import { anomalyFromRow, escalationFromRow } from "./mappers";
import { readSupabaseWallets } from "./wallets";

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
    filters: { escalation_key: txHash },
    limit: 1,
  });
  const wallets = await readSupabaseWallets(ctx);
  const [row] = rowsForWallets(rows, wallets);
  return row ? escalationFromRow(row, wallets) : null;
}

export async function readSupabaseAnomalies(ctx: ApiContext) {
  const rows = await selectRows(ctx, "anomalies", {
    order: "score.desc",
  });
  const wallets = await readSupabaseWallets(ctx);
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

    // Scope the write by the wallet that was just authorised rather than by id
    // alone. A service-role PATCH bypasses row-level security, so a row that is
    // reassigned or deleted between the check and the write must not be touched
    // on the strength of a check that no longer holds.
    const walletId = stringField(row, ["governed_wallet_id"], "");
    const updated = await client.patchRows(
      "anomalies",
      {
        status: ANOMALY_DECISION_STATUS[decision],
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
