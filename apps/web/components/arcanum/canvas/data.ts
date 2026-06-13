export const dashboardEvents = [
  [
    "12:05:00",
    "TREASURY GUARD AGENT",
    "OTHER",
    "treasury request",
    "Stripe Treasury Sandbox",
    "$500.00",
    "REJECTED",
  ],
  [
    "11:31:00",
    "SECURITY MONITOR AGENT",
    "OTHER",
    "edge security",
    "Cloudflare",
    "$12.00",
    "APPROVED",
  ],
  ["11:08:00", "CLOUD OPS AGENT", "CMPT", "compute burst", "AWS Bedrock", "$96.20", "ESCALATED"],
  ["10:46:00", "RESEARCH AGENT", "API", "model inference", "Anthropic", "$64.80", "APPROVED"],
  ["10:15:00", "MARKET INTEL AGENT", "DATA", "research query", "Perplexity", "$42.75", "APPROVED"],
  ["09:42:00", "RESEARCH AGENT", "API", "model inference", "OpenAI", "$18.40", "APPROVED"],
  [
    "09:18:00",
    "CLOUD OPS AGENT",
    "CMPT",
    "gateway compute",
    "Vercel AI Gateway",
    "$128.30",
    "APPROVED",
  ],
  [
    "08:54:00",
    "SECURITY MONITOR AGENT",
    "OTHER",
    "edge posture",
    "Cloudflare",
    "$12.00",
    "APPROVED",
  ],
  ["08:30:00", "RESEARCH AGENT", "API", "model inference", "OpenAI", "$42.95", "APPROVED"],
  ["08:10:00", "MARKET INTEL AGENT", "DATA", "market brief", "Perplexity", "$65.00", "APPROVED"],
] as const;

export const agentRows = [
  {
    status: "ACTIVE",
    name: "RESEARCH AGENT",
    wallet: "0x4F8C...9A3B7",
    posture: 95,
    postureColor: "#6E9E7C",
    spend: "$126.15",
    limit: "$750",
    spendWidth: 17,
    categories: ["API", "DATA"],
    deviation: "0.4 deviation",
    doctrine: "research-guard-v4",
    last: "10:46Z",
  },
  {
    status: "ACTIVE",
    name: "CLOUD OPS AGENT",
    wallet: "0xA12E...D9F4",
    posture: 91,
    postureColor: "#6E9E7C",
    spend: "$128.30",
    limit: "$1,200",
    spendWidth: 11,
    categories: ["COMPUTE", "API"],
    deviation: "1.8 deviation",
    doctrine: "cloud-ops-strict-v2",
    last: "11:08Z",
  },
  {
    status: "ACTIVE",
    name: "MARKET INTEL AGENT",
    wallet: "0xC74B...E2A8",
    posture: 93,
    postureColor: "#6E9E7C",
    spend: "$107.75",
    limit: "$600",
    spendWidth: 18,
    categories: ["DATA", "API"],
    deviation: "0.7 deviation",
    doctrine: "market-intel-v3",
    last: "10:15Z",
  },
  {
    status: "FROZEN",
    name: "TREASURY GUARD AGENT",
    wallet: "0x8E3D...F5C1",
    posture: 78,
    postureColor: "#E0A04A",
    spend: "$0.00",
    limit: "$1,500",
    spendWidth: 0,
    categories: ["TREASURY"],
    deviation: "4.8 deviation",
    doctrine: "treasury-guard-v2",
    last: "12:05Z",
  },
  {
    status: "ACTIVE",
    name: "SECURITY MONITOR AGENT",
    wallet: "0x2B91...A7E3",
    posture: 96,
    postureColor: "#6E9E7C",
    spend: "$24.00",
    limit: "$300",
    spendWidth: 8,
    categories: ["SECURITY", "INFRA"],
    deviation: "0.2 deviation",
    doctrine: "security-monitor-v3",
    last: "11:31Z",
  },
] as const;

export const vendors = [
  ["OA", "OpenAI", "0x71C7...fE19", "API", ["MR", "EC"], false, "09:42Z"],
  ["AN", "Anthropic", "0x4A2B...8C0d", "API", ["MR", "EC"], false, "10:46Z"],
  ["AW", "AWS Bedrock", "0x9Dd4...b71A", "COMPUTE", ["MR", "NP"], true, "11:08Z"],
  ["CF", "Cloudflare", "0x88E1...07bb", "OTHER", ["EC"], false, "11:31Z"],
  ["PX", "Perplexity", "0x3F19...aa52", "DATA", ["NP"], false, "10:15Z"],
  ["ST", "Stripe Treasury Sandbox", "0x1234...5678", "OTHER", ["MR", "EC", "NP"], false, "12:05Z"],
  ["VA", "Vercel AI Gateway", "0x77Fa...12dd", "COMPUTE", ["MR"], false, "09:18Z"],
] as const;

