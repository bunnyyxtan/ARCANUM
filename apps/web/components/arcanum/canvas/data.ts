export const dashboardEvents = [
  ["02:51:02", "RESEARCH-AGENT", "API", "inference call", "OpenAI", "$4.20", "APPROVED"],
  [
    "02:50:44",
    "TREASURY-REBAL",
    "OTHER",
    "rebalance xfer",
    "Internal - Vault",
    "$1,247.00",
    "APPROVED",
  ],
  [
    "02:49:58",
    "DEV-AGENT-01",
    "DATA",
    "data purchase",
    "evil-data-broker.com",
    "$847.00",
    "REJECTED",
  ],
  ["02:49:12", "RESEARCH-AGENT", "CMPT", "gpu lease", "AWS Bedrock", "$73.42", "ESCALATED"],
  ["02:47:55", "DEV-AGENT-01", "API", "model call", "Anthropic", "$312.00", "FROZEN"],
  ["02:48:30", "MARKETING-AGENT", "DATA", "search api", "Tavily", "$2.10", "APPROVED"],
  ["02:47:03", "SUPPORT-AGENT", "API", "inference call", "Anthropic", "$0.80", "APPROVED"],
  ["02:46:21", "RESEARCH-AGENT", "CMPT", "embeddings", "Pinecone", "$1.90", "APPROVED"],
  ["02:45:40", "MARKETING-AGENT", "API", "completion", "Cohere", "$1.40", "APPROVED"],
  ["02:44:18", "TREASURY-REBAL", "OTHER", "gas top-up", "Arc - Gas", "$0.06", "APPROVED"],
] as const;

export const agentRows = [
  {
    status: "ACTIVE",
    name: "RESEARCH-AGENT",
    wallet: "0x4F8C...9A3B7",
    posture: 87,
    postureColor: "#6E9E7C",
    spend: "$342",
    limit: "$500",
    spendWidth: 68,
    categories: ["API", "DATA", "COMPUTE"],
    deviation: "0.3 deviation",
    doctrine: "std-research-v3",
    last: "12s ago",
  },
  {
    status: "ACTIVE",
    name: "MARKETING-AGENT",
    wallet: "0xA12E...D9F4",
    posture: 74,
    postureColor: "#E0A04A",
    spend: "$89",
    limit: "$200",
    spendWidth: 44,
    categories: ["DATA", "API"],
    deviation: "0.8 deviation",
    doctrine: "std-marketing-v2",
    last: "3m ago",
  },
  {
    status: "FROZEN",
    name: "DEV-AGENT-01",
    wallet: "0xC74B...E2A8",
    posture: 12,
    postureColor: "#FF5A1F",
    spend: "$0",
    limit: "$1,000",
    spendWidth: 0,
    categories: [],
    deviation: "7.4 deviation",
    doctrine: "locked-pending-review",
    last: "02:47Z",
  },
  {
    status: "ACTIVE",
    name: "TREASURY-REBALANCER",
    wallet: "0x8E3D...F5C1",
    posture: 80,
    postureColor: "#6E9E7C",
    spend: "$1,247",
    limit: "$5,000",
    spendWidth: 25,
    categories: ["OTHER", "COMPUTE"],
    deviation: "0.2 deviation",
    doctrine: "treasury-strict-v1",
    last: "6m ago",
  },
  {
    status: "ACTIVE",
    name: "SUPPORT-AGENT",
    wallet: "0x2B91...A7E3",
    posture: 91,
    postureColor: "#6E9E7C",
    spend: "$34",
    limit: "$100",
    spendWidth: 34,
    categories: ["API"],
    deviation: "0.1 deviation",
    doctrine: "std-support-v2",
    last: "1m ago",
  },
] as const;

