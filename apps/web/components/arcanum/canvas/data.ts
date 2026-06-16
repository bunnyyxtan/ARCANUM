export const dashboardEvents: readonly [string, string, string, string, string, string, string][] =
  [];
export const agentRows: readonly {
  status: string;
  name: string;
  wallet: string;
  posture: number;
  postureColor: string;
  spend: string;
  limit: string;
  spendWidth: number;
  categories: string[];
  deviation: string;
  doctrine: string;
  last: string;
}[] = [];
export const vendors: readonly [string, string, string, string, string[], boolean, string][] = [];
export const escalations: readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  boolean,
  string,
  string,
][] = [];
export const ledgerRows: readonly [string, string, string, string, string, string][] = [];
export const anomalyRows: readonly {
  agent: string;
  score: string;
  severity: string;
  color: string;
  narrative: string;
  time: string;
  frozen: boolean;
  points: number[];
  flag: number;
}[] = [];
export const teamMembers: readonly [string, string, string, string, string][] = [];
export const dossierEvents: readonly [string, string, string, string, string, string][] = [];
export const topCounterparties: readonly [string, string, string, number][] = [];
