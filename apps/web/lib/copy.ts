import type { PageState } from "@/lib/types";

export type StateSurface =
  | "dashboard"
  | "agents"
  | "agentDossier"
  | "doctrine"
  | "vendors"
  | "ledger"
  | "escalations"
  | "anomalies"
  | "approver"
  | "explorer"
  | "docs"
  | "settings";

export const systemCopy = {
  state: {
    dashboard: {
      empty: "SURVEILLANCE IDLE. Deploy governed wallets to bring the posture engine online.",
    },
    agents: {
      empty: "REGISTRY VACANT. Deploy your first governed wallet to begin surveillance.",
    },
    agentDossier: {
      empty: "DOSSIER SEALED. No governed wallet matches the requested identifier.",
    },
    doctrine: {
      empty: "DOCTRINE UNWRITTEN. Policy edits require a governed wallet under command.",
    },
    vendors: {
      empty:
        "WHITELIST UNARMED. Doctrine will block all counterparties until approved entries exist.",
    },
    escalations: {
      empty: "QUEUE CLEAR. All agents operating within doctrine.",
    },
    anomalies: {
      empty: "BASELINES STABLE. No behavioral deviation detected across active agents.",
    },
    ledger: {
      empty: "NO EVENTS IN WINDOW. System idle since last block.",
    },
    approver: {
      empty: "APPROVAL CHANNEL QUIET. No pending restraint matches this transaction hash.",
    },
    explorer: {
      empty: "PUBLIC ATTESTATION ABSENT. This wallet has not entered Arcanum governance.",
    },
    docs: {
      empty: "MANUAL SHELF EMPTY. Doctrine references are awaiting publication.",
    },
    settings: {
      empty: "CONTROL ROOM UNSTAFFED. Invite operators before expanding doctrine authority.",
    },
    defaultEmpty: "SURFACE QUIET. No matching records inside the selected surveillance window.",
    error: "ARC-TESTNET DEGRADED. Last verified state: 02:47:18Z. Retrying in {seconds}s.",
    loading: "STATE RECONCILIATION IN PROGRESS. Awaiting indexed Arc blocks.",
  },
  optimistic: {
    releaseReverted: "Release reverted: signature failed. Retry?",
    releaseApproved: "Release approved. Quorum state reconciled.",
    doctrineReverted: "Doctrine save reverted: signature failed. Retry?",
    doctrineSaved: "Doctrine saved. Policy simulator reconciled.",
    vendorReverted: "Vendor insert reverted: registry write failed. Retry?",
    vendorAdded: "Vendor inserted into whitelist.",
    inviteReverted: "Invite reverted: signer attestation failed. Retry?",
    inviteSent: "Invite transmitted to operator.",
    retry: "Retry",
    badgeCopied: "Badge embed copied",
  },
  shortcuts: {
    title: "COMMAND SURFACE",
    description: "Keyboard paths for operators moving under pressure.",
  },
  actions: {
    printReceipt: "PRINT RECEIPT",
    receiptTitle: "ARCANUM TRANSACTION RECEIPT",
    receiptStamp: "ARCANUM VERIFIED",
    receiptSignature: "AUTHORIZED SIGNATURE",
    returnOverview: "RETURN TO OVERVIEW",
  },
  receipt: {
    txHash: "TX HASH",
    agent: "AGENT",
    counterparty: "COUNTERPARTY",
    amount: "AMOUNT",
    status: "POLICY VERDICT",
    block: "BLOCK HEIGHT",
    gas: "GAS USED",
    narrative: "DECISION NARRATIVE",
    calldata: "RAW CALLDATA",
  },
  density: {
    label: "DENSITY",
    comfortable: "COMFORTABLE",
    compact: "COMPACT",
    ultra: "ULTRA-DENSE",
  },
} as const;

export function errorCountdownCopy(seconds: number) {
  return systemCopy.state.error.replace("{seconds}", seconds.toString());
}

export function emptyStateCopy(surface: StateSurface) {
  return systemCopy.state[surface].empty ?? systemCopy.state.defaultEmpty;
}

export function stateTone(state: PageState) {
  if (state === "error") {
    return "hazard";
  }

  if (state === "empty") {
    return "stable";
  }

  return "neutral";
}
