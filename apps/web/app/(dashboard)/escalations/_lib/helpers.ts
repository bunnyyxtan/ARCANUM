import type { MouseEvent as ReactMouseEvent } from "react";

import type { Escalation } from "@/lib/types";

export function applyEscalationChainUpdate(
  item: Escalation,
  update: { signaturesCount: number; status: Escalation["status"] },
): Escalation {
  return {
    ...item,
    quorumCurrent: update.signaturesCount,
    status: update.status,
    votePending: update.status === "PENDING",
  };
}

export function isTxHashValue(value: string | null | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
}

export function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>): boolean {
  if (event.nativeEvent.isTrusted) return true;
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

export function formatFooterTimestamp(value: string | null): string {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${day} · ${time} UTC`;
}

function escalationDecisionTime(item: Escalation): number {
  const created = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
  if (!Number.isNaN(created)) return created;
  const expires = item.expiresAt ? Date.parse(item.expiresAt) : Number.NaN;
  return Number.isNaN(expires) ? 0 : expires;
}

export function sortResolvedEscalations(items: readonly Escalation[]): Escalation[] {
  return items
    .filter((item) => item.status !== "PENDING")
    .sort(
      (a, b) => escalationDecisionTime(b) - escalationDecisionTime(a) || a.id.localeCompare(b.id),
    );
}
