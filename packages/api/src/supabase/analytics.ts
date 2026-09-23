import type { ApiContext } from "../context";
import { readModelUnavailable } from "./client";
import { stringField } from "./fields";
import { anomalySeverityFromString, transferFactsFromRow } from "./mappers";
import { rowsForWalletIdentity, rowsForWallets } from "./scope";
import { aggregateCount, aggregateMoney, scopedAnalyticsRpc } from "./scoped-analytics";
import { sharedRead } from "./snapshot";
import { selectRowsExhaustive } from "./transport";
import { readSupabaseWallets } from "./wallets";

type LedgerSummary = {
  since: Date;
  until: Date;
  total: number;
  denied: number;
  blocked24h: number;
  movementCount: number;
  valueBaseUnits: bigint;
  activity: Map<string, { spendBaseUnits: bigint; lastActivityAt: Date | null }>;
};
type PendingLedger = {
  allTime: boolean;
  started: boolean;
  promise: Promise<LedgerSummary>;
};
const ledgerReads = new WeakMap<ApiContext, PendingLedger>();

/**
 * Share one scoped SQL aggregate among overlapping analytics readers. A daily
 * request alone stays bounded by event_time; posture/activity promote a scan
 * before it starts. No positive authorization survives the request or read.
 * Old schemas need a full scan for all-time counts/latest activity, but pages
 * are reduced immediately rather than retaining/mapping an entire history.
 */
export function readLedgerSummary(ctx: ApiContext, allTime = false): Promise<LedgerSummary> {
  const existing = ledgerReads.get(ctx);
  if (existing && (!allTime || existing.allTime || !existing.started)) {
    existing.allTime ||= allTime;
    return existing.promise;
  }
  const pending: PendingLedger = {
    allTime,
    started: false,
    promise: Promise.resolve()
      .then(async () => {
        const wallets = await readSupabaseWallets(ctx);
        pending.started = true;
        const until = new Date();
        const since = new Date(until.getTime() - 86_400_000);
        const summary: LedgerSummary = {
          since,
          until,
          total: 0,
          denied: 0,
          blocked24h: 0,
          movementCount: 0,
          valueBaseUnits: 0n,
          activity: new Map(),
        };
        if (!wallets.length) return summary;
        const aggregate = await scopedAnalyticsRpc(ctx, wallets, "scoped_ledger_analytics", {
          p_since: since.toISOString(),
          p_until: until.toISOString(),
          p_all_time: pending.allTime,
        });
        if (aggregate.available) {
          try {
            const data = aggregate.data as Record<string, unknown>;
            summary.total = aggregateCount(data.total);
            summary.denied = aggregateCount(data.denied);
            summary.blocked24h = aggregateCount(data.blocked24h);
            summary.movementCount = aggregateCount(data.movementCount);
            summary.valueBaseUnits = aggregateMoney(data.valueBaseUnits);
            if (!Array.isArray(data.activity)) throw new Error("Missing analytics activity.");
            const ids = new Set(wallets.map((wallet) => wallet.id));
            for (const row of data.activity) {
              if (!row || !ids.has(row.walletId) || summary.activity.has(row.walletId)) {
                throw new Error("Invalid analytics wallet identity.");
              }
              const timestamp =
                typeof row.lastActivityAt === "string" ? new Date(row.lastActivityAt) : null;
              if (!timestamp || Number.isNaN(timestamp.getTime())) {
                throw new Error("Invalid analytics timestamp.");
              }
              summary.activity.set(row.walletId, {
                spendBaseUnits: aggregateMoney(row.spendBaseUnits),
                lastActivityAt: timestamp,
              });
            }
            return summary;
          } catch (error) {
            throw readModelUnavailable("ledger_events.analytics", error);
          }
        }
        // OLD-SCHEMA only: the exact missing RPC signature was established above.
        await selectRowsExhaustive(
          ctx,
          "ledger_events",
          {
            inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
            gte: pending.allTime ? undefined : { event_time: since.toISOString() },
            lte: pending.allTime ? undefined : { event_time: until.toISOString() },
            order: "event_time.desc,id.desc",
          },
          {
            cursorColumn: "event_time",
            label: "ledger_events.analytics",
            onPage(rows) {
              for (const row of rowsForWalletIdentity(rows, wallets)) {
                // Use the existing mapper: legacy status aliases, timestamps and
                // decimal/base-unit behavior are part of the public contract.
                const transfer = transferFactsFromRow(row, wallets);
                summary.total++;
                if (transfer.verdict === "DENY") summary.denied++;
                const activity = summary.activity.get(transfer.walletId) ?? {
                  spendBaseUnits: 0n,
                  lastActivityAt: null,
                };
                if (!activity.lastActivityAt || transfer.timestamp > activity.lastActivityAt) {
                  activity.lastActivityAt = transfer.timestamp;
                }
                if (transfer.timestamp >= since && transfer.timestamp <= until) {
                  if (transfer.verdict === "ALLOW") {
                    const amount = BigInt(transfer.amount || "0");
                    activity.spendBaseUnits += amount;
                    summary.valueBaseUnits += amount;
                    summary.movementCount++;
                  }
                  if (transfer.verdict === "DENY" || transfer.verdict === "FREEZE") {
                    summary.blocked24h++;
                  }
                }
                summary.activity.set(transfer.walletId, activity);
              }
            },
          },
        );
        return summary;
      })
      .finally(() => {
        if (ledgerReads.get(ctx) === pending) ledgerReads.delete(ctx);
      }),
  };
  ledgerReads.set(ctx, pending);
  return pending.promise;
}

export function readAnomalyCounts(ctx: ApiContext) {
  return sharedRead(ctx, "anomaly-counts", async () => {
    const wallets = await readSupabaseWallets(ctx);
    const counts = { total: 0, danger: 0 };
    if (!wallets.length) return counts;
    const aggregate = await scopedAnalyticsRpc(ctx, wallets, "scoped_anomaly_counts");
    if (aggregate.available) {
      try {
        const data = aggregate.data as Record<string, unknown>;
        return { total: aggregateCount(data.total), danger: aggregateCount(data.danger) };
      } catch (error) {
        throw readModelUnavailable("anomalies.count", error);
      }
    }
    await selectRowsExhaustive(
      ctx,
      "anomalies",
      {
        inFilters: { governed_wallet_id: wallets.map((wallet) => wallet.id) },
        order: "created_at.desc,id.desc",
      },
      {
        cursorColumn: "created_at",
        label: "anomalies.count",
        onPage(rows) {
          for (const row of rowsForWallets(rows, wallets)) {
            if (stringField(row, ["status"], "open").toLowerCase() === "dismissed") continue;
            counts.total++;
            if (anomalySeverityFromString(stringField(row, ["severity"], "low")) === "danger") {
              counts.danger++;
            }
          }
        },
      },
    );
    return counts;
  });
}
