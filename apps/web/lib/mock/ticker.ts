import type { GovernanceEvent } from "@/lib/types";

export const tickerInterval = {
  minMs: 8000,
  maxMs: 12000,
} as const;

const liveEvents: Omit<GovernanceEvent, "id" | "timestamp">[] = [
  {
    label: "Policy envelope allowed API spend",
    actor: "Research Agent",
    counterparty: "OpenAI",
    category: "api",
    amount: 4.2,
    status: "approved",
    severity: "success",
  },
  {
    label: "Vendor registry checkpoint synced",
    actor: "Helix DAO",
    counterparty: "Vendor Registry",
    category: "other",
    amount: 0,
    status: "approved",
    severity: "info",
  },
  {
    label: "Compute spend approached soft threshold",
    actor: "Cloud Ops Agent",
    counterparty: "AWS Bedrock",
    category: "compute",
    amount: 96.2,
    status: "escalated",
    severity: "warning",
  },
];

export function nextTickerDelay(index: number) {
  const span = tickerInterval.maxMs - tickerInterval.minMs;
  return tickerInterval.minMs + ((index * 1703) % span);
}

export function createTickerEvent(index: number): GovernanceEvent {
  const template = liveEvents[index % liveEvents.length];

  if (template === undefined) {
    throw new Error("Ticker has no event templates.");
  }

  const now = new Date();
  const timestamp = now.toISOString().slice(11, 19);

  return {
    ...template,
    id: `live-${now.getTime()}-${index}`,
    timestamp: `${timestamp}Z`,
  };
}