export const vendors = [
  ["OA", "OpenAI", "0x71C7...fE19", "API", ["AC", "RK"], true, "12s ago"],
  ["AN", "Anthropic", "0x4A2B...8C0d", "API", ["AC", "RK", "JM"], true, "44s ago"],
  ["AW", "AWS Bedrock", "0x9Dd4...b71A", "COMPUTE", ["AC"], true, "2m ago"],
  ["TV", "Tavily", "0x3F19...aa52", "DATA", ["RK"], false, "5m ago"],
  ["PC", "Pinecone", "0x6B88...14eC", "COMPUTE", ["AC", "JM"], true, "8m ago"],
  ["CO", "Cohere", "0x22aD...9f31", "API", ["RK"], false, "15m ago"],
  ["CF", "Cloudflare", "0x88E1...07bb", "COMPUTE", ["AC"], false, "31m ago"],
  ["ST", "Stripe", "0x1234...5678", "OTHER", ["AC", "RK"], false, "1h ago"],
  ["GH", "GitHub", "0xAb09...cd44", "SUBCONTRACTING", ["JM"], false, "2h ago"],
  ["VC", "Vercel", "0x77Fa...12dd", "COMPUTE", ["AC"], false, "3h ago"],
  ["MS", "Mistral", "0x5E2c...b8a0", "API", ["RK"], true, "4h ago"],
  ["GQ", "Groq", "0xC0fE...3a19", "API", ["AC", "JM"], false, "6h ago"],
  ["TG", "Together AI", "0x9912...dd7e", "DATA", ["RK"], true, "9h ago"],
  ["MD", "Modal", "0x44Bc...ee21", "SUBCONTRACTING", ["AC"], false, "14h ago"],
  ["DD", "Datadog", "0x6677...aa90", "OTHER", ["JM"], false, "1d ago"],
] as const;

const relativeExpiry = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

export const escalations = [
  [
    "RESEARCH-AGENT",
    "0x4F8C...9A3B7",
    "$73.42",
    "AWS Bedrock",
    "COMPUTE",
    "Exceeds per-vendor daily limit ($50.00). Held for approver review.",
    relativeExpiry(42),
    false,
    "1 / 2",
    "0.3 deviation",
  ],
  [
    "TREASURY-REBAL",
    "0x8E3D...F5C1",
    "$2,400.00",
    "Internal - Vault",
    "OTHER",
    "Single transfer exceeds 40% of daily envelope. Secondary signer required.",
    relativeExpiry(179),
    false,
    "1 / 2",
    "1.1 deviation",
  ],
  [
    "MARKETING-AGENT",
    "0xA12E...D9F4",
    "$180.00",
    "Cohere",
    "API",
    "New counterparty not seen in last 30 days. Velocity +18% above baseline.",
    relativeExpiry(7),
    true,
    "0 / 2",
    "0.8 deviation",
  ],
  [
    "SUPPORT-AGENT",
    "0x2B91...A7E3",
    "$95.50",
    "Tavily",
    "DATA",
    "Per-transaction cap ($50.00) exceeded by 91%. Awaiting first signature.",
    relativeExpiry(74),
    false,
    "0 / 2",
    "0.4 deviation",
  ],
] as const;

const generatedLedger = Array.from({ length: 44 }, (_, index) => {
  const agents = ["RESEARCH-AGENT", "MARKETING-AGENT", "TREASURY-REBAL", "SUPPORT-AGENT"];
  const counterparties = [
    ["OpenAI", "API"],
    ["Anthropic", "API"],
    ["Tavily", "DATA"],
    ["AWS Bedrock", "COMPUTE"],
    ["Pinecone", "COMPUTE"],
    ["Cohere", "API"],
    ["Cloudflare", "COMPUTE"],
    ["GitHub", "SUB"],
    ["Arc - Gas", "OTHER"],
    ["Internal - Vault", "OTHER"],
  ] as const;
  const [counterparty, category] =
    counterparties[index % counterparties.length] ?? counterparties[0];
  const minute = Math.max(0, 46 - Math.floor(index * 0.9));
  const second = (index * 17) % 60;
  const amount = `$${(0.4 + ((index * 11) % 1800) / 100).toFixed(2)}`;

  return [
    `02:${minute.toString().padStart(2, "0")}:${second.toString().padStart(2, "0")}`,
    agents[index % agents.length] ?? agents[0],
    counterparty,
    category,
    amount,
    "APPROVED",
  ] as const;
});

