export type PolicyInfo = {
  id: string;
  agentId: string;
  spendCapDaily: number;
  spendCapMonthly: number;
  allowedVendors: string[];
  timeWindowStart: string;
  timeWindowEnd: string;
  requireQuorumAbove: number;
};

export const mockPolicies: PolicyInfo[] = [
  {
    id: "pol-100",
    agentId: "ag-100",
    spendCapDaily: 500,
    spendCapMonthly: 15000,
    allowedVendors: ["ven-001", "ven-002", "ven-004", "ven-005"],
    timeWindowStart: "00:00",
    timeWindowEnd: "23:59",
    requireQuorumAbove: 100,
  },
  {
    id: "pol-200",
    agentId: "ag-200",
    spendCapDaily: 2000,
    spendCapMonthly: 60000,
    allowedVendors: ["ven-003", "ven-006", "ven-007"],
    timeWindowStart: "09:00",
    timeWindowEnd: "17:00",
    requireQuorumAbove: 500,
  },
];
