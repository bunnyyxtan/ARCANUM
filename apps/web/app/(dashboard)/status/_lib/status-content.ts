export const healthCardContent = [
  {
    key: "indexer",
    index: 1,
    label: "EVENT SYNC",
    detail:
      "Onchain history is synced for governed wallets. Freshness is confirmed only after a complete catch-up, not by event activity alone.",
  },
  {
    key: "readModel",
    index: 2,
    label: "RECORDS",
    detail: "Workspace records are stored off-chain so the dashboard can answer quickly.",
  },
  {
    key: "rpc",
    index: 3,
    label: "ARC RPC",
    detail: "The Arc endpoint is answering signed read requests.",
  },
] as const;

export const statusGuideParagraphs = [
  "Workspace records are stored off-chain so the dashboard can answer quickly. Event progress and a confirmed full catch-up are tracked separately.",
  "Fresh wallets may show no recorded activity until their first transactions are picked up. That is expected, not a missing policy decision.",
] as const;