export const ledgerRows = [
  ["02:51:02", "RESEARCH-AGENT", "OpenAI", "API", "$4.20", "APPROVED"],
  ["02:50:44", "TREASURY-REBAL", "Internal - Vault", "OTHER", "$1,247.00", "APPROVED"],
  ["02:49:58", "DEV-AGENT-01", "evil-data-broker.com", "DATA", "$847.00", "REJECTED"],
  ["02:49:12", "RESEARCH-AGENT", "AWS Bedrock", "COMPUTE", "$73.42", "ESCALATED"],
  ["02:47:55", "DEV-AGENT-01", "Anthropic", "API", "$312.00", "FROZEN"],
  ...generatedLedger,
] as const;

export const anomalyRows = [
  {
    agent: "DEV-AGENT-01",
    score: "7.4 deviation",
    severity: "CRITICAL",
    color: "#FF5A1F",
    narrative:
      "DEV-AGENT-01 attempted 47 transactions in 3 minutes - 12x baseline rate - to an unrecognized counterparty (evil-data-broker.com). Largest single transfer $847.00.",
    time: "02:47:12Z",
    frozen: true,
    points: [2, 3, 2, 4, 3, 2, 3, 47],
    flag: 7,
  },
  {
    agent: "MARKETING-AGENT",
    score: "4.2 deviation",
    severity: "ELEVATED",
    color: "#E0A04A",
    narrative:
      "Spend velocity rose +180% over 30-minute window. Three consecutive API calls to a newly added vendor (Cohere) exceeding category cap.",
    time: "02:31:55Z",
    frozen: false,
    points: [5, 6, 5, 7, 6, 9, 14, 11],
    flag: 6,
  },
  {
    agent: "RESEARCH-AGENT",
    score: "3.1 deviation",
    severity: "ELEVATED",
    color: "#E0A04A",
    narrative:
      "Compute spend reached 85% of daily envelope by 02:00Z - 2.4x the trailing 7-day pace for this hour. No vendor anomaly detected.",
    time: "02:12:04Z",
    frozen: false,
    points: [8, 9, 8, 10, 12, 15, 18, 16],
    flag: 5,
  },
] as const;

export const teamMembers = [
  ["Ranbir Kapoor", "RK", "ranbir@acme.capital", "ADMIN", "active now"],
  ["Aisha Chen", "AC", "aisha@acme.capital", "ADMIN", "12m ago"],
  ["Marcus Webb", "MW", "marcus@acme.capital", "ADMIN", "1h ago"],
  ["Julia Moreno", "JM", "julia@acme.capital", "APPROVER", "34m ago"],
  ["Devin Park", "DP", "devin@acme.capital", "APPROVER", "2h ago"],
  ["Sara Okafor", "SO", "sara@acme.capital", "APPROVER", "5h ago"],
  ["Tomas Riedel", "TR", "tomas@acme.capital", "VIEWER", "1d ago"],
  ["Nadia Volkov", "NV", "nadia@acme.capital", "VIEWER", "3d ago"],
] as const;

export const dossierEvents = [
  ["02:51:02", "API", "inference call", "OpenAI", "$4.20", "APPROVED"],
  ["02:49:12", "CMPT", "gpu lease", "AWS Bedrock", "$73.42", "ESCALATED"],
  ["02:46:21", "CMPT", "embeddings", "Pinecone", "$1.90", "APPROVED"],
  ["02:40:11", "API", "completion", "Cohere", "$1.20", "APPROVED"],
  ["02:31:08", "DATA", "search api", "Tavily", "$2.10", "APPROVED"],
  ["02:22:54", "API", "inference call", "OpenAI", "$3.80", "APPROVED"],
  ["02:10:30", "API", "inference call", "Anthropic", "$0.90", "APPROVED"],
] as const;

export const topCounterparties = [
  ["OpenAI", "$3,120", "412tx", 76],
  ["AWS Bedrock", "$2,090", "88tx", 58],
  ["Anthropic", "$1,540", "506tx", 42],
  ["Tavily", "$1,210", "199tx", 31],
] as const;
