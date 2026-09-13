export type Category = "api" | "compute" | "data" | "subcontracting" | "other";
export type AgentStatus = "fortified" | "watch" | "frozen";
export type LedgerStatus = "approved" | "rejected" | "escalated" | "frozen";
export type PageState = "default" | "loading" | "empty" | "error";

export type Agent = {
  id: string;
  name: string;
  /** Governed wallet address the agent spends from - the identity every route keys on. */
  wallet: string;
  /** Authorized signer key the agent signs with. Never the governed wallet address. */
  signer: string;
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
  trust: "approved" | "confidential" | "blocked" | "removed";
  approvedBy: string[];
  confidential: boolean;
  /** Six-decimal USDC base units; null means the mirror has no cap observation. */
  perVendorCap: string | null;
  createdAt?: string;
  lastUsed: string;
  walletAddress?: string;
};

export type LedgerEntry = {
  id: string;
  agentId: string;
  agentName: string;
  counterparty: string;
  counterpartyAddress: string;
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
  /** Stable read-model wallet row id. Never use this as a contract target. */
  walletId: string;
  /** GovernedWallet contract address used for chain reads/cancellation. */
  walletAddress: string;
  /** Mirrored owner address; action hooks still verify the current chain owner. */
  ownerAddress: string;
  /** Exact USDC base-unit string; do not convert before chain binding. */
  amount: string;
  amountBaseUnits: string;
  counterparty: string;
  counterpartyAddress: string;
  category: Category;
  reason: string;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "EXPIRED" | "DENIED" | "CANCELLED" | "INVALIDATED";
  quorumCurrent: number;
  quorumRequired: number;
  deviation: number;
  createdAt: string | null;
  expiresAt: string | null;
  expiresIn: string;
  expiryPercent: number;
  votePending?: boolean;
};

export type Anomaly = {
  id: string;
  agentId: string;
  agentName: string;
  wallet: string;
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
  // The workspace role exactly as the database holds it. `role` above is the
  // display grouping, which folds owner into admin and would otherwise hide who
  // actually controls the workspace.
  rawRole: string;
  wallet: string;
  status: "active" | "pending";
  lastActive: string;
};