const relativeExpiry = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export const escalations = [
  [
    "CLOUD OPS AGENT",
    "0xA12E...D9F4",
    "$96.20",
    "AWS Bedrock",
    "COMPUTE",
    "Compute request exceeds the per-transaction threshold. Held for human approval.",
    relativeExpiry(42),
    false,
    "1 / 2",
    "1.8 deviation",
  ],
] as const;

export const ledgerRows = [
  ["12:05:00", "TREASURY GUARD AGENT", "Stripe Treasury Sandbox", "OTHER", "$500.00", "REJECTED"],
  ["11:31:00", "SECURITY MONITOR AGENT", "Cloudflare", "OTHER", "$12.00", "APPROVED"],
  ["11:08:00", "CLOUD OPS AGENT", "AWS Bedrock", "COMPUTE", "$96.20", "ESCALATED"],
  ["10:46:00", "RESEARCH AGENT", "Anthropic", "API", "$64.80", "APPROVED"],
  ["10:15:00", "MARKET INTEL AGENT", "Perplexity", "DATA", "$42.75", "APPROVED"],
  ["09:42:00", "RESEARCH AGENT", "OpenAI", "API", "$18.40", "APPROVED"],
  ["09:18:00", "CLOUD OPS AGENT", "Vercel AI Gateway", "COMPUTE", "$128.30", "APPROVED"],
  ["08:54:00", "SECURITY MONITOR AGENT", "Cloudflare", "OTHER", "$12.00", "APPROVED"],
  ["08:30:00", "RESEARCH AGENT", "OpenAI", "API", "$42.95", "APPROVED"],
  ["08:10:00", "MARKET INTEL AGENT", "Perplexity", "DATA", "$65.00", "APPROVED"],
] as const;

export const anomalyRows = [
  {
    agent: "TREASURY GUARD AGENT",
    score: "4.8 deviation",
    severity: "CRITICAL",
    color: "#FF5A1F",
    narrative:
      "A treasury request targeted an unapproved destination outside the configured allowlist. The request was rejected and the agent was placed under restraint.",
    time: "12:05:00Z",
    frozen: true,
    points: [1.2, 1.4, 1.1, 1.8, 2.2, 2.0, 2.4, 4.8],
    flag: 7,
  },
  {
    agent: "CLOUD OPS AGENT",
    score: "1.8 deviation",
    severity: "ELEVATED",
    color: "#E0A04A",
    narrative:
      "Compute velocity crossed the soft threshold during a deployment window. The payment was escalated for human review before execution.",
    time: "11:08:00Z",
    frozen: false,
    points: [0.6, 0.7, 0.8, 0.9, 1.0, 1.3, 1.8, 1.5],
    flag: 6,
  },
  {
    agent: "MARKET INTEL AGENT",
    score: "0.7 deviation",
    severity: "NOMINAL",
    color: "#6E9E7C",
    narrative:
      "Data-service usage remains within the configured research envelope and approved vendor allowlist.",
    time: "10:15:00Z",
    frozen: false,
    points: [0.4, 0.5, 0.4, 0.6, 0.5, 0.7, 0.6, 0.7],
    flag: 7,
  },
] as const;

export const teamMembers = [
  ["Maya Rao", "MR", "maya@arcanum.demo", "ADMIN", "active now"],
  ["Elias Chen", "EC", "elias@arcanum.demo", "APPROVER", "8m ago"],
  ["Nora Patel", "NP", "nora@arcanum.demo", "APPROVER", "24m ago"],
] as const;

export const dossierEvents = [
  ["10:46:00", "API", "model inference", "Anthropic", "$64.80", "APPROVED"],
  ["09:42:00", "API", "model inference", "OpenAI", "$18.40", "APPROVED"],
  ["08:30:00", "API", "model inference", "OpenAI", "$42.95", "APPROVED"],
  ["07:55:00", "DATA", "research brief", "Perplexity", "$36.25", "APPROVED"],
  ["07:20:00", "API", "model inference", "Anthropic", "$28.10", "APPROVED"],
] as const;

export const topCounterparties = [
  ["OpenAI", "$2,430.20", "286tx", 100],
  ["AWS Bedrock", "$1,986.40", "94tx", 82],
  ["Anthropic", "$1,648.75", "218tx", 68],
  ["Perplexity", "$1,120.25", "143tx", 46],
  ["Cloudflare", "$657.00", "61tx", 27],
] as const;
