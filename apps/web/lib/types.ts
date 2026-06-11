export type Category = "api" | "compute" | "data" | "subcontracting" | "other";
export type AgentStatus = "fortified" | "watch" | "frozen";
export type LedgerStatus = "approved" | "rejected" | "escalated" | "frozen";
export type PageState = "default" | "loading" | "empty" | "error";

export type Agent = {
  id: string;
  name: string;
  wallet: string;
  owner: string;
  status: AgentStatus;
  posture: number;
  dailySpend: number;
  dailyLimit: number;
  lastActivity: string;
  doctrineVersion: string;
  mandate: string;
  categories: Category[];
};

export type Vendor = {
  id: string;
  name: string;
  address: string;
  category: Category;
  trust: "approved" | "confidential" | "blocked";
  approvedBy: string[];
  confidential: boolean;
  createdAt?: string;
  lastUsed: string;
  walletAddress?: string;
};

export type LedgerEntry = {
  id: string;
  agentId: string;
  agentName: string;
  counterparty: string;
  category: Category;
  action: string;
  amount: number;
  status: LedgerStatus;
  reason: string;
  timestamp: string;
  hash: string;
  block: number;
  gasUsed: string;
  calldata: string;
};

export type Escalation = {
  id: string;
  agentId: string;
  agentName: string;
  wallet: string;
  amount: number;
  counterparty: string;
  category: Category;
  reason: string;
  quorumCurrent: number;
  quorumRequired: number;
  deviation: number;
  expiresAt: string | null;
  expiresIn: string;
  expiryPercent: number;
};

export type Anomaly = {
  id: string;
  agentId: string;
  agentName: string;
  score: number;
  narrative: string;
  suggestedAction: "freeze" | "investigate" | "dismiss";
  points: number[];
  flaggedPoint: number;
  timestamp: string;
};

export type GovernanceEvent = {
  id: string;
  label: string;
  actor: string;
  counterparty: string;
  category: Category;
  amount: number;
  status: LedgerStatus;
  timestamp: string;
  severity: "info" | "success" | "warning" | "danger";
};

export type TeamMember = {
  id: string;
  name: string;
  initials: string;
  email: string;
  role: "admin" | "approver" | "viewer";
  wallet: string;
  status: "active" | "pending";
  lastActive: string;
};
