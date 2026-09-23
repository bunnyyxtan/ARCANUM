type Row = Record<string, unknown>;

// Keep this list aligned with insert_ledger_event's row comparison. Display-only
// labels and organization attribution are deliberately excluded: mirror edits
// must not invalidate replay. Snapshot enrichment is not event identity either.
export const ledgerImmutableFields = [
  "governed_wallet_id",
  "tx_hash",
  "log_index",
  "event_time",
  "counterparty_address",
  "amount_usdc",
  "status",
  "decision_reason",
  "block_number",
  "chain_id",
  "data_source",
] as const;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

function normalized(field: string, value: unknown): string {
  if (value == null) return "null";
  if (field === "amount_usdc") {
    // Decimal strings, not floats: amounts can exceed Number's safe precision.
    let decimal = String(value);
    const scientific = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(decimal);
    if (scientific) {
      const digits = `${scientific[2]}${scientific[3] ?? ""}`;
      const point = (scientific[2]?.length ?? 0) + Number(scientific[4]);
      if (Math.abs(point) > 1000) throw new Error("[supabase-sync] invalid ledger amount");
      decimal = `${scientific[1]}${
        point <= 0
          ? `0.${"0".repeat(-point)}${digits}`
          : point >= digits.length
            ? `${digits}${"0".repeat(point - digits.length)}`
            : `${digits.slice(0, point)}.${digits.slice(point)}`
      }`;
    }
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimal);
    if (!match) throw new Error("[supabase-sync] invalid ledger amount");
    const whole = (match[2] ?? "").replace(/^0+(?=\d)/, "");
    const fraction = (match[3] ?? "").replace(/0+$/, "");
    return `${whole === "0" && !fraction ? "" : match[1]}${whole}${fraction ? `.${fraction}` : ""}`;
  }
  if (field === "event_time") return new Date(String(value)).toISOString();
  if (["chain_id", "log_index", "block_number"].includes(field))
    return BigInt(String(value)).toString();
  return canonical(value);
}

export function assertIdenticalLedgerEvent(existing: Row, expected: Row): Row {
  if (typeof existing.id !== "string" || !existing.id) {
    throw new Error("[supabase-sync] ledger insert returned no identity");
  }
  for (const field of ledgerImmutableFields) {
    if (normalized(field, existing[field]) !== normalized(field, expected[field])) {
      throw new Error(`[supabase-sync] conflicting immutable ledger event: ${field}`);
    }
  }
  // Only compare known onchain/deployment claims when both rows carry them.
  // Older rows can lack these claims; never turn absence into invented evidence.
  const oldSnapshot = existing.policy_snapshot as Row | null;
  const newSnapshot = expected.policy_snapshot as Row | null;
  for (const key of ["escalationId", "policyVersion", "councilVersion", "deploymentId"]) {
    if (
      oldSnapshot?.[key] != null &&
      newSnapshot?.[key] != null &&
      canonical(oldSnapshot[key]) !== canonical(newSnapshot[key])
    ) {
      throw new Error(`[supabase-sync] conflicting immutable ledger event: policy_snapshot.${key}`);
    }
  }
  return existing;
}
