import type {
  Agent,
  Anomaly,
  Escalation,
  Event,
  Policy,
  Transfer,
  User,
  Vendor,
  Wallet,
} from "@arcanum/db/schema";

export const fallbackOrgId = "";

export const demoMetrics = {
  activeAgents: 0,
  pendingEscalations: 0,
  postureIndex: 0,
  threatsBlocked30d: 0,
  valueGoverned: "0",
} as const;

export const demoSignerAddresses: readonly string[] = [];
export const fallbackWallets: readonly {
  id: string;
  label: string;
  address: string;
  ownerAddress: string;
  frozen: boolean;
}[] = [];

export const fallbackAgents: Agent[] = [];
export const fallbackVendors: Array<Vendor & { name: string; kycStatus: "public" | "arcanevm" }> =
  [];
export const fallbackPolicies: Array<Policy & { doctrineStatus: string; signers: string[] }> = [];
export const fallbackTransfers: Transfer[] = [];
export const fallbackEscalations: Escalation[] = [];
export const fallbackAnomalies: Anomaly[] = [];
export const fallbackEvents: Event[] = [];
export const fallbackMembers: User[] = [];

export function walletAddressForId(walletId: string | null | undefined) {
  return walletId ?? "";
}

export function agentNameForId(agentId: string | null | undefined) {
  return "Agent";
}

export function vendorNameForAddress(address: string | null | undefined) {
  return address ?? "";
}

export const fallbackWalletRows: Wallet[] = [];
