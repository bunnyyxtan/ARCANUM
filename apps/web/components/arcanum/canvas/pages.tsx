"use client";

import { arcTestnet } from "@arcanum/shared";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Ban,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  Copy,
  EllipsisVertical,
  ExternalLink,
  Eye,
  Flag,
  Github,
  Info,
  Lock,
  LockOpen,
  Minus,
  Play,
  Plug,
  Plus,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  SlidersHorizontal,
  Snowflake,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Webhook,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { toast } from "sonner";
import {
  formatUnits,
  isAddress as isViemAddress,
  keccak256,
  parseEventLogs,
  parseUnits,
  toBytes,
} from "viem";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { GlossaryTermInline } from "@/components/arcanum/GlossaryTooltip";
import {
  agentRows,
  anomalyRows,
  dashboardEvents,
  dossierEvents,
  escalations,
  ledgerRows,
  teamMembers,
  topCounterparties,
  vendors,
} from "@/components/arcanum/canvas/data";
import {
  CategoryBars,
  CategoryTick,
  CopyIcon,
  CornerMarks,
  Gauge,
  GovernanceFooter,
  GovernanceFrame,
  HazardStripe,
  PanelHeader,
  ProgressLine,
  RowShell,
  StatTile,
  StatusLabel,
  categoryColors,
} from "@/components/arcanum/canvas/ui";
import { useCountdownState } from "@/components/arcanum/canvas/useCountdownLabel";
import { getArcscanAddressUrl, getArcscanTxUrl } from "@/lib/arcscan";
import { useWorkspaceMode } from "@/lib/auth-session";
import {
  isConfiguredAddress,
  isEvmAddress,
  isSameAddress,
  isZeroAddress,
  shortAddress,
} from "@/lib/format/address";
import { formatUsdCompact, usdcNumber } from "@/lib/format/money";
import { formatDeviation } from "@/lib/format/risk";
import {
  useLiveAgents,
  useLiveAnomalies,
  useLiveDashboardMetrics,
  useLiveEscalations,
  useLiveLedger,
  useLiveLedgerByWallet,
  useLiveMembers,
  useLiveVendors,
} from "@/lib/live-data";
import { MotionButton, MotionDiv, MotionMain } from "@/lib/motion-elements";
import { enterFade, enterRise, hoverLift, useReducedMotion } from "@/lib/motion/motion-config";
import { configuredPublicOrigin } from "@/lib/public-url";
import { matchesSearch, normalizeSearch } from "@/lib/table-state";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { getSettingsWorkspaceSummary, getWorkspaceEmptyCopy } from "@/lib/workspace-labels";

const iconStroke = 1.75;

function workspaceFileRoot(workspace: Pick<ReturnType<typeof useWorkspaceMode>, "isDemo">) {
  return workspace.isDemo ? "FILE / ACME-CAPITAL" : "FILE / ARCANUM";
}

type AgentDisplay = {
  id?: string;
  status: string;
  name: string;
  wallet: string;
  fullWallet?: string;
  posture: number;
  postureColor: string;
  spend: string;
  limit: string;
  spendWidth: number;
  categories: readonly string[];
  deviation: string;
  doctrine: string;
  last: string;
};
type VendorDisplayMeta = {
  createdAt?: string;
  id?: string;
  lastUsed?: string;
  note?: string;
  status?: "approved" | "blocked" | "confidential";
  walletAddress?: string;
};
type VendorDisplay = readonly [
  string,
  string,
  string,
  string,
  readonly string[],
  boolean,
  string,
  VendorDisplayMeta?,
];
type LedgerDisplay = readonly [string, string, string, string, string, string, string?];
type EscalationDisplay = readonly [
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
  string?,
];
type AnomalyDisplay = {
  id?: string;
  agent: string;
  score: string;
  severity: string;
  color: string;
  narrative: string;
  time: string;
  frozen: boolean;
  points: readonly number[];
  flag: number;
};
type TeamDisplay = (typeof teamMembers)[number];

const zeroEvmAddress = "0x0000000000000000000000000000000000000000" as const;

// GuardedWallet exposes a non-enumerable signer mapping, so saved candidates must be verified.
function signerCandidatesFromPolicy(policy: unknown): Address[] {
  const signers =
    policy &&
    typeof policy === "object" &&
    "signers" in policy &&
    Array.isArray((policy as { signers?: unknown }).signers)
      ? ((policy as { signers: unknown[] }).signers ?? [])
      : [];

  const normalized = signers
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is Address => isEvmAddress(value) && !isZeroAddress(value));

  return Array.from(new Set(normalized));
}

const fallbackEscalationHash = "0xeeee000000000000000000000000000000000000000000000000000000000001";
const fallbackAnomalyId = "70000000-0000-4000-8000-000000000001";
const sampleAgentWallet = "0x4F8C39A7D2B1E84F3aF20a91dDb83a7B7A4eA3B7";
const walletAlias: Record<string, string> = {
  "0x2B91...A7E3": "0x2b9100000000000000000000000000000000a7e3",
  "0x4F8C...9A3B7": "0x4f8c39a7d2b1e84f3af20a91ddb83a7b7a4ea3b7",
  "0x8E3D...F5C1": "0x8e3d00000000000000000000000000000000f5c1",
  "0xA12E...D9F4": "0xa12e00000000000000000000000000000000d9f4",
  "0xC74B...E2A8": "0xc74b00000000000000000000000000000000e2a8",
};
const deployedContracts = [
  { label: "WalletFactory", value: process.env.NEXT_PUBLIC_WALLET_FACTORY },
  { label: "PolicyEngine", value: process.env.NEXT_PUBLIC_POLICY_ENGINE },
  { label: "EscalationManager", value: process.env.NEXT_PUBLIC_ESCALATION_MANAGER },
  { label: "AnomalyOracle", value: process.env.NEXT_PUBLIC_ANOMALY_ORACLE },
  { label: "VendorRegistry", value: process.env.NEXT_PUBLIC_VENDOR_REGISTRY },
] as const;
const walletFactoryAbi = [
  {
    type: "function",
    name: "createWallet",
    inputs: [
      { name: "owner", type: "address" },
      { name: "label", type: "string" },
      {
        name: "initialPolicy",
        type: "tuple",
        components: [
          { name: "perTxCap", type: "uint256" },
          { name: "daily24hCap", type: "uint256" },
          { name: "monthlyRollingCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
        ],
      },
      { name: "initialSigners", type: "address[]" },
      { name: "escalationCouncil", type: "address[]" },
      { name: "escalationThreshold", type: "uint8" },
    ],
    outputs: [{ name: "wallet", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "predictWallet",
    inputs: [
      { name: "owner", type: "address" },
      { name: "label", type: "string" },
      { name: "nonce", type: "uint256" },
      {
        name: "initialPolicy",
        type: "tuple",
        components: [
          { name: "perTxCap", type: "uint256" },
          { name: "daily24hCap", type: "uint256" },
          { name: "monthlyRollingCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
        ],
      },
      { name: "initialSigners", type: "address[]" },
      { name: "escalationCouncil", type: "address[]" },
      { name: "escalationThreshold", type: "uint8" },
    ],
    outputs: [{ name: "predicted", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "WalletCreated",
    inputs: [
      { name: "wallet", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "label", type: "string", indexed: false },
      { name: "timestamp", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;
const guardedWalletControlAbi = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "owner", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "agentSigners",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [{ name: "authorized", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "policy",
    inputs: [],
    outputs: [
      { name: "perTxCap", type: "uint256" },
      { name: "daily24hCap", type: "uint256" },
      { name: "monthlyRollingCap", type: "uint256" },
      { name: "allowedCategories", type: "uint256" },
      { name: "escalationThreshold", type: "uint256" },
      { name: "requireAllowlist", type: "bool" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "anomalyFreezeThresholdBps",
    inputs: [],
    outputs: [{ name: "thresholdBps", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "setPolicy",
    inputs: [
      {
        name: "nextPolicy",
        type: "tuple",
        components: [
          { name: "perTxCap", type: "uint256" },
          { name: "daily24hCap", type: "uint256" },
          { name: "monthlyRollingCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addSigner",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeSigner",
    inputs: [{ name: "signer", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "addVendor",
    inputs: [
      { name: "vendor", type: "address" },
      { name: "category", type: "uint8" },
      { name: "perVendorCap", type: "uint256" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "blockVendor",
    inputs: [{ name: "vendor", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "removeVendor",
    inputs: [{ name: "vendor", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;
const escalationManagerAbi = [
  {
    type: "function",
    name: "approve",
    inputs: [{ name: "escalationId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "reject",
    inputs: [{ name: "escalationId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getEscalation",
    inputs: [{ name: "escalationId", type: "bytes32" }],
    outputs: [
      { name: "wallet", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "bytes" },
      { name: "createdAt", type: "uint256" },
      { name: "expiresAt", type: "uint256" },
      { name: "threshold", type: "uint256" },
      { name: "signaturesCount", type: "uint8" },
      { name: "status", type: "uint8" },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isRequiredSigner",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "required", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "signed",
    inputs: [
      { name: "escalationId", type: "bytes32" },
      { name: "signer", type: "address" },
    ],
    outputs: [{ name: "hasSigned", type: "bool" }],
    stateMutability: "view",
  },
] as const;
const escalationStatusLabels = ["PENDING", "EXECUTED", "REJECTED", "EXPIRED"] as const;

const allPolicyCategoriesMask = 31n;

type DeployWalletFormState = {
  label: string;
  perTxCap: string;
  dailyCap: string;
  monthlyCap: string;
  escalationAmount: string;
  signerAddresses: string;
  councilAddresses: string;
  quorum: string;
  requireAllowlist: boolean;
};

type CreatedWalletResult = {
  wallet: Address;
  txHash: Hash;
  label: string;
  perTxCap: string;
  dailyCap: string;
  monthlyCap: string;
  escalationThreshold: string;
  requireAllowlist: boolean;
};

type CreatedWalletSyncInput = {
  walletAddress: Address;
  ownerAddress: Address;
  label: string;
  deployTxHash: Hash;
  chainId: number;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  requireAllowlist: boolean;
  signers: Address[];
  council: Address[];
  quorum: number;
};

const initialDeployWalletForm: DeployWalletFormState = {
  label: "Governed Wallet",
  perTxCap: "100",
  dailyCap: "1000",
  monthlyCap: "30000",
  escalationAmount: "50",
  signerAddresses: "",
  councilAddresses: "",
  quorum: "1",
  requireAllowlist: true,
};
const arcanumSelectClassName =
  "h-9 w-full appearance-none border border-[#3A4250] bg-[#101216] px-3 pr-8 text-[12px] text-[#EDF0F3] outline-none focus:border-[#FF5A1F] disabled:cursor-not-allowed disabled:opacity-50";
const vendorGridClass =
  "grid grid-cols-[minmax(220px,1.15fr)_minmax(150px,0.72fr)_minmax(120px,0.55fr)_minmax(124px,0.6fr)_minmax(132px,0.58fr)_minmax(116px,0.5fr)_40px]";
const vendorCategoryOptions = [
  { label: "API", value: "api" },
  { label: "COMPUTE", value: "compute" },
  { label: "DATA", value: "data" },
  { label: "SUBCONTRACTING", value: "subcontracting" },
  { label: "OTHER", value: "other" },
] as const;
const doctrineCategoryOptions = [
  { label: "API", value: "API", defaultEnabled: true },
  { label: "DATA", value: "DATA", defaultEnabled: true },
  { label: "COMPUTE", value: "COMPUTE", defaultEnabled: true },
  { label: "SUBCONTRACT", value: "SUBCONTRACTING", defaultEnabled: false },
  { label: "OTHER", value: "OTHER", defaultEnabled: false },
] as const;

type VendorCategoryValue = (typeof vendorCategoryOptions)[number]["value"];
type DoctrineCategoryValue = (typeof doctrineCategoryOptions)[number]["value"];
type PolicyDraftState = {
  dailyCap: string;
  enabledCategories: ReadonlySet<DoctrineCategoryValue>;
  escalationThreshold: string;
  monthlyCap: string;
  perTxCap: string;
  requireAllowlist: boolean;
};
type PolicyEnvelopeValue = {
  allowedCategories: bigint;
  daily24hCap: bigint;
  escalationThreshold: bigint;
  monthlyRollingCap: bigint;
  perTxCap: bigint;
  requireAllowlist: boolean;
};
type AddVendorFormState = {
  address: string;
  category: VendorCategoryValue;
  confidential: boolean;
  name: string;
  notes: string;
  perVendorCap: string;
};

const initialVendorForm: AddVendorFormState = {
  address: "",
  category: "api",
  confidential: true,
  name: "",
  notes: "",
  perVendorCap: "0",
};
const initialPolicyDraft: PolicyDraftState = {
  dailyCap: "500",
  enabledCategories: new Set(["API", "DATA", "COMPUTE"]),
  escalationThreshold: "100",
  monthlyCap: "15000",
  perTxCap: "50",
  requireAllowlist: true,
};

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }

  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }

  return false;
}

function deployContractStatus() {
  const contracts = deployedContracts.map((contract) => ({
    ...contract,
    configured: isConfiguredAddress(contract.value),
  }));

  return {
    contracts,
    ready: contracts.every((contract) => contract.configured),
  };
}

function configuredAddress(value: string | undefined): Address | null {
  return isConfiguredAddress(value) ? (value as Address) : null;
}

function parseUsdcInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive USDC amount with up to 6 decimals.`);
  }

  const parsed = parseUnits(trimmed, 6);
  if (parsed <= 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }

  return parsed;
}

function parseUsdcCapInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative USDC amount with up to 6 decimals.`);
  }

  return parseUnits(trimmed, 6);
}

function usdcInputValue(value: bigint) {
  const formatted = formatUnits(value, 6);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

function doctrineCategoryBit(category: DoctrineCategoryValue) {
  if (category === "API") {
    return 1n << 0n;
  }
  if (category === "COMPUTE") {
    return 1n << 1n;
  }
  if (category === "DATA") {
    return 1n << 2n;
  }
  if (category === "SUBCONTRACTING") {
    return 1n << 3n;
  }
  return 1n << 4n;
}

function categoryMaskFromDraft(categories: ReadonlySet<DoctrineCategoryValue>) {
  let mask = 0n;
  for (const category of categories) {
    mask |= doctrineCategoryBit(category);
  }
  return mask;
}

function categoriesFromMask(mask: bigint) {
  return new Set(
    doctrineCategoryOptions
      .filter((category) => (mask & doctrineCategoryBit(category.value)) !== 0n)
      .map((category) => category.value),
  );
}

function normalizePolicyDraft(draft: PolicyDraftState) {
  return {
    ...draft,
    dailyCap: draft.dailyCap.trim(),
    escalationThreshold: draft.escalationThreshold.trim(),
    monthlyCap: draft.monthlyCap.trim(),
    perTxCap: draft.perTxCap.trim(),
  };
}

function buildPolicyEnvelope(draft: PolicyDraftState): PolicyEnvelopeValue {
  const normalized = normalizePolicyDraft(draft);
  const perTxCap = parseUsdcInput(normalized.perTxCap, "Per transaction cap");
  const daily24hCap = parseUsdcInput(normalized.dailyCap, "Daily cap");
  const monthlyRollingCap = parseUsdcInput(normalized.monthlyCap, "Monthly cap");
  const escalationThreshold = parseUsdcInput(
    normalized.escalationThreshold,
    "Escalation threshold",
  );
  const allowedCategories = categoryMaskFromDraft(normalized.enabledCategories);

  if (perTxCap > daily24hCap) {
    throw new Error("Per transaction cap must be less than or equal to the daily cap.");
  }

  if (daily24hCap > monthlyRollingCap) {
    throw new Error("Daily cap must be less than or equal to the monthly cap.");
  }

  if (escalationThreshold > perTxCap) {
    throw new Error("Escalation threshold must be less than or equal to the per transaction cap.");
  }

  if (allowedCategories === 0n) {
    throw new Error("Select at least one allowed category.");
  }

  return {
    allowedCategories,
    daily24hCap,
    escalationThreshold,
    monthlyRollingCap,
    perTxCap,
    requireAllowlist: normalized.requireAllowlist,
  };
}

function policyDraftFromEnvelope(policy: readonly unknown[]): PolicyDraftState {
  const perTxCap = typeof policy[0] === "bigint" ? policy[0] : 0n;
  const daily24hCap = typeof policy[1] === "bigint" ? policy[1] : 0n;
  const monthlyRollingCap = typeof policy[2] === "bigint" ? policy[2] : 0n;
  const allowedCategories = typeof policy[3] === "bigint" ? policy[3] : allPolicyCategoriesMask;
  const escalationThreshold = typeof policy[4] === "bigint" ? policy[4] : 0n;
  const requireAllowlist = typeof policy[5] === "boolean" ? policy[5] : true;

  return {
    dailyCap: usdcInputValue(daily24hCap),
    enabledCategories: categoriesFromMask(allowedCategories),
    escalationThreshold: usdcInputValue(escalationThreshold),
    monthlyCap: usdcInputValue(monthlyRollingCap),
    perTxCap: usdcInputValue(perTxCap),
    requireAllowlist,
  };
}

function policyDiffRows(active: PolicyDraftState, draft: PolicyDraftState) {
  const rows: Array<readonly [string, string, string]> = [];
  const normalizedActive = normalizePolicyDraft(active);
  const normalizedDraft = normalizePolicyDraft(draft);
  const categoryLabelList = (categories: ReadonlySet<DoctrineCategoryValue>) =>
    doctrineCategoryOptions
      .filter((category) => categories.has(category.value))
      .map((category) => category.label)
      .join(", ");

  if (normalizedActive.perTxCap !== normalizedDraft.perTxCap) {
    rows.push(["PER-TX CAP", `$${normalizedActive.perTxCap}`, `$${normalizedDraft.perTxCap}`]);
  }
  if (normalizedActive.dailyCap !== normalizedDraft.dailyCap) {
    rows.push(["DAILY CAP", `$${normalizedActive.dailyCap}`, `$${normalizedDraft.dailyCap}`]);
  }
  if (normalizedActive.monthlyCap !== normalizedDraft.monthlyCap) {
    rows.push(["MONTHLY CAP", `$${normalizedActive.monthlyCap}`, `$${normalizedDraft.monthlyCap}`]);
  }
  if (normalizedActive.escalationThreshold !== normalizedDraft.escalationThreshold) {
    rows.push([
      "ESCALATION THRESHOLD",
      `$${normalizedActive.escalationThreshold}`,
      `$${normalizedDraft.escalationThreshold}`,
    ]);
  }
  if (
    categoryMaskFromDraft(normalizedActive.enabledCategories) !==
    categoryMaskFromDraft(normalizedDraft.enabledCategories)
  ) {
    rows.push([
      "ALLOWED CATEGORIES",
      categoryLabelList(normalizedActive.enabledCategories) || "none",
      categoryLabelList(normalizedDraft.enabledCategories) || "none",
    ]);
  }
  if (normalizedActive.requireAllowlist !== normalizedDraft.requireAllowlist) {
    rows.push([
      "VENDOR ALLOWLIST",
      normalizedActive.requireAllowlist ? "required" : "optional",
      normalizedDraft.requireAllowlist ? "required" : "optional",
    ]);
  }

  return rows;
}

function vendorCategoryIndex(value: VendorCategoryValue) {
  return vendorCategoryOptions.findIndex((option) => option.value === value);
}

function parseAddressList(value: string, fallback: Address, label: string) {
  const parts = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = parts.length > 0 ? parts : [fallback];
  const unique = new Map<string, Address>();

  for (const candidate of candidates) {
    if (!isViemAddress(candidate)) {
      throw new Error(`${label} contains an invalid address: ${candidate}`);
    }

    unique.set(candidate.toLowerCase(), candidate as Address);
  }

  return Array.from(unique.values());
}

function buildWalletPolicy(form: DeployWalletFormState) {
  const perTxCap = parseUsdcInput(form.perTxCap, "Per transaction cap");
  const daily24hCap = parseUsdcInput(form.dailyCap, "Daily cap");
  const monthlyRollingCap = parseUsdcInput(form.monthlyCap, "Monthly cap");
  const escalationThreshold = parseUsdcInput(form.escalationAmount, "Escalation amount");

  if (perTxCap > daily24hCap) {
    throw new Error("Per transaction cap must be less than or equal to the daily cap.");
  }

  if (daily24hCap > monthlyRollingCap) {
    throw new Error("Daily cap must be less than or equal to the monthly cap.");
  }

  return {
    perTxCap,
    daily24hCap,
    monthlyRollingCap,
    allowedCategories: allPolicyCategoriesMask,
    escalationThreshold,
    requireAllowlist: form.requireAllowlist,
  };
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }

  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

function walletCreatedFromReceipt(logs: readonly unknown[]) {
  const parsed = parseEventLogs({
    abi: walletFactoryAbi,
    eventName: "WalletCreated",
    logs: logs as Parameters<typeof parseEventLogs>[0]["logs"],
  });

  return parsed[0]?.args.wallet as Address | undefined;
}

function approvedByLabel(value: string) {
  return isEvmAddress(value) ? shortAddress(value) : value.toUpperCase();
}

function amountLabel(value: number) {
  return formatUsdCompact(value);
}

function agentRowKey(agent: AgentDisplay) {
  return (agent.fullWallet ?? agent.id ?? `${agent.name}-${agent.wallet}`).toLowerCase();
}

function governedWalletAddressFromAgent(agent: AgentDisplay): Address | null {
  const candidate = agent.fullWallet ?? walletAlias[agent.wallet] ?? agent.wallet;
  return isEvmAddress(candidate) ? (candidate as Address) : null;
}

function vendorRowKey(vendor: VendorDisplay) {
  return `${String(vendor[1])}-${String(vendor[2])}-${String(vendor[3])}`.toLowerCase();
}

function ledgerRowKey(row: LedgerDisplay) {
  return (row[6] ?? `${row[0]}-${row[1]}-${row[2]}-${row[4]}-${row[5]}`).toLowerCase();
}

function escalationRowKey(row: EscalationDisplay) {
  return (row[10] ?? `${row[0]}-${row[1]}-${row[2]}-${row[3]}`).toLowerCase();
}

function anomalyRowKey(row: AnomalyDisplay) {
  return (row.id ?? `${row.agent}-${row.time}-${row.severity}`).toLowerCase();
}

function categoryLabel(value: string) {
  if (value === "subcontracting") {
    return "SUBCONTRACTING";
  }

  return value.toUpperCase();
}

function statusLabel(value: string) {
  if (value === "fortified") {
    return "ACTIVE";
  }

  if (value === "frozen") {
    return "FROZEN";
  }

  return "IDLE";
}

function agentRowFromLive(agent: ReturnType<typeof useLiveAgents>["data"][number]): AgentDisplay {
  const status = statusLabel(agent.status);
  const postureColor = status === "FROZEN" ? "#FF5A1F" : agent.posture > 0 ? "#6E9E7C" : "#8A909B";
  const spendWidth =
    agent.dailyLimit > 0
      ? Math.min(100, Math.round((agent.dailySpend / agent.dailyLimit) * 100))
      : 0;

  return {
    categories: agent.categories.map(categoryLabel),
    deviation: formatDeviation(0),
    doctrine: agent.doctrineVersion,
    fullWallet: agent.wallet,
    id: agent.id,
    last: agent.lastActivity,
    limit: amountLabel(agent.dailyLimit),
    name: agent.name.toUpperCase(),
    posture: agent.posture,
    postureColor,
    spend: amountLabel(agent.dailySpend),
    spendWidth,
    status,
    wallet: shortAddress(agent.wallet),
  };
}

const vendorInitialsByName = new Map<string, string>(
  vendors.map(([initials, name]) => [name.toLowerCase(), initials]),
);

function vendorInitials(name: string) {
  const staticInitials = vendorInitialsByName.get(name.toLowerCase());
  if (staticInitials) {
    return staticInitials;
  }

  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function vendorRowFromLive(
  vendor: ReturnType<typeof useLiveVendors>["data"][number],
): VendorDisplay {
  return [
    vendorInitials(vendor.name),
    vendor.name,
    vendor.address,
    categoryLabel(vendor.category),
    vendor.approvedBy.length > 0 ? vendor.approvedBy.map(approvedByLabel) : ["OWNER"],
    vendor.confidential,
    vendor.lastUsed,
    {
      createdAt: vendor.createdAt,
      id: vendor.id,
      lastUsed: vendor.lastUsed,
      status: vendor.trust,
      walletAddress: vendor.walletAddress,
    },
  ];
}

function ledgerRowFromLive(entry: ReturnType<typeof useLiveLedger>["data"][number]): LedgerDisplay {
  const statusMap = {
    approved: "APPROVED",
    escalated: "ESCALATED",
    frozen: "FROZEN",
    rejected: "REJECTED",
  } as const;

  return [
    entry.timestamp.slice(11, 19),
    entry.agentName.toUpperCase(),
    entry.counterparty,
    categoryLabel(entry.category),
    amountLabel(entry.amount),
    statusMap[entry.status],
    entry.hash,
  ];
}

function escalationRowFromLive(
  item: ReturnType<typeof useLiveEscalations>["data"][number],
): EscalationDisplay {
  return [
    item.agentName.toUpperCase(),
    shortAddress(item.wallet),
    amountLabel(item.amount),
    item.counterparty,
    categoryLabel(item.category),
    item.reason,
    item.expiresAt ?? item.expiresIn,
    item.expiryPercent < 10,
    `${item.quorumCurrent} / ${item.quorumRequired}`,
    formatDeviation(item.deviation),
    item.id,
  ];
}

function anomalyRowFromLive(
  item: ReturnType<typeof useLiveAnomalies>["data"][number],
): AnomalyDisplay {
  const critical = item.score >= 5;

  return {
    agent: item.agentName.toUpperCase(),
    color: critical ? "#FF5A1F" : "#E0A04A",
    flag: item.flaggedPoint,
    frozen: item.suggestedAction === "freeze",
    id: item.id,
    narrative: item.narrative,
    points: item.points,
    score: formatDeviation(item.score),
    severity: critical ? "CRITICAL" : "ELEVATED",
    time: item.timestamp.slice(11, 19),
  };
}

function CountdownText({
  className,
  value,
}: Readonly<{ className?: string; value: string | null | undefined }>) {
  const countdown = useCountdownState(value);

  return (
    <span
      className={cn(
        className,
        countdown.isSoon && "text-[#EC7A6B]",
        countdown.isExpired && "text-[#FF5A1F]",
        countdown.isMissing && "text-[#8A909B]",
      )}
    >
      {countdown.label}
    </span>
  );
}

function nearestExpiry(values: Array<string | null | undefined>) {
  const upcoming = values
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value) && value > Date.now())
    .sort((left, right) => left - right);

  return upcoming[0] ? new Date(upcoming[0]).toISOString() : null;
}

function routeParamString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function resolveGovernedWalletAddress(value: string | string[] | undefined): Address | null {
  const raw = routeParamString(value);
  if (!raw) {
    return null;
  }

  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }

  const candidate = walletAlias[decoded] ?? decoded;
  return isEvmAddress(candidate) ? (candidate as Address) : null;
}

function isTxHashValue(value: string | null | undefined): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value ?? "");
}

function Main({ children, className }: Readonly<{ children: ReactNode; className?: string }>) {
  const reduced = useReducedMotion();

  return (
    <MotionMain
      className={cn(
        "arcanum-content min-w-0 max-w-[100vw] space-y-4 overflow-x-clip px-3 py-4 sm:px-5 sm:py-5",
        className,
      )}
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      {children}
    </MotionMain>
  );
}

function Surface({
  children,
  className,
  index = 0,
}: Readonly<{ children: ReactNode; className?: string; index?: number }>) {
  const reduced = useReducedMotion();

  return (
    <MotionDiv
      className={className}
      custom={index}
      variants={reduced ? undefined : enterFade}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      {children}
    </MotionDiv>
  );
}

function SectionTabs({ items }: Readonly<{ items: readonly string[] }>) {
  return (
    <div className="flex items-center gap-1 border-b border-[#282C34] text-[12px] tracking-[0.12em]">
      {items.map((item, index) => (
        <button
          type="button"
          key={item}
          className={cn(
            "relative flex h-9 items-center px-3",
            index === 0 ? "text-[#EDF0F3]" : "text-[#5B626C] hover:text-[#8A909B]",
          )}
        >
          {item}
          {index === 0 ? (
            <span className="absolute inset-x-2 bottom-0 h-[2px] bg-[#FF5A1F]" />
          ) : null}
        </button>
      ))}
    </div>
  );
}

function CategoryBudget({
  label,
  amount,
  width,
  category,
  muted,
  color,
}: Readonly<{
  label: string;
  amount: string;
  width: number;
  category: string;
  muted?: boolean;
  color?: string;
}>) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span
          className={cn("flex items-center gap-1.5", muted ? "text-[#5B626C]" : "text-[#8A909B]")}
        >
          <span className="h-3 w-1" style={{ background: categoryColors[category] ?? "#6B7280" }} />
          {label}
        </span>
        <span className={muted ? "text-[#5B626C]" : "text-[#D7DBE0]"}>{amount}</span>
      </div>
      <div className="relative mt-1.5 h-1.5 w-full bg-[#20242B]">
        <div className="h-full" style={{ width: `${width}%`, background: color ?? "#3A4250" }} />
        <div className="absolute bottom-0 top-0 w-px bg-[#5B626C]" style={{ left: "75%" }} />
      </div>
    </div>
  );
}

function EventRow({
  row,
  compact = false,
}: Readonly<{ row: readonly string[]; compact?: boolean }>) {
  const [
    time,
    agentOrCategory,
    categoryOrAction,
    actionOrCounterparty,
    counterpartyOrAmount,
    amountOrStatus,
    statusMaybe,
  ] = row;
  const status = statusMaybe ?? amountOrStatus ?? "APPROVED";
  const danger = status === "REJECTED";
  const category = compact ? agentOrCategory : categoryOrAction;
  const action = compact ? categoryOrAction : actionOrCounterparty;
  const counterparty = compact ? actionOrCounterparty : counterpartyOrAmount;
  const amount = compact ? counterpartyOrAmount : amountOrStatus;

  return (
    <RowShell
      danger={danger}
      className={cn(
        "grid items-center border-b border-[#1E222A] px-4 py-2.5",
        compact
          ? "grid-cols-[84px_56px_minmax(96px,1fr)_minmax(110px,1fr)_92px_104px]"
          : "grid-cols-[84px_148px_58px_minmax(96px,1fr)_minmax(110px,1fr)_92px_104px]",
      )}
    >
      <span className="text-[#5B626C]">{time}</span>
      {!compact ? <span className="text-[#EDF0F3]">{agentOrCategory}</span> : null}
      <CategoryTick category={category ?? "OTHER"} label={category} />
      <span className="text-[#8A909B]">{action}</span>
      <span className={danger ? "text-[#FF5A1F]" : "text-[#D7DBE0]"}>{counterparty}</span>
      <span className="text-right text-[#D7DBE0]">{amount}</span>
      <StatusLabel status={status} align="right" />
    </RowShell>
  );
}

function DashboardPostureCard({
  mode,
  posture,
}: Readonly<{ mode: ReturnType<typeof useWorkspaceMode>["dataMode"]; posture: number }>) {
  const active = mode === "demo" || posture > 0;
  const postureLabel = active ? (posture >= 70 ? "FORTIFIED" : "WATCHING") : "WAITING";
  const statusLine =
    mode === "demo"
      ? "3 PTS / 24H"
      : active
        ? "LIVE INDEXED"
        : mode === "disconnected"
          ? "CONNECT WALLET"
          : mode === "connected_unsigned"
            ? "SIGN IN"
            : "NOT STARTED";

  return (
    <Surface className="relative border border-[#282C34] bg-[#181B21] p-6" index={0}>
      <CornerMarks />
      <div className="text-[10px] tracking-[0.28em] text-[#5B626C]">
        <GlossaryTermInline term="POSTURE INDEX">POSTURE INDEX</GlossaryTermInline>
      </div>
      <div className="mt-1 flex items-end gap-4">
        <span className="font-cond text-[112px] font-bold leading-[0.74] text-[#EDF0F3]">
          {String(posture).padStart(2, "0")}
        </span>
        <div className="mb-2">
          <div className="text-[15px] font-semibold tracking-[0.06em] text-[#FF5A1F]">
            {postureLabel}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#8A909B]">
            <ArrowUpRight className="h-3.5 w-3.5 rotate-90" strokeWidth={iconStroke} /> {statusLine}
          </div>
        </div>
      </div>
      <Gauge value={posture} marker={90} markerLabel="90 Y" />
      <div className="mt-7 border-t border-[#282C34] pt-3 text-[11px] leading-relaxed text-[#8A909B]">
        {active ? (
          mode === "demo" ? (
            <>
              Demo surveillance active across all subsystems.{" "}
              <span className="text-[#FF5A1F]">
                1 agent under <GlossaryTermInline term="RESTRAINT">restraint</GlossaryTermInline>.
              </span>{" "}
              Demo data visible for the configured workspace.
            </>
          ) : (
            "Indexed governance posture is derived from live wallet, policy, ledger, and anomaly activity."
          )
        ) : mode === "disconnected" ? (
          "Connect a wallet to load a governed Arc Testnet workspace."
        ) : mode === "connected_unsigned" ? (
          "Sign in with your connected wallet to load private workspace state."
        ) : (
          "Deploy a governed wallet to begin collecting live policy and activity posture."
        )}
      </div>
    </Surface>
  );
}

function DashboardOnboardingCard({
  mode,
}: Readonly<{ mode: ReturnType<typeof useWorkspaceMode>["dataMode"] }>) {
  const copy =
    mode === "disconnected"
      ? {
          title: "Connect wallet to load workspace",
          body: "Connect your owner wallet, then sign in to load governed wallet state for Arc Testnet.",
          primary: null,
        }
      : mode === "connected_unsigned"
        ? {
            title: "Sign in to load workspace",
            body: "Sign the wallet challenge to load live governed wallets, policy state, vendors, and ledger activity.",
            primary: null,
          }
        : {
            title: "Deploy your first governed wallet",
            body: "Create a policy-controlled testnet USDC/EURC wallet for autonomous agents on Arc.",
            primary: { href: "/agents", label: "Deploy governed wallet" },
          };

  const steps = [
    ["01", "Deploy governed wallet", "Create an owner-managed GuardedWallet on Arc Testnet."],
    ["02", "Add agent signer", "Authorize the public address controlled by your agent backend."],
    [
      "03",
      "Add vendor + policy",
      "Set approved destinations and spending limits before agent payments.",
    ],
  ] as const;

  return (
    <Surface className="border border-[#282C34] bg-[#181B21] p-6 xl:col-span-2" index={1}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <div className="text-[10px] tracking-[0.28em] text-[#FF5A1F]">LIVE WORKSPACE SETUP</div>
          <h1 className="mt-3 font-cond text-[38px] font-semibold leading-none text-[#EDF0F3]">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-[560px] font-body text-[13px] leading-relaxed text-[#9AA1AC]">
            {copy.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {copy.primary ? (
              <Link
                href={copy.primary.href}
                className="flex h-9 items-center gap-2 border border-[#FF5A1F]/60 px-3 text-[10px] tracking-[0.14em] text-[#FF5A1F] hover:bg-[#1c1107]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                {copy.primary.label}
              </Link>
            ) : null}
            <Link
              href="/docs"
              className="flex h-9 items-center gap-2 border border-[#282C34] px-3 text-[10px] tracking-[0.14em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              <ScrollText className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              View setup guide
            </Link>
          </div>
        </div>
        <div className="grid gap-2">
          {steps.map(([number, title, description]) => (
            <div key={number} className="border border-[#282C34] bg-[#101216] p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center border border-[#3A4250] font-mono text-[10px] text-[#8A909B]">
                  {number}
                </span>
                <div>
                  <div className="text-[12px] tracking-[0.12em] text-[#D7DBE0]">{title}</div>
                  <div className="mt-1 font-body text-[12px] leading-relaxed text-[#6F7682]">
                    {description}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}

function EmptyActivityPreview() {
  const previews = [
    {
      title: "Ledger",
      copy: "Policy updates, payment intents, transfers, and escalations will appear after activity begins.",
    },
    {
      title: "Escalations",
      copy: "Risky or review-required agent payments will appear here for human approval.",
    },
    {
      title: "Anomalies",
      copy: "Spend deviations and unusual agent behavior will be listed after indexed activity exists.",
    },
  ] as const;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {previews.map((item, index) => (
        <Surface
          key={item.title}
          className="border border-[#282C34] bg-[#181B21] p-5"
          index={index + 2}
        >
          <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">{item.title}</div>
          <div className="mt-2 font-cond text-[20px] font-semibold text-[#D7DBE0]">
            Awaiting activity
          </div>
          <p className="mt-2 font-body text-[12px] leading-relaxed text-[#6F7682]">{item.copy}</p>
        </Surface>
      ))}
    </section>
  );
}

export function DashboardCanvasPage() {
  const workspace = useWorkspaceMode();
  const metrics = useLiveDashboardMetrics();
  const liveAgents = useLiveAgents();
  const liveEscalations = useLiveEscalations("PENDING");
  const canShowDemoWorkspace = workspace.isDemo;
  const governedWalletCount = canShowDemoWorkspace ? agentRows.length : liveAgents.data.length;
  const hasLiveDashboardData =
    metrics.valueGoverned > 0 ||
    metrics.activeAgents > 0 ||
    metrics.threatsBlocked > 0 ||
    metrics.pendingEscalations > 0 ||
    governedWalletCount > 0 ||
    liveEscalations.data.length > 0;
  const showWorkspaceOnboarding =
    !canShowDemoWorkspace &&
    !metrics.isLoading &&
    !liveAgents.isLoading &&
    !metrics.isError &&
    !liveAgents.isError &&
    governedWalletCount === 0 &&
    !hasLiveDashboardData;
  const dashboardRows = canShowDemoWorkspace ? dashboardEvents : [];
  const posture = canShowDemoWorkspace || metrics.postureIndex > 0 ? metrics.postureIndex || 87 : 0;
  const pendingEscalationCount = canShowDemoWorkspace
    ? metrics.pendingEscalations || 1
    : metrics.pendingEscalations;
  const pendingEscalationExpiry =
    nearestExpiry(liveEscalations.data.map((item) => item.expiresAt)) ??
    (canShowDemoWorkspace ? String(escalations[0]?.[6] ?? "") : null);
  const ledgerEmptyState = getWorkspaceEmptyCopy(workspace.dataMode, "ledger");
  const escalationEmptyState = getWorkspaceEmptyCopy(workspace.dataMode, "escalations");
  const anomalyEmptyState = getWorkspaceEmptyCopy(workspace.dataMode, "anomalies");

  return (
    <GovernanceFrame
      active="overview"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / OVERVIEW`}
    >
      <Main>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,400px)_1fr]">
          {showWorkspaceOnboarding ? (
            <DashboardOnboardingCard mode={workspace.dataMode} />
          ) : (
            <>
              <DashboardPostureCard mode={workspace.dataMode} posture={posture} />
              <Surface
                className="grid grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4"
                index={1}
              >
                <StatTile
                  label="VALUE GOVERNED"
                  value={<>${metrics.valueGoverned.toLocaleString("en-US")}</>}
                  caption={`${String(governedWalletCount).padStart(2, "0")} GOVERNED WALLETS`}
                >
                  {canShowDemoWorkspace ? (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-[#6E9E7C]">
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} /> DEMO TREND
                    </div>
                  ) : null}
                </StatTile>
                <StatTile
                  label="ACTIVE AGENTS"
                  value={String(metrics.activeAgents).padStart(2, "0")}
                  caption={
                    <span>
                      {canShowDemoWorkspace ? "05 DEPLOYED / " : "LIVE INDEXED / "}
                      <span className="text-[#FF5A1F]">
                        {canShowDemoWorkspace ? "01 FROZEN" : "INDEXED RESTRAINTS"}
                      </span>
                    </span>
                  }
                >
                  <div className="mt-3 flex gap-1">
                    {[0, 1, 2, 3].map((item) => (
                      <span key={item} className="h-2.5 w-5 bg-[#3A4250]" />
                    ))}
                    {canShowDemoWorkspace ? <span className="h-2.5 w-5 bg-[#FF5A1F]" /> : null}
                  </div>
                </StatTile>
                <StatTile
                  label="THREATS BLOCKED"
                  value={String(metrics.threatsBlocked)}
                  caption={canShowDemoWorkspace ? "30D WINDOW" : "INDEXED POLICY DENIALS"}
                >
                  {canShowDemoWorkspace ? (
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-[#6E9E7C]">
                      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} /> DEMO WINDOW
                    </div>
                  ) : null}
                </StatTile>
                <StatTile
                  label="PENDING ESCALATIONS"
                  value={String(pendingEscalationCount).padStart(2, "0")}
                  valueClassName={pendingEscalationCount > 0 ? "text-[#FF5A1F]" : undefined}
                  caption={
                    pendingEscalationCount > 0 ? (
                      <>
                        EXPIRES{" "}
                        <CountdownText className="text-[#EC7A6B]" value={pendingEscalationExpiry} />
                      </>
                    ) : (
                      "NO PENDING REVIEWS"
                    )
                  }
                  accent={pendingEscalationCount > 0}
                >
                  {pendingEscalationCount > 0 ? (
                    <div className="mt-2 text-[13px] font-medium tracking-[0.04em] text-[#E0A04A]">
                      REVIEW REQUIRED
                    </div>
                  ) : null}
                </StatTile>
              </Surface>
            </>
          )}
        </section>

        {showWorkspaceOnboarding ? (
          <EmptyActivityPreview />
        ) : (
          <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_minmax(0,432px)]">
            <Surface className="border border-[#282C34] bg-[#181B21]" index={2}>
              <PanelHeader
                title="GOVERNED EVENT STREAM"
                meta={canShowDemoWorkspace ? "DEMO DATA / 24H WINDOW" : "LIVE READ MODEL"}
              />
              <div className="overflow-x-auto">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[84px_148px_58px_minmax(96px,1fr)_minmax(110px,1fr)_92px_104px] items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.14em] text-[#5B626C]">
                    <span>TIME</span>
                    <span>AGENT</span>
                    <span>CAT</span>
                    <span>ACTION</span>
                    <span>COUNTERPARTY</span>
                    <span className="text-right">AMOUNT</span>
                    <span className="text-right">STATUS</span>
                  </div>
                  <div className="text-[12px]">
                    {dashboardRows.length > 0 ? (
                      dashboardRows.map((event) => (
                        <EventRow key={`${event[0]}-${event[1]}-${event[3]}`} row={event} />
                      ))
                    ) : (
                      <EmptyState
                        description={ledgerEmptyState.description}
                        title={ledgerEmptyState.title}
                      />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex h-9 items-center justify-between border-t border-[#282C34] px-4 text-[10px] tracking-[0.14em] text-[#5B626C]">
                <span>
                  SHOWING {dashboardRows.length} / {canShowDemoWorkspace ? "DEMO" : "LIVE"}
                </span>
                <Link
                  href="/ledger"
                  className="flex items-center gap-1 text-[#8A909B] hover:text-[#D7DBE0]"
                >
                  OPEN FULL LEDGER <ArrowUpRight className="h-3 w-3" strokeWidth={iconStroke} />
                </Link>
              </div>
            </Surface>

            <div className="space-y-4">
              <div className="border border-[#282C34] bg-[#181B21]">
                <PanelHeader title="RESTRAINT QUEUE">
                  <span className="bg-[#FF5A1F] px-1.5 text-[10px] font-bold text-[#121419]">
                    {String(pendingEscalationCount).padStart(2, "0")} PENDING
                  </span>
                </PanelHeader>
                {canShowDemoWorkspace ? (
                  <div className="p-4">
                    <div className="flex border border-[#FF5A1F]/35 bg-[#15171B]">
                      <HazardStripe />
                      <div className="flex-1 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] text-[#EDF0F3]">RESEARCH-AGENT</span>
                          <span className="border border-[#282C34] px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-[#3FA89B]">
                            COMPUTE
                          </span>
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                          <span className="font-cond text-[40px] font-semibold leading-[0.8] text-[#EDF0F3]">
                            $73.42
                          </span>
                          <span className="mb-1 text-[11px] text-[#8A909B]">- AWS Bedrock</span>
                        </div>
                        <div className="mt-3 text-[11px] leading-relaxed text-[#8A909B]">
                          Exceeds per-vendor daily limit{" "}
                          <span className="text-[#D7DBE0]">($50.00)</span>. Held for approver
                          review.
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#282C34] pt-3 text-[10px] tracking-[0.08em] text-[#5B626C]">
                          <div>
                            QUORUM<div className="mt-0.5 text-[12px] text-[#D7DBE0]">1 / 2</div>
                          </div>
                          <div>
                            DEVIATION
                            <div className="mt-0.5 text-[12px] text-[#D7DBE0]">
                              {formatDeviation(0.3)}
                            </div>
                          </div>
                          <div>
                            EXPIRES
                            <div className="mt-0.5 text-[12px] text-[#EC7A6B]">
                              <CountdownText value={pendingEscalationExpiry} />
                            </div>
                          </div>
                        </div>
                        <EscalationResolutionActions
                          amount="$73.42"
                          counterparty="AWS Bedrock"
                          expiresAt={pendingEscalationExpiry}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    description={escalationEmptyState.description}
                    title={escalationEmptyState.title}
                  />
                )}
              </div>

              <div className="border border-[#282C34] bg-[#181B21]">
                <PanelHeader title="ANOMALY REGISTER" meta="DEVIATION SCALE" />
                {canShowDemoWorkspace ? (
                  <div className="divide-y divide-[#1E222A]">
                    {[
                      [
                        "DEV-AGENT-01",
                        "02:47:12Z",
                        "transfer -> unrecognized counterparty",
                        formatDeviation(7.4),
                        "FROZEN",
                        93,
                        "#FF5A1F",
                        true,
                      ],
                      [
                        "MARKETING-AGENT",
                        "02:31:55Z",
                        "spend velocity +18%",
                        formatDeviation(0.8),
                        "WATCH",
                        14,
                        "#E0A04A",
                        false,
                      ],
                      [
                        "RESEARCH-AGENT",
                        "02:12:04Z",
                        "within expected band",
                        formatDeviation(0.3),
                        "NOMINAL",
                        5,
                        "#3A4250",
                        false,
                      ],
                    ].map(([agent, time, label, score, state, width, color, danger]) => (
                      <div
                        key={String(agent)}
                        className={cn(
                          "flex items-center gap-3 px-4 py-3",
                          danger && "bg-[#1a1207]",
                        )}
                      >
                        <div className="w-28">
                          <div className="text-[12px] text-[#EDF0F3]">{agent}</div>
                          <div className="text-[10px] tracking-[0.08em] text-[#5B626C]">{time}</div>
                        </div>
                        <div className="flex-1">
                          <div className="h-1.5 w-full bg-[#20242B]">
                            <div
                              className="h-full"
                              style={{ width: `${width}%`, background: String(color) }}
                            />
                          </div>
                          <div className="mt-1 text-[10px] text-[#8A909B]">{label}</div>
                        </div>
                        <div className="text-right">
                          <div
                            className="font-cond text-[18px] font-semibold"
                            style={{ color: String(color) }}
                          >
                            {score}
                          </div>
                          <div
                            className={cn(
                              "text-[9px] tracking-[0.12em]",
                              danger ? "text-[#FF5A1F]" : "text-[#8A909B]",
                            )}
                          >
                            {state}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    description={anomalyEmptyState.description}
                    title={anomalyEmptyState.title}
                  />
                )}
              </div>

              <div className="border border-[#282C34] bg-[#181B21]">
                <PanelHeader title="BUDGET BURN-DOWN" meta="DAILY ENVELOPE" />
                {canShowDemoWorkspace ? (
                  <div className="space-y-3.5 p-4">
                    <CategoryBudget label="API" category="API" amount="$612 / $1,500" width={41} />
                    <CategoryBudget
                      label="COMPUTE"
                      category="COMPUTE"
                      amount="$338 / $900"
                      width={38}
                    />
                    <CategoryBudget
                      label="DATA"
                      category="DATA"
                      amount="$598 / $700"
                      width={85}
                      color="#FF5A1F"
                    />
                    <CategoryBudget
                      label="SUBCONTRACT"
                      category="SUBCONTRACTING"
                      amount="$118 / $400"
                      width={30}
                    />
                    <div className="flex items-center justify-between border-t border-[#282C34] pt-3 text-[11px] tracking-[0.08em]">
                      <span className="text-[#5B626C]">TOTAL / 37% OF ENVELOPE</span>
                      <span className="text-[#D7DBE0]">$1,666 / $3,500</span>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    description="Spend envelopes appear after a governed wallet has indexed policy and ledger data."
                    title="NO BUDGET DATA"
                  />
                )}
              </div>
            </div>
          </section>
        )}
      </Main>
    </GovernanceFrame>
  );
}

function ActionButton({
  children,
  icon,
  tone,
  className,
  disabled,
  onClick,
}: Readonly<{
  children: ReactNode;
  icon?: ReactNode;
  tone?: "danger";
  className?: string;
  disabled?: boolean;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}>) {
  const reduced = useReducedMotion();

  return (
    <MotionButton
      type="button"
      disabled={disabled}
      onClick={onClick}
      variants={reduced ? undefined : hoverLift}
      initial={reduced ? false : "rest"}
      whileHover={reduced || disabled ? undefined : "hover"}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 text-[11px] tracking-[0.12em]",
        tone === "danger"
          ? "border border-[#FF5A1F]/50 text-[#FF5A1F] hover:bg-[#1c1107]"
          : "bg-[#2A2E35] text-[#EDF0F3] hover:bg-[#343A44]",
        disabled && "cursor-not-allowed opacity-55",
        className,
      )}
    >
      {icon}
      {children}
    </MotionButton>
  );
}

type EscalationTxStage =
  | "idle"
  | "checking"
  | "wallet"
  | "confirming"
  | "pending_indexer"
  | "error";

function EscalationResolutionActions({
  amount,
  counterparty,
  buttonClassName,
  disabledReason: externalDisabledReason,
  expiresAt,
  txHash = fallbackEscalationHash,
}: Readonly<{
  amount: string;
  buttonClassName?: string;
  counterparty: string;
  disabledReason?: string | null;
  expiresAt?: string | null;
  txHash?: string;
}>) {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const submittingRef = useRef(false);
  const [txStage, setTxStage] = useState<EscalationTxStage>("idle");
  const [lastAction, setLastAction] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);
  const countdown = useCountdownState(expiresAt);
  const escalationManagerAddress = configuredAddress(process.env.NEXT_PUBLIC_ESCALATION_MANAGER);
  const escalationId = isTxHashValue(txHash) ? txHash : null;
  const demoFixture = workspace.isDemo && txHash === fallbackEscalationHash;
  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    txStage === "checking" ||
    txStage === "wallet" ||
    txStage === "confirming";
  const disabledReason =
    externalDisabledReason ??
    (!escalationId
      ? "Indexed escalation id is missing."
      : !escalationManagerAddress
        ? "EscalationManager address is not configured."
        : demoFixture
          ? "Demo escalation is read-only until backed by an indexed Arc Testnet escalation."
          : !publicClient
            ? "Arc Testnet RPC is unavailable."
            : !isConnected || !address
              ? "Connect the approver wallet first."
              : countdown.isExpired
                ? "Escalation is expired. Expired requests cannot be approved or rejected."
                : null);
  const actionsDisabled = Boolean(disabledReason) || isBusy || txStage === "pending_indexer";
  const statusLine =
    actionError ??
    (txStage === "pending_indexer"
      ? "Contract confirmed. Waiting for indexer sync."
      : txStage === "checking"
        ? "Checking approver permission on Arc Testnet."
        : disabledReason);

  const readEscalationPreflight = async () => {
    if (!escalationManagerAddress || !escalationId || !publicClient || !address) {
      throw new Error(disabledReason ?? "Escalation action is unavailable.");
    }

    const detail = await publicClient.readContract({
      address: escalationManagerAddress,
      abi: escalationManagerAbi,
      functionName: "getEscalation",
      args: [escalationId],
    });
    const wallet = detail[0] as Address;
    const status = escalationStatusLabels[Number(detail[8])] ?? "EXPIRED";

    if (isZeroAddress(wallet)) {
      throw new Error("Escalation was not found on Arc Testnet.");
    }
    if (status !== "PENDING") {
      throw new Error(`Escalation is already ${status.toLowerCase()}.`);
    }

    const expiresAtMs = Number(detail[5]) * 1000;
    if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
      throw new Error("Escalation is expired. Expired requests cannot be approved or rejected.");
    }

    const [requiredSigner, alreadySigned] = await Promise.all([
      publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "isRequiredSigner",
        args: [wallet, address],
      }),
      publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "signed",
        args: [escalationId, address],
      }),
    ]);

    if (!requiredSigner) {
      throw new Error("Connected wallet is not an authorized approver for this escalation.");
    }
    if (alreadySigned) {
      throw new Error("This approver has already voted on this escalation.");
    }

    return {
      signaturesCount: Number(detail[7]),
      threshold: Number(detail[6]),
    };
  };

  const submitResolution = async (
    action: "approve" | "reject",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`escalations.${action}`, event)) {
      return;
    }
    if (actionsDisabled || submittingRef.current || !escalationManagerAddress || !escalationId) {
      return;
    }

    submittingRef.current = true;
    setLastAction(action);
    setActionError(null);
    setContractTxHash(null);
    setTxStage("checking");

    try {
      const preflight = await readEscalationPreflight();

      if (chainId !== arcTestnet.id) {
        setTxStage("wallet");
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      setTxStage("wallet");
      const hash = await writeContractAsync({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: action,
        args: [escalationId],
        chainId: arcTestnet.id,
      });
      setContractTxHash(hash);
      setTxStage("confirming");

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") {
        throw new Error("Escalation transaction reverted.");
      }

      await utils.escalations.list.invalidate();
      await utils.escalations.byTxHash.invalidate({ txHash: escalationId });
      setTxStage("pending_indexer");
      if (action === "approve") {
        const nextCount = preflight.signaturesCount + 1;
        toast.success(
          nextCount >= preflight.threshold
            ? "ESCALATION APPROVED / QUORUM REACHED"
            : `ESCALATION APPROVED / ${nextCount} OF ${preflight.threshold} QUORUM`,
          {
            description:
              nextCount >= preflight.threshold
                ? `Release for ${amount} to ${counterparty} executed in the approval transaction. Pending indexer sync.`
                : `Vote for ${amount} to ${counterparty} confirmed on-chain. Pending indexer sync.`,
          },
        );
      } else {
        toast.success("ESCALATION REJECTED", {
          description: `Rejection for ${amount} to ${counterparty} confirmed on-chain. Pending indexer sync.`,
        });
      }
    } catch (caught) {
      setTxStage("error");
      const message = errorMessage(caught);
      setActionError(message);
      toast.error("ESCALATION ACTION FAILED", { description: message });
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div className="mt-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <ActionButton
          tone="danger"
          disabled={actionsDisabled}
          onClick={(event) => void submitResolution("reject", event)}
          className={buttonClassName}
          icon={<X className="h-3.5 w-3.5" strokeWidth={iconStroke} />}
        >
          {txStage === "pending_indexer" && lastAction === "reject" ? "REJECTED" : "REJECT"}
        </ActionButton>
        <ActionButton
          disabled={actionsDisabled}
          onClick={(event) => void submitResolution("approve", event)}
          className={buttonClassName}
          icon={<Check className="h-3.5 w-3.5" strokeWidth={iconStroke} />}
        >
          {txStage === "pending_indexer" && lastAction === "approve" ? "APPROVED" : "APPROVE"}
        </ActionButton>
      </div>
      {statusLine ? (
        <div
          className={cn(
            "text-center text-[9px] tracking-[0.12em]",
            actionError ? "text-[#EC7A6B]" : "text-[#5B626C]",
          )}
        >
          {statusLine}
        </div>
      ) : null}
      {contractTxHash ? (
        <Link
          href={getArcscanTxUrl(contractTxHash) ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex justify-center text-[9px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
        >
          OPEN VOTE TX
        </Link>
      ) : null}
    </div>
  );
}

function EmptyState({
  actionLabel,
  copy,
  description,
  onAction,
  title,
}: Readonly<{
  actionLabel?: string;
  copy?: string;
  description?: string;
  onAction?: () => void;
  title?: string;
}>) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="font-cond text-[18px] font-semibold tracking-[0.08em] text-[#8A909B]">
        {title ?? copy}
      </div>
      {description ? (
        <div className="mx-auto mt-2 max-w-[460px] font-body text-[12px] leading-relaxed text-[#6F7682]">
          {description}
        </div>
      ) : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 cursor-pointer border border-[#282C34] px-3 py-1.5 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ErrorState({ cause, onRetry }: Readonly<{ cause: string; onRetry?: () => void }>) {
  return (
    <div className="px-4 py-8 text-center">
      <div className="font-cond text-[18px] font-semibold tracking-[0.08em] text-[#FF5A1F]">
        {cause.toUpperCase()}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 text-[11px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
        >
          RETRY
        </button>
      ) : null}
    </div>
  );
}

export function AgentsCanvasPage() {
  const workspace = useWorkspaceMode();
  const liveAgents = useLiveAgents();
  const liveVendors = useLiveVendors();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [agentQuery, setAgentQuery] = useState("");
  const [deployOpen, setDeployOpen] = useState(false);
  const [createdAgents, setCreatedAgents] = useState<AgentDisplay[]>([]);
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);
  const canShowDemoWorkspace = workspace.isDemo;
  const sourceRows: readonly AgentDisplay[] = useMemo(
    () =>
      liveAgents.data.length > 0
        ? liveAgents.data.map(agentRowFromLive)
        : canShowDemoWorkspace
          ? agentRows
          : [],
    [liveAgents.data, canShowDemoWorkspace],
  );
  const baseRows = useMemo(() => [...createdAgents, ...sourceRows], [createdAgents, sourceRows]);
  const rows = useMemo(() => {
    const query = normalizeSearch(agentQuery);
    return baseRows.filter((agent) => {
      const statusMatches = statusFilter === "ALL" || agent.status === statusFilter;
      const queryMatches = matchesSearch(query, [
        agent.name,
        agent.wallet,
        agent.fullWallet,
        agent.doctrine,
        agent.categories.join(" "),
      ]);
      return statusMatches && queryMatches;
    });
  }, [agentQuery, baseRows, statusFilter]);
  const agentFiltersActive = agentQuery.trim() !== "" || statusFilter !== "ALL";
  const resetAgentFilters = () => {
    setAgentQuery("");
    setStatusFilter("ALL");
  };
  const agentCounts = useMemo(
    () => ({
      ACTIVE: baseRows.filter((agent) => agent.status === "ACTIVE").length,
      ALL: baseRows.length,
      FROZEN: baseRows.filter((agent) => agent.status === "FROZEN").length,
      IDLE: baseRows.filter((agent) => agent.status === "IDLE").length,
    }),
    [baseRows],
  );
  const frozenAgent = baseRows.find((agent) => agent.status === "FROZEN");
  const averagePosture =
    baseRows.length > 0
      ? Math.round(baseRows.reduce((sum, agent) => sum + agent.posture, 0) / baseRows.length)
      : 0;
  const emptyAgents = getWorkspaceEmptyCopy(workspace.dataMode, "agents");
  const selectedAgent =
    baseRows.find((agent) => agentRowKey(agent) === selectedAgentKey) ?? baseRows[0] ?? null;
  const selectedWalletAddress = selectedAgent
    ? governedWalletAddressFromAgent(selectedAgent)
    : null;
  const selectedLedger = useLiveLedgerByWallet(selectedWalletAddress);
  const selectedWalletKey = selectedAgent ? agentRowKey(selectedAgent) : null;
  const showAgentWorkspace = baseRows.length > 0 || agentFiltersActive || liveAgents.isError;

  useEffect(() => {
    if (baseRows.length === 0) {
      setSelectedAgentKey(null);
      return;
    }

    const firstAgent = baseRows[0];
    if (firstAgent && !baseRows.some((agent) => agentRowKey(agent) === selectedAgentKey)) {
      setSelectedAgentKey(agentRowKey(firstAgent));
    }
  }, [baseRows, selectedAgentKey]);

  const handleWalletCreated = (result: CreatedWalletResult) => {
    setCreatedAgents((previous) => {
      const walletKey = result.wallet.toLowerCase();
      const label = result.label.trim() || "GovernedWallet";
      const baseName = label.toUpperCase().replaceAll(/\s+/g, "") || "GOVERNEDWALLET";
      const displayName = previous.some(
        (agent) =>
          agent.name === baseName && (agent.fullWallet ?? agent.id)?.toLowerCase() !== walletKey,
      )
        ? `${baseName}-${result.wallet.slice(-4).toUpperCase()}`
        : baseName;
      const pendingAgent: AgentDisplay = {
        id: walletKey,
        status: "IDLE",
        name: displayName,
        wallet: shortAddress(result.wallet),
        fullWallet: result.wallet,
        posture: 0,
        postureColor: "#8A909B",
        spend: "$0.00",
        limit: amountLabel(Number(result.dailyCap)),
        spendWidth: 0,
        categories: [],
        deviation: formatDeviation(0),
        doctrine: "Supabase synced",
        last: "No indexed activity yet",
      };
      const existingIndex = previous.findIndex(
        (agent) => (agent.fullWallet ?? agent.id)?.toLowerCase() === walletKey,
      );

      if (existingIndex === -1) {
        return [pendingAgent, ...previous];
      }

      return previous.map((agent, index) => (index === existingIndex ? pendingAgent : agent));
    });
    setSelectedAgentKey(result.wallet.toLowerCase());
  };

  useEffect(() => {
    if (!deployOpen) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeployOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deployOpen]);

  return (
    <GovernanceFrame active="agents" file={`${workspaceFileRoot(workspace)} / GOVERNANCE / AGENTS`}>
      <Main>
        {showAgentWorkspace ? (
          <>
            <div className="grid grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              <StatTile
                label="TOTAL AGENTS"
                value={String(agentCounts.ALL).padStart(2, "0")}
                caption="GOVERNED WALLETS"
              />
              <StatTile label="ACTIVE" value={String(agentCounts.ACTIVE).padStart(2, "0")}>
                <div className="mt-2 flex items-center gap-1 text-[10px] tracking-[0.08em] text-[#6E9E7C]">
                  <span className="h-1.5 w-1.5 bg-[#6E9E7C]" />{" "}
                  {agentCounts.ACTIVE > 0 ? "SURVEILLANCE LIVE" : "SIGNER SETUP NEEDED"}
                </div>
              </StatTile>
              <StatTile
                label="UNDER RESTRAINT"
                value={String(agentCounts.FROZEN).padStart(2, "0")}
                valueClassName="text-[#FF5A1F]"
                caption={
                  <span className="text-[#E0A04A]">
                    {frozenAgent
                      ? `${frozenAgent.name} / ${frozenAgent.deviation}`
                      : "NO RESTRAINTS"}
                  </span>
                }
                accent
              />
              <StatTile label="FLEET POSTURE" value={String(averagePosture)}>
                <div className="mt-2 flex items-center gap-1 text-[10px] tracking-[0.08em] text-[#8A909B]">
                  <ArrowUpRight className="h-3 w-3 rotate-90" strokeWidth={iconStroke} />{" "}
                  {averagePosture > 0 ? "LIVE READ MODEL" : "NO ACTIVITY"}
                </div>
              </StatTile>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] tracking-[0.1em]">
                {(["ALL", "ACTIVE", "FROZEN", "IDLE"] as const).map((filter) => {
                  const count = agentCounts[filter];
                  const selected = statusFilter === filter;
                  return (
                    <button
                      type="button"
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={cn(
                        "border px-3 py-1.5",
                        selected
                          ? "border-[#3A4250] bg-[#1B1F26] text-[#EDF0F3]"
                          : filter === "IDLE"
                            ? "border-[#282C34] text-[#5B626C] hover:text-[#8A909B]"
                            : "border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]",
                      )}
                    >
                      {filter} <span className="text-[#5B626C]">{count}</span>
                    </button>
                  );
                })}
              </div>
              <label className="flex h-9 min-w-[220px] max-w-[360px] flex-1 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[#5B626C]">
                <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                <input
                  value={agentQuery}
                  onChange={(event) => setAgentQuery(event.target.value)}
                  placeholder="filter agents, addresses, doctrines..."
                  className="min-w-0 flex-1 bg-transparent text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                />
              </label>
              <button
                type="button"
                onClick={() => setDeployOpen(true)}
                className="flex h-9 shrink-0 items-center gap-2 border border-[#3A4250] px-4 text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} /> DEPLOY GOVERNED WALLET
              </button>
            </div>

            {baseRows.length > 0 && selectedAgent ? (
              <>
                <AgentsSetupGrid
                  ledgerRows={selectedLedger.data}
                  onDeploy={() => setDeployOpen(true)}
                  selectedAgent={selectedAgent}
                  selectedWalletAddress={selectedWalletAddress}
                  vendorCount={liveVendors.data.length}
                />
                <AgentsOperationsGrid
                  ledgerRows={selectedLedger.data}
                  selectedAgent={selectedAgent}
                  vendorCount={liveVendors.data.length}
                />
              </>
            ) : null}

            <div className="border border-[#282C34] bg-[#181B21]">
              <PanelHeader
                title="AGENT REGISTER"
                meta={`${String(agentCounts.ALL).padStart(2, "0")} WALLETS`}
              />
              <div className="overflow-x-auto">
                <div className="min-w-[1180px]">
                  <div className="grid grid-cols-[100px_minmax(190px,1.3fr)_118px_minmax(150px,1.1fr)_92px_92px_minmax(130px,1fr)_104px_minmax(250px,0.95fr)] items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.13em] text-[#5B626C]">
                    <span>STATUS</span>
                    <span>AGENT</span>
                    <span>POSTURE</span>
                    <span>DAILY SPEND</span>
                    <span>CATEGORIES</span>
                    <span>DEVIATION</span>
                    <span>DOCTRINE</span>
                    <span>LAST EVENT</span>
                    <span className="text-right">ACTIONS</span>
                  </div>
                  {liveAgents.isError && baseRows.length === 0 ? (
                    <ErrorState
                      cause="agent query failed"
                      onRetry={() => void liveAgents.refetch()}
                    />
                  ) : rows.length > 0 ? (
                    rows.map((agent) => {
                      const rowKey = agentRowKey(agent);
                      return (
                        <AgentRegisterRow
                          key={rowKey}
                          agent={agent}
                          selected={rowKey === selectedWalletKey}
                          onSelect={() => setSelectedAgentKey(rowKey)}
                        />
                      );
                    })
                  ) : agentFiltersActive && baseRows.length > 0 ? (
                    <EmptyState
                      actionLabel={agentQuery.trim() ? "CLEAR SEARCH" : "RESET FILTERS"}
                      description={
                        agentQuery.trim()
                          ? `No agents match "${agentQuery.trim()}". Clear search or try another term.`
                          : "No agents match this filter. Reset filters or try another term."
                      }
                      onAction={resetAgentFilters}
                      title="NO AGENTS MATCH THIS FILTER"
                    />
                  ) : (
                    <EmptyState description={emptyAgents.description} title={emptyAgents.title} />
                  )}
                  <div className="flex h-9 items-center justify-between border-t border-[#282C34] px-4 text-[10px] tracking-[0.14em] text-[#5B626C]">
                    <span>
                      {String(agentCounts.ALL).padStart(2, "0")} WALLETS /{" "}
                      {String(agentCounts.ACTIVE).padStart(2, "0")} ACTIVE /{" "}
                      {String(agentCounts.FROZEN).padStart(2, "0")} UNDER RESTRAINT
                    </span>
                    <span>FLEET POSTURE {averagePosture} / 100</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <AgentsFirstRunPanel mode={workspace.dataMode} onDeploy={() => setDeployOpen(true)} />
        )}
      </Main>
      {deployOpen ? (
        <DeployAgentModal
          onClose={() => setDeployOpen(false)}
          onWalletCreated={handleWalletCreated}
        />
      ) : null}
    </GovernanceFrame>
  );
}

type AgentLedgerRows = ReturnType<typeof useLiveLedger>["data"];

function AgentsSetupGrid({
  ledgerRows,
  onDeploy,
  selectedAgent,
  selectedWalletAddress,
  vendorCount,
}: Readonly<{
  ledgerRows: AgentLedgerRows;
  onDeploy: () => void;
  selectedAgent: AgentDisplay;
  selectedWalletAddress: Address | null;
  vendorCount: number;
}>) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(380px,1.08fr)] 2xl:grid-cols-[minmax(280px,0.82fr)_minmax(440px,1.05fr)_minmax(300px,0.78fr)]">
      <SelectedWalletOverview agent={selectedAgent} walletAddress={selectedWalletAddress} />
      <AgentSignerPanel governedWalletAddress={selectedWalletAddress} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
        <DoctrineMiniSnapshot agent={selectedAgent} />
        <WalletSetupRail
          ledgerCount={ledgerRows.length}
          onDeploy={onDeploy}
          selectedWalletAddress={selectedWalletAddress}
          vendorCount={vendorCount}
        />
      </div>
    </section>
  );
}

function AgentsOperationsGrid({
  ledgerRows,
  selectedAgent,
  vendorCount,
}: Readonly<{
  ledgerRows: AgentLedgerRows;
  selectedAgent: AgentDisplay;
  vendorCount: number;
}>) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.38fr)]">
      <RecentWalletActivity ledgerRows={ledgerRows} />
      <div className="border border-[#282C34] bg-[#181B21]">
        <PanelHeader title="READINESS" meta="SETUP CONTROLS" />
        <div className="divide-y divide-[#1E222A] text-[12px]">
          <ReadinessRow
            href="/vendors"
            label="VENDORS"
            state={vendorCount > 0 ? `${vendorCount} configured` : "Add approved vendor"}
            tone={vendorCount > 0 ? "ready" : "action"}
          />
          <ReadinessRow
            href={`/agents/${encodeURIComponent(selectedAgent.fullWallet ?? selectedAgent.id ?? "")}/policy`}
            label="POLICY"
            state={selectedAgent.doctrine || "Configure policy"}
            tone="ready"
          />
          <ReadinessRow
            href="/ledger"
            label="ACTIVITY"
            state={ledgerRows.length > 0 ? `${ledgerRows.length} indexed` : "No activity yet"}
            tone={ledgerRows.length > 0 ? "ready" : "quiet"}
          />
        </div>
      </div>
    </section>
  );
}

function WalletSignerSummary({
  candidates,
  isLoading,
  walletAddress,
}: Readonly<{
  candidates: Address[];
  isLoading: boolean;
  walletAddress: Address | null;
}>) {
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const [verifiedSigners, setVerifiedSigners] = useState<Address[]>([]);
  const [verificationStatus, setVerificationStatus] = useState<
    "idle" | "checking" | "ready" | "error"
  >("idle");

  useEffect(() => {
    let cancelled = false;

    if (!walletAddress || !publicClient || candidates.length === 0) {
      setVerifiedSigners([]);
      setVerificationStatus(walletAddress && candidates.length > 0 ? "error" : "idle");
      return () => {
        cancelled = true;
      };
    }

    setVerificationStatus("checking");
    Promise.all(
      candidates.map(async (candidate) => {
        const authorized = (await publicClient.readContract({
          address: walletAddress,
          abi: guardedWalletControlAbi,
          functionName: "agentSigners",
          args: [candidate],
        })) as boolean;

        return authorized ? candidate : null;
      }),
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        setVerifiedSigners(results.filter((candidate): candidate is Address => Boolean(candidate)));
        setVerificationStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setVerifiedSigners([]);
        setVerificationStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [candidates, publicClient, walletAddress]);

  if (isLoading) {
    return <span className="text-[#8A909B]">Loading signer state</span>;
  }
  if (candidates.length === 0) {
    return <span className="text-[#8A909B]">No signer authorized</span>;
  }
  if (verificationStatus === "checking") {
    return <span className="text-[#E0A04A]">Verifying saved signer on Arc Testnet</span>;
  }
  if (verificationStatus === "error") {
    return <span className="text-[#EC7A6B]">Signer readback unavailable</span>;
  }
  if (verifiedSigners.length === 0) {
    return <span className="text-[#EC7A6B]">Saved signer not authorized on contract</span>;
  }
  if (verifiedSigners.length === 1) {
    return <span className="text-[#D7DBE0]">1 signer: {shortAddress(verifiedSigners[0])}</span>;
  }

  return <span className="text-[#D7DBE0]">{verifiedSigners.length} signers authorized</span>;
}

function SelectedWalletOverview({
  agent,
  walletAddress,
}: Readonly<{ agent: AgentDisplay; walletAddress: Address | null }>) {
  const workspace = useWorkspaceMode();
  const signerPolicyQuery = trpc.agents.policy.useQuery(
    { walletId: walletAddress ?? zeroEvmAddress },
    {
      enabled: workspace.isAuthenticated && Boolean(walletAddress),
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: false,
      staleTime: 30_000,
    },
  );
  const signerCandidates = useMemo(
    () => signerCandidatesFromPolicy(signerPolicyQuery.data),
    [signerPolicyQuery.data],
  );
  const copyWallet = async () => {
    if (!walletAddress) {
      return;
    }

    try {
      await navigator.clipboard.writeText(walletAddress);
      toast.success("GOVERNED WALLET COPIED", { description: shortAddress(walletAddress) });
    } catch {
      toast.error("GOVERNED WALLET COPY FAILED");
    }
  };
  const agentHref = `/agents/${encodeURIComponent(walletAddress ?? agent.id ?? agent.wallet)}`;
  const explorerHref = walletAddress ? `/explorer/${walletAddress}` : null;

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader title="SELECTED GOVERNED WALLET" meta={agent.status} />
      <div className="space-y-4 p-4">
        <div>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-cond text-[30px] font-semibold leading-none text-[#EDF0F3]">
                {agent.name}
              </div>
              <button
                type="button"
                onClick={() => void copyWallet()}
                disabled={!walletAddress}
                className="mt-2 flex max-w-full items-center gap-1.5 font-mono text-[11px] text-[#8A909B] hover:text-[#FF5A1F] disabled:cursor-not-allowed disabled:hover:text-[#8A909B]"
              >
                <span className="min-w-0 truncate">
                  {walletAddress ?? "No governed wallet address"}
                </span>
                {walletAddress ? (
                  <Copy className="h-3.5 w-3.5 shrink-0" strokeWidth={iconStroke} />
                ) : null}
              </button>
              <div className="mt-2 flex max-w-full items-center gap-2 text-[11px]">
                <span className="shrink-0 text-[10px] tracking-[0.14em] text-[#5B626C]">
                  SIGNER
                </span>
                <span className="min-w-0 truncate" title={signerCandidates.join(", ")}>
                  <WalletSignerSummary
                    candidates={signerCandidates}
                    isLoading={signerPolicyQuery.isLoading}
                    walletAddress={walletAddress}
                  />
                </span>
              </div>
            </div>
            <StatusLabel status={agent.status} align="right" />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
            <WalletMetric
              label="POSTURE"
              value={String(agent.posture)}
              accent={agent.postureColor}
            />
            <WalletMetric label="SPEND" value={agent.spend} />
            <WalletMetric label="LIMIT" value={agent.limit} />
            <WalletMetric label="LAST" value={agent.last} />
          </div>
        </div>

        <div>
          <div className="mb-2 text-[10px] tracking-[0.16em] text-[#5B626C]">
            ALLOWED CATEGORIES
          </div>
          <div className="flex flex-wrap gap-1.5">
            {agent.categories.length > 0 ? (
              agent.categories.map((category) => (
                <span
                  key={category}
                  className="border border-[#282C34] bg-[#15181D] px-2 py-1 text-[10px] tracking-[0.12em] text-[#8A909B]"
                >
                  {category}
                </span>
              ))
            ) : (
              <span className="border border-[#282C34] bg-[#15181D] px-2 py-1 text-[10px] tracking-[0.12em] text-[#5B626C]">
                No category spend yet
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={agentHref}
            className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
          >
            VIEW DETAILS <ArrowUpRight className="h-3 w-3" strokeWidth={iconStroke} />
          </Link>
          <Link
            href={`${agentHref}/policy`}
            className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            POLICY
          </Link>
          {explorerHref ? (
            <Link
              href={explorerHref}
              className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
            >
              EXPLORER
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WalletMetric({
  accent,
  label,
  value,
}: Readonly<{ accent?: string; label: string; value: string }>) {
  return (
    <div className="border border-[#282C34] bg-[#15181D] p-3">
      <div className="text-[9px] tracking-[0.16em] text-[#5B626C]">{label}</div>
      <div className="mt-1 truncate text-[13px] text-[#D7DBE0]" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

function DoctrineMiniSnapshot({ agent }: Readonly<{ agent: AgentDisplay }>) {
  const rows = [
    ["DOCTRINE", agent.doctrine],
    ["DAILY LIMIT", agent.limit],
    ["SPEND TODAY", agent.spend],
    ["DEVIATION", agent.deviation],
  ] as const;

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader title="DOCTRINE SNAPSHOT" meta="POLICY CONTROL" />
      <div className="divide-y divide-[#1E222A] text-[12px]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">{label}</span>
            <span className="min-w-0 truncate text-[#D7DBE0]">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletSetupRail({
  ledgerCount,
  onDeploy,
  selectedWalletAddress,
  vendorCount,
}: Readonly<{
  ledgerCount: number;
  onDeploy: () => void;
  selectedWalletAddress: Address | null;
  vendorCount: number;
}>) {
  const steps = [
    ["01", "Governed wallet", selectedWalletAddress ? "selected" : "missing"],
    ["02", "Agent signer", "configure in panel"],
    ["03", "Vendor allowlist", vendorCount > 0 ? `${vendorCount} configured` : "add vendor"],
    ["04", "Activity", ledgerCount > 0 ? `${ledgerCount} indexed` : "no activity yet"],
  ] as const;

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader title="SETUP SEQUENCE" meta="NEXT ACTIONS" />
      <div className="space-y-3 p-4">
        {steps.map(([index, label, state]) => (
          <div key={label} className="grid grid-cols-[34px_minmax(0,1fr)] gap-3">
            <div className="flex h-7 w-7 items-center justify-center border border-[#282C34] text-[10px] text-[#8A909B]">
              {index}
            </div>
            <div className="min-w-0">
              <div className="text-[12px] text-[#D7DBE0]">{label}</div>
              <div className="text-[10px] tracking-[0.12em] text-[#5B626C]">{state}</div>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={onDeploy}
            className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} /> DEPLOY ANOTHER
          </button>
          <Link
            href="/vendors?action=add"
            className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            VENDORS
          </Link>
        </div>
      </div>
    </div>
  );
}

function RecentWalletActivity({ ledgerRows }: Readonly<{ ledgerRows: AgentLedgerRows }>) {
  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader
        title="RECENT WALLET ACTIVITY"
        meta={ledgerRows.length > 0 ? `${ledgerRows.length} INDEXED` : "EMPTY LIVE STATE"}
      />
      {ledgerRows.length > 0 ? (
        <div className="divide-y divide-[#1E222A] text-[12px]">
          {ledgerRows.slice(0, 4).map((entry) => (
            <div
              key={entry.id}
              className="grid grid-cols-[minmax(0,1fr)_90px_104px] items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[#D7DBE0]">{entry.counterparty}</div>
                <div className="mt-0.5 text-[10px] tracking-[0.1em] text-[#5B626C]">
                  {entry.category.toUpperCase()} / {entry.timestamp}
                </div>
              </div>
              <div className="text-right text-[#8A909B]">{amountLabel(entry.amount)}</div>
              <div className="text-right text-[10px] tracking-[0.12em] text-[#6E9E7C]">
                {entry.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No activity yet"
          description="Agent payment intents, policy updates, transfers, and escalations will appear here once this governed wallet is active."
        />
      )}
    </div>
  );
}

function ReadinessRow({
  href,
  label,
  state,
  tone,
}: Readonly<{ href: string; label: string; state: string; tone: "ready" | "action" | "quiet" }>) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#1B1F26]"
    >
      <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">{label}</span>
      <span
        className={cn(
          "min-w-0 truncate text-right text-[11px]",
          tone === "ready"
            ? "text-[#6E9E7C]"
            : tone === "action"
              ? "text-[#FF5A1F]"
              : "text-[#8A909B]",
        )}
      >
        {state}
      </span>
    </Link>
  );
}

function AgentsFirstRunPanel({
  mode,
  onDeploy,
}: Readonly<{ mode: ReturnType<typeof useWorkspaceMode>["dataMode"]; onDeploy: () => void }>) {
  const copy =
    mode === "disconnected"
      ? {
          title: "Connect wallet to load governed wallets",
          body: "Connect your owner wallet, then sign in to deploy or manage Arc Testnet governed wallets.",
          primary: "CONNECT IN HEADER",
        }
      : mode === "connected_unsigned"
        ? {
            title: "Sign in to load governed wallets",
            body: "Sign the wallet challenge before Arcanum loads private wallet, signer, vendor, and policy state.",
            primary: "SIGN IN REQUIRED",
          }
        : {
            title: "Deploy your first governed wallet",
            body: "Create a policy-controlled Arc Testnet wallet, then authorize the public signer address controlled by your agent backend.",
            primary: "DEPLOY GOVERNED WALLET",
          };

  const steps = [
    ["01", "Deploy governed wallet", "Create the owner-controlled wallet on Arc Testnet."],
    ["02", "Authorize agent signer", "Add the public address controlled by your agent backend."],
    ["03", "Add vendor + policy", "Define approved destinations and spending limits."],
  ] as const;

  return (
    <section className="w-full max-w-[calc(100vw-1.5rem)] min-w-0 overflow-hidden border border-[#282C34] bg-[#181B21] p-5 sm:max-w-full md:p-6">
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.28em] text-[#FF5A1F]">AGENT CONTROL SETUP</div>
          <h1 className="mt-3 max-w-full break-words font-cond text-[34px] font-semibold leading-none text-[#EDF0F3] md:text-[44px]">
            {copy.title}
          </h1>
          <p className="mt-3 max-w-[580px] text-[13px] leading-relaxed text-[#9AA1AC]">
            {copy.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {mode === "live_empty" ? (
              <button
                type="button"
                onClick={onDeploy}
                className="flex h-9 items-center gap-2 border border-[#FF5A1F]/60 px-3 text-[10px] tracking-[0.14em] text-[#FF5A1F] hover:bg-[#1c1107]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                {copy.primary}
              </button>
            ) : (
              <div className="border border-[#282C34] px-3 py-2 text-[10px] tracking-[0.14em] text-[#8A909B]">
                {copy.primary}
              </div>
            )}
            <Link
              href="/docs"
              className="flex h-9 items-center gap-2 border border-[#282C34] px-3 text-[10px] tracking-[0.14em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              VIEW SETUP GUIDE <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            </Link>
          </div>
        </div>
        <div className="grid min-w-0 gap-3">
          {steps.map(([index, title, body]) => (
            <div
              key={title}
              className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 border border-[#282C34] bg-[#15181D] p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center border border-[#3A4250] text-[11px] text-[#8A909B]">
                {index}
              </div>
              <div className="min-w-0">
                <div className="text-[13px] text-[#D7DBE0]">{title}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-[#6F7682]">{body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DeployAgentModal({
  onClose,
  onWalletCreated,
}: Readonly<{ onClose: () => void; onWalletCreated: (result: CreatedWalletResult) => void }>) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const recordCreatedWallet = trpc.agents.recordCreatedWallet.useMutation();
  const deployment = deployContractStatus();
  const walletFactoryAddress = configuredAddress(process.env.NEXT_PUBLIC_WALLET_FACTORY);
  const missingLabels = deployment.contracts
    .filter((contract) => !contract.configured)
    .map((contract) => contract.label);
  const [form, setForm] = useState<DeployWalletFormState>(initialDeployWalletForm);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [createdWallet, setCreatedWallet] = useState<Address | null>(null);
  const [predictedWallet, setPredictedWallet] = useState<Address | null>(null);
  const [status, setStatus] = useState<"idle" | "confirming" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [persistenceState, setPersistenceState] = useState<
    "idle" | "saving" | "supabase" | "supabase_failed" | "supabase_unconfigured"
  >("idle");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [pendingSyncInput, setPendingSyncInput] = useState<CreatedWalletSyncInput | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedGovernanceOpen, setAdvancedGovernanceOpen] = useState(false);
  const submittingRef = useRef(false);
  const readyForTransaction =
    deployment.ready && walletFactoryAddress !== null && isConnected && chainId === arcTestnet.id;
  const isBusy = writePending || switchPending || status === "confirming" || submittingRef.current;
  const primaryDisabled =
    isBusy ||
    !deployment.ready ||
    !isConnected ||
    (chainId === arcTestnet.id && !readyForTransaction);

  useEffect(() => {
    if (!address) {
      return;
    }

    setForm((current) => ({
      ...current,
      signerAddresses: current.signerAddresses || address,
      councilAddresses: current.councilAddresses || address,
    }));
  }, [address]);

  const updateForm = (key: keyof DeployWalletFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const resetForAnotherWallet = () => {
    setForm({
      ...initialDeployWalletForm,
      signerAddresses: address ?? "",
      councilAddresses: address ?? "",
    });
    setTxHash(null);
    setCreatedWallet(null);
    setPredictedWallet(null);
    setStatus("idle");
    setError(null);
    setPersistenceState("idle");
    setPersistenceMessage(null);
    setPendingSyncInput(null);
  };

  const syncCreatedWallet = async (input: CreatedWalletSyncInput) => {
    setPersistenceState("saving");
    setPersistenceMessage(null);

    try {
      const persisted = await recordCreatedWallet.mutateAsync(input);
      setPersistenceState(persisted.dataSource);
      setPersistenceMessage(
        persisted.dataSource === "supabase"
          ? null
          : (persisted.message ??
              "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync."),
      );
      return persisted.dataSource;
    } catch (persistError) {
      const message = errorMessage(persistError);
      setPersistenceState("supabase_failed");
      setPersistenceMessage(
        message ||
          "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync.",
      );
      return "supabase_failed" as const;
    }
  };

  const handleCreateWallet = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("walletFactory.createWallet", event)) {
      return;
    }

    if (!isConnected || !address) {
      setError("Connect wallet first.");
      setStatus("error");
      return;
    }

    if (chainId !== arcTestnet.id) {
      setError(null);
      setStatus("idle");
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch (caught) {
        setStatus("error");
        setError(errorMessage(caught));
      }
      return;
    }

    if (!deployment.ready || !walletFactoryAddress) {
      setError("Configure deployed contract addresses before creating a governed wallet.");
      setStatus("error");
      return;
    }

    if (!publicClient) {
      setError("Arc Testnet client is not ready. Please retry.");
      setStatus("error");
      return;
    }

    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setError(null);
    setCreatedWallet(null);
    setTxHash(null);
    setPredictedWallet(null);
    setStatus("confirming");
    setPersistenceState("idle");
    setPersistenceMessage(null);
    setPendingSyncInput(null);

    try {
      const label = form.label.trim();
      if (!label) {
        throw new Error("Wallet label is required.");
      }

      const policy = buildWalletPolicy(form);
      const signers = parseAddressList(form.signerAddresses, address, "Agent signers");
      const council = parseAddressList(form.councilAddresses, address, "Escalation council");
      const quorum = Number.parseInt(form.quorum, 10);
      if (!Number.isInteger(quorum) || quorum < 1 || quorum > 255) {
        throw new Error("Quorum must be a whole number between 1 and 255.");
      }

      if (quorum > council.length) {
        throw new Error("Quorum cannot be greater than the number of council addresses.");
      }

      const nonce = await publicClient.readContract({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "nonces",
        args: [address],
      });
      const predicted = await publicClient.readContract({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "predictWallet",
        args: [address, label, nonce, policy, signers, council, quorum],
      });
      setPredictedWallet(predicted);

      const hash = await writeContractAsync({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "createWallet",
        args: [address, label, policy, signers, council, quorum],
        chainId: arcTestnet.id,
      });
      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const wallet = walletCreatedFromReceipt(receipt.logs) ?? predicted;
      const createdResult: CreatedWalletResult = {
        wallet,
        txHash: hash,
        label,
        perTxCap: form.perTxCap,
        dailyCap: form.dailyCap,
        monthlyCap: form.monthlyCap,
        escalationThreshold: form.escalationAmount,
        requireAllowlist: form.requireAllowlist,
      };
      setCreatedWallet(wallet);
      setStatus("success");
      onWalletCreated(createdResult);
      const syncInput = {
        walletAddress: wallet,
        ownerAddress: address,
        label,
        deployTxHash: hash,
        chainId: arcTestnet.id,
        perTxCap: Number(form.perTxCap),
        dailyCap: Number(form.dailyCap),
        monthlyCap: Number(form.monthlyCap),
        escalationThreshold: Number(form.escalationAmount),
        requireAllowlist: form.requireAllowlist,
        signers,
        council,
        quorum,
      } satisfies CreatedWalletSyncInput;
      setPendingSyncInput(syncInput);
      const persistence = await syncCreatedWallet(syncInput);

      if (persistence === "supabase") {
        toast.success("GOVERNED WALLET CREATED", {
          description: `${shortAddress(wallet)} saved to Supabase`,
        });
      } else {
        toast.warning("WALLET DEPLOYED - SUPABASE SYNC FAILED", {
          description: "Save the wallet address and retry sync.",
        });
      }
    } catch (caught) {
      setStatus("error");
      setError(errorMessage(caught));
    } finally {
      submittingRef.current = false;
    }
  };

  const primaryLabel = !deployment.ready
    ? "DEPLOYMENT CONFIG REQUIRED"
    : !isConnected
      ? "CONNECT WALLET FIRST"
      : chainId !== arcTestnet.id
        ? switchPending
          ? "SWITCHING NETWORK"
          : "SWITCH TO ARC TESTNET"
        : status === "confirming" || writePending
          ? txHash
            ? "WAITING FOR RECEIPT"
            : "CONFIRM IN WALLET"
          : "CREATE GOVERNED WALLET";

  const hasSuccess = status === "success" && createdWallet !== null && txHash !== null;
  const createdAgentHref = createdWallet ? `/agents/${createdWallet}` : "/agents";
  const createdWalletArcscanUrl = getArcscanAddressUrl(createdWallet);
  const txArcscanUrl = getArcscanTxUrl(txHash);
  const persistenceFailed =
    persistenceState === "supabase_failed" || persistenceState === "supabase_unconfigured";

  const copyCreatedWallet = async () => {
    if (!createdWallet) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdWallet);
      toast.success("WALLET ADDRESS COPIED");
    } catch {
      toast.error("WALLET ADDRESS COPY FAILED");
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close deploy dialog"
        className="fixed inset-0 z-50 bg-[#0a0b0e]/70"
        onClick={onClose}
      />
      <section className="fixed left-1/2 top-1/2 z-[60] max-h-[calc(100vh-32px)] w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-[#282C34] bg-[#181B21] shadow-[0_0_60px_rgba(0,0,0,0.65)]">
        <div className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
          <div className="text-[11px] tracking-[0.18em] text-[#D7DBE0]">DEPLOY GOVERNED WALLET</div>
          <button
            type="button"
            aria-label="Close deploy dialog"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <X className="h-4 w-4" strokeWidth={iconStroke} />
          </button>
        </div>
        <div className="space-y-4 p-5 text-[12px] leading-relaxed text-[#8A909B]">
          <p>
            {!deployment.ready
              ? `Deployment is paused until ${missingLabels.join(", ")} ${
                  missingLabels.length === 1 ? "is" : "are"
                } configured in the frontend environment.`
              : isConnected
                ? chainId === arcTestnet.id
                  ? "Arc Testnet contracts are ready. WalletFactory is configured for real governed wallet creation."
                  : "Wallet is connected. Switch to Arc Testnet before creating a governed wallet."
                : "Connect and authenticate wallet to deploy a governed wallet."}
          </p>
          <div className="flex items-center justify-between border border-[#282C34] bg-[#101216] px-3 py-2">
            <span className={deployment.ready ? "text-[#6E9E7C]" : "text-[#FF5A1F]"}>
              {deployment.ready ? "ARC TESTNET CONTRACTS READY" : "DEPLOYMENT CONFIG INCOMPLETE"}
            </span>
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="cursor-pointer text-[10px] tracking-[0.14em] text-[#8A909B] hover:text-[#D7DBE0]"
            >
              ADVANCED DEPLOYMENT DETAILS {advancedOpen ? "-" : "+"}
            </button>
          </div>
          {advancedOpen ? (
            <div className="space-y-2 border border-[#282C34] bg-[#101216] p-3">
              {deployment.contracts.map((contract) => (
                <div
                  key={contract.label}
                  className="grid grid-cols-[170px_minmax(0,1fr)_72px] items-center gap-3 text-[10px] tracking-[0.12em]"
                >
                  <span className="text-[#5B626C]">{contract.label}</span>
                  <span
                    className={cn(
                      "min-w-0 truncate font-mono",
                      contract.configured ? "text-[#D7DBE0]" : "text-[#FF5A1F]",
                    )}
                    title={contract.value ?? "not configured"}
                  >
                    {contract.configured ? shortAddress(contract.value ?? "") : "MISSING"}
                  </span>
                  <span className={contract.configured ? "text-[#6E9E7C]" : "text-[#FF5A1F]"}>
                    {contract.configured ? "READY" : "MISSING"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {hasSuccess ? (
            <div
              className={cn(
                "space-y-4 border bg-[#101813] p-4",
                persistenceFailed ? "border-[#E0A04A]" : "border-[#2F4F3A]",
              )}
            >
              <div>
                <div className="text-[10px] tracking-[0.18em] text-[#6E9E7C]">
                  GOVERNED WALLET CREATED
                </div>
                <div className="mt-2 font-mono text-[18px] text-[#EDF0F3]">
                  {shortAddress(createdWallet)}
                </div>
                <div className="mt-1 text-[11px] tracking-[0.08em] text-[#8A909B]">
                  {persistenceState === "supabase"
                    ? "PENDING INDEXER SYNC - SAVED TO SUPABASE"
                    : persistenceState === "saving"
                      ? "PENDING INDEXER SYNC - SAVING READ MODEL"
                      : persistenceFailed
                        ? "ON-CHAIN DEPLOYED - SUPABASE SYNC FAILED"
                        : "PENDING INDEXER SYNC"}
                </div>
              </div>
              {persistenceFailed ? (
                <div className="border border-[#E0A04A55] bg-[#1B1710] p-3 text-[11px] leading-relaxed text-[#E0A04A]">
                  {persistenceMessage ??
                    "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync."}
                </div>
              ) : null}
              <div className="space-y-2 border border-[#282C34] bg-[#101216] p-3 text-[10px] tracking-[0.12em]">
                <DeployResultLine
                  label="GUARDEDWALLET"
                  value={createdWallet}
                  href={createdWalletArcscanUrl ?? undefined}
                />
                <DeployResultLine label="TX HASH" value={txHash} href={txArcscanUrl ?? undefined} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={createdAgentHref}
                  onClick={onClose}
                  className="flex h-9 cursor-pointer items-center justify-center border border-[#FF5A1F] text-[11px] tracking-[0.12em] text-[#FF5A1F] hover:bg-[#FF5A1F] hover:text-[#0B0D10]"
                >
                  VIEW GOVERNED WALLET
                </Link>
                <a
                  href={txArcscanUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 cursor-pointer items-center justify-center border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
                >
                  VIEW TRANSACTION
                </a>
                <button
                  type="button"
                  onClick={() => void copyCreatedWallet()}
                  className="flex h-9 cursor-pointer items-center justify-center border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
                >
                  COPY WALLET ADDRESS
                </button>
                {persistenceFailed && pendingSyncInput ? (
                  <button
                    type="button"
                    onClick={() => void syncCreatedWallet(pendingSyncInput)}
                    disabled={recordCreatedWallet.isPending}
                    className="flex h-9 cursor-pointer items-center justify-center border border-[#E0A04A] text-[11px] tracking-[0.12em] text-[#E0A04A] hover:bg-[#E0A04A] hover:text-[#0B0D10] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {recordCreatedWallet.isPending ? "SYNCING SUPABASE" : "RETRY SUPABASE SYNC"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetForAnotherWallet}
                  className={cn(
                    "flex h-9 cursor-pointer items-center justify-center border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]",
                    persistenceFailed ? "col-span-2" : "",
                  )}
                >
                  CREATE ANOTHER WALLET
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="col-span-2 flex h-9 cursor-pointer items-center justify-center border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">
                  CREATE A GOVERNED WALLET ON ARC TESTNET
                </div>
                <div className="mt-1 text-[12px] text-[#D7DBE0]">
                  Contracts ready. Choose a wallet name and simple spend limits.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedGovernanceOpen((open) => !open)}
                className="flex h-10 w-full cursor-pointer items-center justify-between border border-[#282C34] bg-[#101216] px-3 text-[10px] tracking-[0.14em] text-[#8A909B] hover:text-[#D7DBE0]"
              >
                <span>ADVANCED GOVERNANCE SETTINGS</span>
                <span>{advancedGovernanceOpen ? "-" : "+"}</span>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">WALLET OWNER</span>
                  <div className="flex h-9 w-full items-center border border-[#282C34] bg-[#101216] px-3 font-mono text-[11px] text-[#D7DBE0]">
                    {address ? shortAddress(address) : "connect wallet"}
                  </div>
                </div>
                <label className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">WALLET LABEL</span>
                  <input
                    value={form.label}
                    onChange={(event) => updateForm("label", event.target.value)}
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className={cn("space-y-1", !advancedGovernanceOpen && "hidden")}>
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">QUORUM</span>
                  <input
                    value={form.quorum}
                    onChange={(event) => updateForm("quorum", event.target.value)}
                    inputMode="numeric"
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    PER TX CAP / USDC
                  </span>
                  <input
                    value={form.perTxCap}
                    onChange={(event) => updateForm("perTxCap", event.target.value)}
                    inputMode="decimal"
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    DAILY CAP / USDC
                  </span>
                  <input
                    value={form.dailyCap}
                    onChange={(event) => updateForm("dailyCap", event.target.value)}
                    inputMode="decimal"
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className={cn("space-y-1", !advancedGovernanceOpen && "hidden")}>
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    MONTHLY CAP / USDC
                  </span>
                  <input
                    value={form.monthlyCap}
                    onChange={(event) => updateForm("monthlyCap", event.target.value)}
                    inputMode="decimal"
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className={cn("space-y-1", !advancedGovernanceOpen && "hidden")}>
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    ESCALATE ABOVE / USDC
                  </span>
                  <input
                    value={form.escalationAmount}
                    onChange={(event) => updateForm("escalationAmount", event.target.value)}
                    inputMode="decimal"
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
              </div>
              <div className={cn("grid grid-cols-2 gap-3", !advancedGovernanceOpen && "hidden")}>
                <label className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    AGENT SIGNERS / COMMA SEPARATED
                  </span>
                  <input
                    value={form.signerAddresses}
                    onChange={(event) => updateForm("signerAddresses", event.target.value)}
                    placeholder={address ?? "0x..."}
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 font-mono text-[11px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">
                    ESCALATION COUNCIL / COMMA SEPARATED
                  </span>
                  <input
                    value={form.councilAddresses}
                    onChange={(event) => updateForm("councilAddresses", event.target.value)}
                    placeholder={address ?? "0x..."}
                    className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 font-mono text-[11px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                  />
                </label>
              </div>
              <label
                className={cn(
                  "flex items-center gap-2 text-[10px] tracking-[0.14em] text-[#8A909B]",
                  !advancedGovernanceOpen && "hidden",
                )}
              >
                <input
                  type="checkbox"
                  checked={form.requireAllowlist}
                  onChange={(event) => updateForm("requireAllowlist", event.target.checked)}
                  className="h-3.5 w-3.5 accent-[#FF5A1F]"
                />
                REQUIRE VENDOR ALLOWLIST / ALL CATEGORIES ENABLED
              </label>
              {predictedWallet || txHash || createdWallet ? (
                <div className="space-y-2 border border-[#282C34] bg-[#101216] p-3 text-[10px] tracking-[0.12em]">
                  {predictedWallet ? (
                    <DeployResultLine label="PREDICTED WALLET" value={predictedWallet} />
                  ) : null}
                  {txHash ? (
                    <DeployResultLine
                      label="TX HASH"
                      value={txHash}
                      href={txArcscanUrl ?? undefined}
                    />
                  ) : null}
                  {createdWallet ? (
                    <DeployResultLine
                      label="GUARDEDWALLET"
                      value={createdWallet}
                      href={createdWalletArcscanUrl ?? undefined}
                    />
                  ) : null}
                  {status === "success" ? (
                    <div className="pt-1 text-[#6E9E7C]">
                      CREATED ON ARC TESTNET / INDEXER OR READ MODEL STATE MAY LAG
                    </div>
                  ) : null}
                </div>
              ) : null}
              {error ? (
                <div className="border border-[#FF5A1F]/45 bg-[#1a1207] px-3 py-2 text-[11px] text-[#FF5A1F]">
                  {error}
                </div>
              ) : null}
              <button
                type="button"
                disabled={primaryDisabled}
                onClick={handleCreateWallet}
                title={
                  !deployment.ready
                    ? "Configure deployed contract addresses before deploying a governed wallet."
                    : !isConnected
                      ? "Connect wallet first."
                      : chainId !== arcTestnet.id
                        ? "Switch wallet network to Arc Testnet."
                        : "Create a GuardedWallet on Arc Testnet."
                }
                className={cn(
                  "flex h-9 w-full items-center justify-center border text-[11px] tracking-[0.12em]",
                  primaryDisabled
                    ? "cursor-not-allowed border-[#282C34] text-[#5B626C] opacity-70"
                    : "cursor-pointer border-[#3A4250] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]",
                )}
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-full items-center justify-center border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
              >
                ACKNOWLEDGE
              </button>
            </>
          )}
        </div>
      </section>
    </>
  );
}

function DeployResultLine({
  href,
  label,
  value,
}: Readonly<{ href?: string; label: string; value: string }>) {
  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} COPIED`);
    } catch {
      toast.error(`${label} COPY FAILED`);
    }
  };

  return (
    <div className="grid grid-cols-[150px_minmax(0,1fr)_auto] items-center gap-2">
      <span className="text-[#5B626C]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate font-mono text-[#D7DBE0] hover:text-[#FF5A1F]"
          title={value}
        >
          {shortAddress(value)}
        </a>
      ) : (
        <span className="min-w-0 truncate font-mono text-[#D7DBE0]" title={value}>
          {shortAddress(value)}
        </span>
      )}
      <button
        type="button"
        onClick={() => void copyValue()}
        className="flex h-6 w-6 cursor-pointer items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
      </button>
    </div>
  );
}

function AgentRegisterRow({
  agent,
  onSelect,
  selected,
}: Readonly<{ agent: AgentDisplay; onSelect?: () => void; selected?: boolean }>) {
  const [status, setStatus] = useState(agent.status);
  const utils = trpc.useUtils();
  const freeze = trpc.agents.freeze.useMutation();
  const unfreeze = trpc.agents.unfreeze.useMutation();
  const frozen = status === "FROZEN";
  const walletId = agent.fullWallet ?? walletAlias[agent.wallet] ?? agent.wallet;
  const agentHref = `/agents/${walletId}`;

  const toggleRestraintRemote = async () => {
    const previous = status;
    setStatus(frozen ? "ACTIVE" : "FROZEN");

    try {
      if (frozen) {
        await unfreeze.mutateAsync({ walletId });
        await utils.agents.list.invalidate();
        toast.success(`${agent.name} RELEASED / governance restored`);
        return;
      }

      await freeze.mutateAsync({ walletId });
      await utils.agents.list.invalidate();
      toast.success(`${agent.name} FROZEN / policy restraint active`);
    } catch (caught) {
      setStatus(previous);
      toast.error(`${agent.name} RESTRAINT FAILED`, {
        description: errorMessage(caught),
      });
    }
  };

  return (
    <RowShell
      danger={frozen}
      className={cn(
        "grid grid-cols-[100px_minmax(190px,1.3fr)_118px_minmax(150px,1.1fr)_92px_92px_minmax(130px,1fr)_104px_minmax(250px,0.95fr)] items-center border-b border-[#1E222A] px-4 py-3",
        selected && "bg-[#1B1F26] shadow-[inset_3px_0_0_#FF5A1F]",
      )}
    >
      <StatusLabel status={status} />
      <div>
        <div className="text-[13px] text-[#EDF0F3]">{agent.name}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#5B626C]">
          {agent.wallet} <CopyIcon />
        </div>
      </div>
      <div>
        <div className="text-[13px]" style={{ color: agent.postureColor }}>
          {agent.posture}
        </div>
        <ProgressLine
          width={agent.posture}
          color={agent.postureColor}
          threshold={false}
          className="w-14"
        />
      </div>
      <div>
        <div className={cn("text-[12px]", frozen ? "text-[#8A909B]" : "text-[#D7DBE0]")}>
          {agent.spend} <span className="text-[#5B626C]">/ {agent.limit}</span>
        </div>
        <ProgressLine width={agent.spendWidth} />
      </div>
      <CategoryBars categories={agent.categories} />
      <span
        className={cn(
          "text-[12px]",
          frozen
            ? "font-medium text-[#FF5A1F]"
            : agent.deviation === formatDeviation(0.8)
              ? "text-[#E0A04A]"
              : "text-[#8A909B]",
        )}
      >
        {agent.deviation}
      </span>
      <span className={cn("text-[12px]", frozen ? "text-[#EC7A6B]" : "text-[#8A909B]")}>
        {agent.doctrine}
      </span>
      <span className="text-[11px] text-[#5B626C]">{agent.last}</span>
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {selected ? (
          <span className="shrink-0 border border-[#FF5A1F]/40 bg-[#1c1107] px-2 py-1 text-[9px] tracking-[0.12em] text-[#FF5A1F]">
            SELECTED
          </span>
        ) : null}
        {selected ? null : (
          <button
            type="button"
            onClick={onSelect}
            className="shrink-0 border border-[#282C34] px-2 py-1 text-[9px] tracking-[0.1em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
          >
            SELECT
          </button>
        )}
        <Link
          href={agentHref}
          className="shrink-0 border border-[#282C34] px-2 py-1 text-[9px] tracking-[0.1em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
        >
          DETAILS
        </Link>
        <Link
          href={`${agentHref}/policy`}
          className="shrink-0 border border-[#282C34] px-2 py-1 text-[9px] tracking-[0.1em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
        >
          POLICY
        </Link>
        {frozen ? (
          <button
            type="button"
            onClick={(event) => {
              if (!allowTrustedMutation("agents.unfreeze", event)) {
                return;
              }
              void toggleRestraintRemote();
            }}
            className="flex h-6 items-center justify-center gap-1 border border-[#FF5A1F]/50 px-2 text-[9px] tracking-[0.1em] text-[#FF5A1F] hover:bg-[#1c1107]"
            title="RELEASE"
          >
            <LockOpen className="h-3 w-3" strokeWidth={iconStroke} /> RELEASE
          </button>
        ) : (
          <button
            type="button"
            onClick={(event) => {
              if (!allowTrustedMutation("agents.freeze", event)) {
                return;
              }
              void toggleRestraintRemote();
            }}
            className="flex h-6 w-6 items-center justify-center border border-[#282C34] text-[#8A909B] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
            title="RESTRAIN"
          >
            <Snowflake className="h-3 w-3" strokeWidth={iconStroke} />
          </button>
        )}
      </div>
    </RowShell>
  );
}

export function AgentDossierCanvasPage() {
  const workspace = useWorkspaceMode();
  const liveVendors = useLiveVendors();
  const params = useParams();
  const governedWalletAddress = resolveGovernedWalletAddress(params.walletId);
  const queryWallet = governedWalletAddress ?? "0x0000000000000000000000000000000000000000";
  const walletQueriesEnabled = workspace.isAuthenticated && Boolean(governedWalletAddress);
  const agentQuery = trpc.agents.byWalletId.useQuery(
    { walletId: queryWallet },
    {
      enabled: walletQueriesEnabled,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  );
  const transferQuery = trpc.ledger.byWallet.useQuery(
    { wallet: queryWallet, page: 0, pageSize: 100 },
    {
      enabled: walletQueriesEnabled,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  );
  const policyQuery = trpc.agents.policy.useQuery(
    { walletId: queryWallet },
    {
      enabled: walletQueriesEnabled,
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  );
  const walletTransfers = (transferQuery.data ?? []) as WalletDetailTransfer[];
  const walletPolicy = (policyQuery.data ?? null) as WalletDetailPolicy | null;
  const vendorNames = useMemo(
    () =>
      new Map(
        liveVendors.data.map((vendor) => [vendor.address.toLowerCase(), vendor.name] as const),
      ),
    [liveVendors.data],
  );
  const detailMetrics = useMemo(
    () => walletDetailMetrics(walletTransfers, walletPolicy, vendorNames),
    [walletTransfers, walletPolicy, vendorNames],
  );
  const displayWalletLabel = governedWalletAddress
    ? shortAddress(governedWalletAddress, { head: 6, tail: 5 })
    : "Invalid wallet";
  const agentLabel =
    agentQuery.data?.label?.trim() ||
    (governedWalletAddress ? `Governed Wallet ${displayWalletLabel}` : "Invalid governed wallet");
  const ownerAddress =
    agentQuery.data &&
    "ownerAddress" in agentQuery.data &&
    typeof agentQuery.data.ownerAddress === "string" &&
    isEvmAddress(agentQuery.data.ownerAddress)
      ? agentQuery.data.ownerAddress
      : null;
  const ownerLabel = ownerAddress
    ? shortAddress(ownerAddress)
    : governedWalletAddress
      ? "Owner synced in Supabase"
      : "No wallet selected";
  const postureScore =
    walletTransfers.length > 0 ? Math.max(0, Math.min(100, 72 + detailMetrics.eventsCount)) : 0;
  const postureLabel =
    walletTransfers.length > 0
      ? postureScore >= 70
        ? "FORTIFIED"
        : "WATCHING"
      : governedWalletAddress
        ? "NOT STARTED"
        : "INVALID ROUTE";
  const postureCopy =
    walletTransfers.length > 0
      ? "LIVE INDEXED"
      : governedWalletAddress
        ? "NO INDEXED ACTIVITY"
        : "INVALID WALLET";
  const dailyCapLabel =
    detailMetrics.dailyCap > 0 ? amountLabel(detailMetrics.dailyCap) : "no cap configured";
  const dailySpendWidth =
    detailMetrics.dailyCap > 0
      ? Math.min(100, Math.round((detailMetrics.dailySpend / detailMetrics.dailyCap) * 100))
      : 0;
  const indexerEmptyCopy =
    governedWalletAddress && walletTransfers.length === 0
      ? "Wallet row synced. No indexed activity yet; on-chain event indexing may still be delayed."
      : "Agent payment intents, policy decisions, transfers, and escalations will appear here after this governed wallet is used.";

  return (
    <GovernanceFrame
      active="agents"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / AGENTS / ${displayWalletLabel}`}
    >
      <Main>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,400px)_1fr]">
          <div className="relative border border-[#282C34] bg-[#181B21] p-6">
            <CornerMarks />
            <div className="text-[10px] tracking-[0.28em] text-[#5B626C]">AGENT POSTURE SCORE</div>
            <div className="mt-1 flex items-end gap-4">
              <span className="font-cond text-[112px] font-bold leading-[0.74] text-[#EDF0F3]">
                {String(postureScore).padStart(2, "0")}
              </span>
              <div className="mb-2">
                <div className="text-[15px] font-semibold tracking-[0.06em] text-[#FF5A1F]">
                  {postureLabel}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#8A909B]">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} /> {postureCopy}
                </div>
              </div>
            </div>
            <Gauge value={postureScore} marker={83} markerLabel="83 P" />
            <div className="mt-7 space-y-2.5 border-t border-[#282C34] pt-4">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 border border-[#6E9E7C]/30 px-1.5 py-0.5 text-[10px] tracking-[0.1em] text-[#6E9E7C]">
                  <span className="h-1.5 w-1.5 bg-[#6E9E7C]" />{" "}
                  {governedWalletAddress ? "SYNCED" : "INVALID"}
                </span>
                <span className="text-[14px] tracking-[0.04em] text-[#EDF0F3]">{agentLabel}</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!governedWalletAddress) {
                    return;
                  }

                  try {
                    await navigator.clipboard.writeText(governedWalletAddress);
                    toast.success("GOVERNED WALLET COPIED", {
                      description: displayWalletLabel,
                    });
                  } catch {
                    toast.error("WALLET ADDRESS COPY FAILED");
                  }
                }}
                className="flex w-full min-w-0 items-center gap-2 text-[11px] text-[#8A909B] hover:text-[#D7DBE0]"
                disabled={!governedWalletAddress}
              >
                <span className="min-w-0 flex-1 truncate" title={governedWalletAddress ?? ""}>
                  {governedWalletAddress ?? "Invalid governed wallet address"}
                </span>
                <Copy className="h-3 w-3 shrink-0" strokeWidth={iconStroke} />
              </button>
              <div className="flex items-center gap-4 text-[10px] tracking-[0.08em] text-[#5B626C]">
                <span>
                  OWNER <span className="text-[#8A909B]">{ownerLabel}</span>
                </span>
                <span>
                  DOCTRINE{" "}
                  <span className="text-[#8A909B]">
                    {walletPolicy ? `v${walletPolicy.version}` : "not configured"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    "RESTRAINT / use the Agents table action while backend addresses are local",
                  )
                }
                className="flex h-8 items-center gap-1.5 border border-[#3A4250] px-3 text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
              >
                <Snowflake className="h-3.5 w-3.5" strokeWidth={iconStroke} /> RESTRAIN
              </button>
              <Link
                href={governedWalletAddress ? `/agents/${governedWalletAddress}/policy` : "/agents"}
                className="flex h-8 items-center gap-1.5 border border-[#3A4250] px-3 text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#D7DBE0]"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={iconStroke} /> EDIT DOCTRINE
              </Link>
              {governedWalletAddress ? (
                <>
                  <Link
                    href={`/explorer/${governedWalletAddress}`}
                    className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#D7DBE0] hover:text-[#D7DBE0]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} /> EXPLORER
                  </Link>
                  <Link
                    href={`/badge/${governedWalletAddress}`}
                    className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#D7DBE0] hover:text-[#D7DBE0]"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={iconStroke} /> BADGE
                  </Link>
                </>
              ) : null}
            </div>
            <div className="grid flex-1 grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
              <div className="p-5">
                <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">DAILY SPEND</div>
                <div className="mt-2 font-cond text-[30px] font-semibold leading-none text-[#EDF0F3]">
                  {amountLabel(detailMetrics.dailySpend)}
                  <span className="text-[#8A909B]"> / {dailyCapLabel}</span>
                </div>
                <ProgressLine width={dailySpendWidth} className="mt-3 h-1.5 w-full" />
                <div className="mt-2 text-[10px] tracking-[0.08em] text-[#5B626C]">
                  {detailMetrics.dailyCap > 0
                    ? `${dailySpendWidth}% OF DAILY CAP`
                    : "NO DAILY CAP IN READ MODEL"}
                </div>
              </div>
              <SmallStat
                label="30D SPEND"
                value={amountLabel(detailMetrics.monthlySpend)}
                caption="ROLLING WINDOW"
                trend={walletTransfers.length > 0 ? "LIVE INDEXED" : "NO ACTIVITY"}
              />
              <SmallStat
                label="EVENTS GOVERNED"
                value={String(detailMetrics.eventsCount)}
                caption="SELECTED WALLET"
                trend={walletTransfers.length > 0 ? "SCOPED LEDGER" : "NO INDEXED EVENTS"}
                green={walletTransfers.length > 0}
              />
              <SmallStat
                label="DEVIATION"
                value={
                  walletTransfers.length > 0 ? formatDeviation(detailMetrics.deviation) : "NONE"
                }
                caption={
                  walletPolicy
                    ? `THRESHOLD ${amountLabel(detailMetrics.escalationThreshold)}`
                    : "NO ACTIVITY BASELINE"
                }
                trend={walletTransfers.length > 0 ? "NOMINAL" : "NOT ENOUGH ACTIVITY"}
                green={walletTransfers.length > 0}
                valueClassName={walletTransfers.length > 0 ? "text-[#6E9E7C]" : "text-[#8A909B]"}
              />
            </div>
          </div>
        </section>

        <SectionTabs
          items={[
            "OVERVIEW",
            "EVENT STREAM",
            "DOCTRINE",
            "COUNTERPARTIES",
            "ANOMALIES",
            "SETTINGS",
          ]}
        />

        <section className="grid grid-cols-1 gap-4 2xl:grid-cols-[1fr_minmax(0,432px)]">
          <div className="space-y-4">
            <div className="border border-[#282C34] bg-[#181B21]">
              <PanelHeader title="SPEND BY CATEGORY" meta="DAILY ENVELOPE" />
              {detailMetrics.categorySpend.length > 0 ? (
                <div className="space-y-3.5 p-4">
                  {detailMetrics.categorySpend.map((row) => (
                    <CategoryBudget
                      key={row.category}
                      label={row.category}
                      category={row.category}
                      amount={amountLabel(row.amount)}
                      width={row.width}
                    />
                  ))}
                  <div className="flex items-center justify-between border-t border-[#282C34] pt-3 text-[11px] tracking-[0.08em]">
                    <span className="text-[#5B626C]">TOTAL / SELECTED WALLET</span>
                    <span className="text-[#D7DBE0]">{amountLabel(detailMetrics.totalSpend)}</span>
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="No spend yet"
                  description="Category usage will appear once agent payments are processed for this governed wallet."
                />
              )}
            </div>

            <div className="border border-[#282C34] bg-[#181B21]">
              <PanelHeader
                title={`EVENT STREAM - ${agentLabel.toUpperCase()}`}
                meta={
                  walletTransfers.length > 0
                    ? `LIVE / ${walletTransfers.length} INDEXED`
                    : "NO INDEXED ACTIVITY"
                }
              />
              {detailMetrics.eventRows.length > 0 ? (
                <>
                  <div className="grid grid-cols-[84px_56px_minmax(96px,1fr)_minmax(110px,1fr)_92px_104px] items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.14em] text-[#5B626C]">
                    <span>TIME</span>
                    <span>CAT</span>
                    <span>ACTION</span>
                    <span>COUNTERPARTY</span>
                    <span className="text-right">AMOUNT</span>
                    <span className="text-right">STATUS</span>
                  </div>
                  <div className="text-[12px]">
                    {detailMetrics.eventRows.map((event) => (
                      <EventRow key={`${event[0]}-${event[3]}-${event[4]}`} row={event} compact />
                    ))}
                  </div>
                  <div className="flex h-9 items-center justify-between border-t border-[#282C34] px-4 text-[10px] tracking-[0.14em] text-[#5B626C]">
                    <span>
                      SHOWING {detailMetrics.eventRows.length} / {walletTransfers.length}
                    </span>
                    <Link
                      href="/ledger"
                      className="flex items-center gap-1 text-[#8A909B] hover:text-[#D7DBE0]"
                    >
                      OPEN FULL STREAM <ArrowUpRight className="h-3 w-3" strokeWidth={iconStroke} />
                    </Link>
                  </div>
                </>
              ) : (
                <EmptyState title="No activity yet" description={indexerEmptyCopy} />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="border border-[#282C34] bg-[#181B21]">
              <PanelHeader title="TOP COUNTERPARTIES" meta="30D" />
              {detailMetrics.counterparties.length > 0 ? (
                <div className="divide-y divide-[#1E222A]">
                  {detailMetrics.counterparties.map((counterparty) => (
                    <div key={counterparty.name} className="px-4 py-3">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-[#D7DBE0]">{counterparty.name}</span>
                        <span className="text-[#8A909B]">
                          {amountLabel(counterparty.amount)}{" "}
                          <span className="text-[#5B626C]">/ {counterparty.count} tx</span>
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 bg-[#20242B]">
                        <div
                          className="h-full bg-[#3A4250]"
                          style={{ width: `${counterparty.width}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No counterparties yet"
                  description="Approved vendors and paid destinations will appear after agent activity begins."
                />
              )}
            </div>

            <div className="border border-[#282C34] bg-[#181B21]">
              <PanelHeader
                title="DOCTRINE SNAPSHOT"
                meta={walletPolicy ? `v${walletPolicy.version}` : "READ MODEL"}
              />
              <div className="divide-y divide-[#1E222A] text-[12px]">
                {[
                  ["PER-TX CAP", detailMetrics.perTxCapLabel],
                  ["DAILY CAP", detailMetrics.dailyCapLabel],
                  ["MONTHLY CAP", detailMetrics.monthlyCapLabel],
                  [
                    "VENDOR ALLOWLIST",
                    walletPolicy?.requireAllowlist ? "required" : "not required",
                  ],
                  ["ESCALATE ABOVE", detailMetrics.escalationThresholdLabel],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between px-4 py-3">
                    <span className="text-[10px] tracking-[0.14em] text-[#5B626C]">{label}</span>
                    <span className="text-[#D7DBE0]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <AgentSignerPanel governedWalletAddress={governedWalletAddress} />

            {governedWalletAddress ? <BadgeEmbedSnippet wallet={governedWalletAddress} /> : null}
          </div>
        </section>
      </Main>
    </GovernanceFrame>
  );
}

type WalletDetailTransfer = {
  id: string;
  txHash: string;
  blockNumber: number;
  timestamp: Date | string;
  toAddress: string;
  amount: string | number;
  verdict: string;
  reason: string;
  vendorCategory: string;
};

type WalletDetailPolicy = {
  version: number;
  perTxCap: string | number;
  daily24hCap: string | number;
  monthlyRollingCap: string | number;
  escalationThreshold: string | number;
  requireAllowlist: boolean;
};

function walletDetailMetrics(
  transfers: WalletDetailTransfer[],
  policy: WalletDetailPolicy | null,
  vendorNames: Map<string, string>,
) {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const dailyCap = policy ? usdcNumber(policy.daily24hCap) : 0;
  const perTxCap = policy ? usdcNumber(policy.perTxCap) : 0;
  const monthlyCap = policy ? usdcNumber(policy.monthlyRollingCap) : 0;
  const escalationThreshold = policy ? usdcNumber(policy.escalationThreshold) : 0;
  const totalSpend = transfers.reduce((sum, transfer) => sum + usdcNumber(transfer.amount), 0);
  const dailySpend = transfers.reduce((sum, transfer) => {
    const timestamp = transferTimestampMs(transfer);
    return timestamp !== null && timestamp >= dayAgo ? sum + usdcNumber(transfer.amount) : sum;
  }, 0);
  const monthlySpend = transfers.reduce((sum, transfer) => {
    const timestamp = transferTimestampMs(transfer);
    return timestamp !== null && timestamp >= monthAgo ? sum + usdcNumber(transfer.amount) : sum;
  }, 0);
  const categoryTotals = new Map<string, number>();
  const counterpartyTotals = new Map<string, { amount: number; count: number; name: string }>();

  for (const transfer of transfers) {
    const amount = usdcNumber(transfer.amount);
    const category = categoryLabel(transfer.vendorCategory || "other");
    categoryTotals.set(category, (categoryTotals.get(category) ?? 0) + amount);

    const address = transfer.toAddress?.toLowerCase();
    const name = address ? (vendorNames.get(address) ?? shortAddress(address)) : "Counterparty";
    const current = counterpartyTotals.get(name) ?? { amount: 0, count: 0, name };
    counterpartyTotals.set(name, {
      ...current,
      amount: current.amount + amount,
      count: current.count + 1,
    });
  }

  const maxCategory = Math.max(1, ...categoryTotals.values());
  const maxCounterparty = Math.max(
    1,
    ...Array.from(counterpartyTotals.values()).map((row) => row.amount),
  );

  return {
    categorySpend: Array.from(categoryTotals.entries())
      .map(([category, amount]) => ({
        amount,
        category,
        width: Math.min(100, Math.round((amount / maxCategory) * 100)),
      }))
      .sort((left, right) => right.amount - left.amount),
    counterPartiesCount: counterpartyTotals.size,
    counterparties: Array.from(counterpartyTotals.values())
      .map((row) => ({
        ...row,
        width: Math.min(100, Math.round((row.amount / maxCounterparty) * 100)),
      }))
      .sort((left, right) => right.amount - left.amount),
    dailyCap,
    dailyCapLabel: dailyCap > 0 ? amountLabel(dailyCap) : "Not configured",
    dailySpend,
    deviation: transfers.length > 0 ? 0 : 0,
    escalationThreshold,
    escalationThresholdLabel:
      escalationThreshold > 0 ? amountLabel(escalationThreshold) : "Not configured",
    eventsCount: transfers.length,
    eventRows: transfers
      .slice(0, 7)
      .map((transfer) => walletTransferEventRow(transfer, vendorNames)),
    monthlyCap,
    monthlyCapLabel: monthlyCap > 0 ? amountLabel(monthlyCap) : "Not configured",
    monthlySpend,
    perTxCap,
    perTxCapLabel: perTxCap > 0 ? amountLabel(perTxCap) : "Not configured",
    totalSpend,
  };
}

function transferTimestampMs(transfer: WalletDetailTransfer) {
  const value =
    transfer.timestamp instanceof Date
      ? transfer.timestamp.getTime()
      : Date.parse(transfer.timestamp);
  return Number.isFinite(value) ? value : null;
}

function walletTransferEventRow(
  transfer: WalletDetailTransfer,
  vendorNames: Map<string, string>,
): readonly string[] {
  const address = transfer.toAddress?.toLowerCase();
  const counterparty = address
    ? (vendorNames.get(address) ?? shortAddress(address))
    : "Counterparty";
  return [
    transferTimeLabel(transfer),
    categoryLabel(transfer.vendorCategory || "other"),
    transfer.reason || transfer.verdict,
    counterparty,
    amountLabel(usdcNumber(transfer.amount)),
    transferVerdictLabel(transfer.verdict),
  ];
}

function transferTimeLabel(transfer: WalletDetailTransfer) {
  const timestamp = transferTimestampMs(transfer);
  if (timestamp === null) {
    return "N/A";
  }

  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function transferVerdictLabel(verdict: string) {
  const normalized = verdict.toUpperCase();
  if (normalized === "DENY") {
    return "REJECTED";
  }
  if (normalized === "ESCALATE") {
    return "ESCALATED";
  }
  if (normalized === "FREEZE") {
    return "FROZEN";
  }
  return "APPROVED";
}

type SignerReadStatus = "idle" | "checking" | "ready" | "error";
type SignerSyncRequest = { action: "authorize" | "revoke"; signerAddress: Address };
type SignerTxStatus =
  | "idle"
  | "wallet"
  | "confirming"
  | "syncing"
  | "synced"
  | "sync_failed"
  | "error";

function AgentSignerPanel({
  governedWalletAddress,
}: Readonly<{ governedWalletAddress: Address | null }>) {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const signerPolicyQuery = trpc.agents.policy.useQuery(
    { walletId: governedWalletAddress ?? zeroEvmAddress },
    {
      enabled: workspace.isAuthenticated && Boolean(governedWalletAddress),
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
      retry: false,
      staleTime: 30_000,
    },
  );
  const syncSignerState = trpc.agents.syncSignerState.useMutation();
  const submittingRef = useRef(false);
  const [signerInput, setSignerInput] = useState("");
  const [signerInputTouched, setSignerInputTouched] = useState(false);
  const [walletOwner, setWalletOwner] = useState<Address | null>(null);
  const [signerAuthorized, setSignerAuthorized] = useState<boolean | null>(null);
  const [signerVerificationByAddress, setSignerVerificationByAddress] = useState<
    Record<string, boolean | null>
  >({});
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [readStatus, setReadStatus] = useState<SignerReadStatus>("idle");
  const [readError, setReadError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<SignerTxStatus>("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [lastSyncRequest, setLastSyncRequest] = useState<SignerSyncRequest | null>(null);
  const persistedSignerCandidates = useMemo(
    () => signerCandidatesFromPolicy(signerPolicyQuery.data),
    [signerPolicyQuery.data],
  );
  const persistedSignerAddress = persistedSignerCandidates[0] ?? null;

  const trimmedSigner = signerInput.trim();
  const signerAddress = isEvmAddress(trimmedSigner) ? (trimmedSigner as Address) : null;
  const usableSignerAddress = signerAddress && !isZeroAddress(signerAddress) ? signerAddress : null;
  const signerValidation =
    trimmedSigner.length === 0
      ? "Enter an agent signer public address."
      : !signerAddress
        ? "Enter a valid EVM address."
        : isZeroAddress(signerAddress)
          ? "Zero address cannot be an agent signer."
          : null;
  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    syncSignerState.isPending ||
    txStatus === "wallet" ||
    txStatus === "confirming" ||
    txStatus === "syncing";
  const ownerMatchesConnectedWallet = Boolean(
    walletOwner && address && isSameAddress(walletOwner, address),
  );
  const visibleSignerCandidates = useMemo(() => {
    const nextCandidates = [...persistedSignerCandidates];
    if (
      usableSignerAddress &&
      signerAuthorized === true &&
      !nextCandidates.some((candidate) => isSameAddress(candidate, usableSignerAddress))
    ) {
      nextCandidates.push(usableSignerAddress);
    }

    return nextCandidates;
  }, [persistedSignerCandidates, signerAuthorized, usableSignerAddress]);
  const signerRows = useMemo(
    () =>
      visibleSignerCandidates.map((candidate) => {
        const verified = signerVerificationByAddress[candidate.toLowerCase()] ?? null;
        const isSyncTarget = Boolean(
          lastSyncRequest && isSameAddress(candidate, lastSyncRequest.signerAddress),
        );
        const isPendingSync =
          isSyncTarget && (txStatus === "syncing" || txStatus === "sync_failed");
        const status = isPendingSync
          ? txStatus === "sync_failed"
            ? "SYNC FAILED"
            : "SYNC PENDING"
          : readStatus === "checking" && verified === null
            ? "VERIFYING"
            : verified === true
              ? "AUTHORIZED ON CONTRACT"
              : verified === false
                ? "NOT AUTHORIZED ON CONTRACT"
                : readStatus === "error"
                  ? "READBACK FAILED"
                  : "SUPABASE CANDIDATE";
        const source = isPendingSync
          ? "recent tx"
          : verified === true
            ? "contract verified"
            : "Supabase candidate";

        return { address: candidate, source, status, verified };
      }),
    [readStatus, lastSyncRequest, signerVerificationByAddress, txStatus, visibleSignerCandidates],
  );
  const authorizedSignerCount = signerRows.filter((row) => row.verified === true).length;
  const lastVerifiedLabel = lastVerifiedAt
    ? new Date(lastVerifiedAt).toLocaleTimeString([], { hour12: false })
    : null;

  const readLiveSignerStates = useCallback(
    async (nextSigners: Address[]) => {
      if (!publicClient || !governedWalletAddress) {
        return null;
      }

      const owner = (await publicClient.readContract({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      })) as Address;

      const authorizationEntries = await Promise.all(
        nextSigners.map(async (signer) => {
          const authorized = (await publicClient.readContract({
            address: governedWalletAddress,
            abi: guardedWalletControlAbi,
            functionName: "agentSigners",
            args: [signer],
          })) as boolean;

          return [signer.toLowerCase(), authorized] as const;
        }),
      );

      return { authorizationByAddress: Object.fromEntries(authorizationEntries), owner };
    },
    [governedWalletAddress, publicClient],
  );
  const readLiveSignerState = useCallback(
    async (nextSigner: Address | null) => {
      const result = await readLiveSignerStates(nextSigner ? [nextSigner] : []);
      if (!result) {
        return null;
      }

      return {
        authorized: nextSigner
          ? (result.authorizationByAddress[nextSigner.toLowerCase()] ?? null)
          : null,
        owner: result.owner,
      };
    },
    [readLiveSignerStates],
  );

  useEffect(() => {
    setSignerInput("");
    setSignerInputTouched(false);
    setSignerAuthorized(null);
    setSignerVerificationByAddress({});
    setLastVerifiedAt(null);
    setReadError(null);
    setReadStatus(governedWalletAddress ? "checking" : "idle");
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
    setLastSyncRequest(null);
  }, [governedWalletAddress]);

  useEffect(() => {
    if (!persistedSignerAddress || signerInputTouched || signerPolicyQuery.isFetching) {
      return;
    }

    setSignerInput(persistedSignerAddress);
  }, [persistedSignerAddress, signerInputTouched, signerPolicyQuery.isFetching]);
  const verificationSignerCandidates = useMemo(() => {
    const candidates = usableSignerAddress
      ? [...persistedSignerCandidates, usableSignerAddress]
      : persistedSignerCandidates;

    return Array.from(
      new Set(
        candidates
          .map((candidate) => candidate.toLowerCase())
          .filter(
            (candidate): candidate is Address =>
              isEvmAddress(candidate) && !isZeroAddress(candidate),
          ),
      ),
    );
  }, [persistedSignerCandidates, usableSignerAddress]);

  useEffect(() => {
    let cancelled = false;
    setTxError(null);

    if (!governedWalletAddress || !publicClient) {
      setWalletOwner(null);
      setSignerAuthorized(null);
      setSignerVerificationByAddress({});
      setLastVerifiedAt(null);
      setReadStatus(governedWalletAddress ? "error" : "idle");
      setReadError(governedWalletAddress ? "Arc Testnet RPC is unavailable." : null);
      return () => {
        cancelled = true;
      };
    }

    setReadStatus("checking");
    setReadError(null);
    readLiveSignerStates(verificationSignerCandidates)
      .then((result) => {
        if (cancelled || !result) {
          return;
        }

        setWalletOwner(result.owner);
        setSignerVerificationByAddress(result.authorizationByAddress);
        setSignerAuthorized(
          usableSignerAddress
            ? (result.authorizationByAddress[usableSignerAddress.toLowerCase()] ?? null)
            : null,
        );
        setLastVerifiedAt(new Date().toISOString());
        setReadStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        setWalletOwner(null);
        setSignerAuthorized(null);
        setSignerVerificationByAddress({});
        setLastVerifiedAt(null);
        setReadStatus("error");
        setReadError(errorMessage(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [
    governedWalletAddress,
    publicClient,
    readLiveSignerStates,
    usableSignerAddress,
    verificationSignerCandidates,
  ]);

  const managementDisabledReason = !governedWalletAddress
    ? "Open a valid governed wallet route."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage the agent signer."
        : readStatus === "checking"
          ? "Checking governed wallet owner."
          : readStatus === "error"
            ? "Unable to read signer permissions from Arc Testnet."
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can manage the agent signer."
              : chainId !== arcTestnet.id
                ? "Switch to Arc Testnet."
                : null;
  const signerWriteDisabledReason = managementDisabledReason ?? signerValidation;
  const signerCheckPending = Boolean(
    usableSignerAddress && signerAuthorized === null && readStatus === "checking",
  );
  const canAuthorize =
    !signerWriteDisabledReason && !signerCheckPending && signerAuthorized === false && !isBusy;
  const canRevoke =
    !signerWriteDisabledReason && !signerCheckPending && signerAuthorized === true && !isBusy;
  const statusCopy = signerPolicyQuery.isLoading
    ? "READING SIGNERS"
    : readStatus === "checking" && visibleSignerCandidates.length > 0
      ? "VERIFYING SIGNERS"
      : authorizedSignerCount > 0
        ? `${authorizedSignerCount} SIGNER${authorizedSignerCount === 1 ? "" : "S"} AUTHORIZED`
        : visibleSignerCandidates.length > 0
          ? "SAVED SIGNER STALE"
          : !usableSignerAddress || signerValidation
            ? "NO SIGNER AUTHORIZED"
            : readStatus === "checking"
              ? "CHECKING CONTRACT"
              : signerAuthorized
                ? "AUTHORIZED"
                : readStatus === "error"
                  ? "READBACK FAILED"
                  : "NOT AUTHORIZED";
  const statusClassName =
    authorizedSignerCount > 0 || (signerAuthorized && usableSignerAddress)
      ? "border-[#6E9E7C]/40 text-[#6E9E7C]"
      : readStatus === "error" || txStatus === "sync_failed"
        ? "border-[#EC7A6B]/40 text-[#EC7A6B]"
        : "border-[#3A4250] text-[#8A909B]";
  const txArcscanUrl = getArcscanTxUrl(txHash);

  const copyAddress = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} COPIED`, { description: shortAddress(value) });
    } catch {
      toast.error(`${label} COPY FAILED`);
    }
  };

  const switchToArcTestnet = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("agentSigner.switchChain", event)) {
      return;
    }

    try {
      setTxError(null);
      await switchChainAsync({ chainId: arcTestnet.id });
    } catch (caught) {
      setTxError(errorMessage(caught));
    }
  };

  const submitSignerWrite = async (
    action: "authorize" | "revoke",
    event: ReactMouseEvent<HTMLButtonElement>,
    signerOverride?: Address,
  ) => {
    if (!allowTrustedMutation(`agentSigner.${action}`, event)) {
      return;
    }

    const targetSigner = signerOverride ?? usableSignerAddress;
    if (
      submittingRef.current ||
      !governedWalletAddress ||
      !targetSigner ||
      !publicClient ||
      !ownerMatchesConnectedWallet
    ) {
      return;
    }

    submittingRef.current = true;
    setTxError(null);
    setTxHash(null);
    setTxStatus("wallet");
    let contractConfirmed = false;

    try {
      if (chainId !== arcTestnet.id) {
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      const hash = await writeContractAsync({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: action === "authorize" ? "addSigner" : "removeSigner",
        args: [targetSigner],
        chainId: arcTestnet.id,
      });
      setTxHash(hash);
      setTxStatus("confirming");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new Error("Signer transaction reverted.");
      }

      contractConfirmed = true;
      const nextState = action === "authorize";
      const refreshed = await readLiveSignerState(targetSigner);
      setWalletOwner(refreshed?.owner ?? walletOwner);
      if (refreshed?.authorized !== nextState) {
        throw new Error("Contract readback did not confirm the signer state.");
      }

      setSignerAuthorized(nextState);
      setSignerVerificationByAddress((previous) => ({
        ...previous,
        [targetSigner.toLowerCase()]: nextState,
      }));
      setLastVerifiedAt(new Date().toISOString());
      setReadStatus("ready");
      setTxStatus("syncing");
      setLastSyncRequest({ action, signerAddress: targetSigner });
      await syncSignerState.mutateAsync({
        action,
        signerAddress: targetSigner,
        walletAddress: governedWalletAddress,
      });
      await Promise.all([
        utils.agents.list.invalidate(),
        utils.agents.policy.invalidate({ walletId: governedWalletAddress }),
      ]);
      if (action === "revoke") {
        if (usableSignerAddress && isSameAddress(targetSigner, usableSignerAddress)) {
          setSignerInput("");
          setSignerInputTouched(false);
        }
      }

      setTxStatus("synced");
      setLastSyncRequest(null);
      toast.success(action === "authorize" ? "AGENT SIGNER AUTHORIZED" : "AGENT SIGNER REVOKED", {
        description: "Contract confirmed and Supabase signer state synced.",
      });
    } catch (caught) {
      setTxStatus(contractConfirmed ? "sync_failed" : "error");
      setTxError(errorMessage(caught));
    } finally {
      submittingRef.current = false;
    }
  };
  const retrySignerSync = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (
      !allowTrustedMutation("agentSigner.retrySync", event) ||
      !governedWalletAddress ||
      !lastSyncRequest ||
      syncSignerState.isPending
    ) {
      return;
    }

    try {
      setTxError(null);
      setTxStatus("syncing");
      await syncSignerState.mutateAsync({
        action: lastSyncRequest.action,
        signerAddress: lastSyncRequest.signerAddress,
        walletAddress: governedWalletAddress,
      });
      await Promise.all([
        utils.agents.list.invalidate(),
        utils.agents.policy.invalidate({ walletId: governedWalletAddress }),
      ]);
      if (lastSyncRequest.action === "revoke") {
        setSignerInput("");
        setSignerInputTouched(false);
      }
      setTxStatus("synced");
      setLastSyncRequest(null);
      toast.success("SIGNER STATE SYNCED", {
        description: "Supabase signer state now matches the confirmed contract transaction.",
      });
    } catch (caught) {
      setTxStatus("sync_failed");
      setTxError(errorMessage(caught));
    }
  };

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader
        title="AGENT SIGNER"
        meta={workspace.isDemo ? "DEMO WORKSPACE" : "OWNER CONTROLLED"}
      />
      <div className="space-y-4 p-4 text-[12px] leading-relaxed text-[#8A909B]">
        <p>
          Agent signer is the public wallet address controlled by your agent backend. Never paste a
          private key here. The signer can request payments, but policy rules still control what it
          can spend.
        </p>

        <div className="grid gap-2 border border-[#282C34] bg-[#15181D] p-3 text-[11px]">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">GOVERNED WALLET</span>
            {governedWalletAddress ? (
              <button
                type="button"
                className="flex min-w-0 items-center gap-1 text-[#D7DBE0] hover:text-[#FF5A1F]"
                onClick={() => void copyAddress(governedWalletAddress, "GOVERNED WALLET")}
              >
                <span className="truncate">{shortAddress(governedWalletAddress)}</span>
                <Copy className="h-3 w-3 shrink-0" strokeWidth={iconStroke} />
              </button>
            ) : (
              <span className="text-[#EC7A6B]">INVALID ROUTE</span>
            )}
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">OWNER</span>
            <span className="min-w-0 truncate text-[#D7DBE0]">
              {walletOwner
                ? shortAddress(walletOwner)
                : readStatus === "checking"
                  ? "Checking"
                  : "N/A"}
            </span>
          </div>
          <div className="flex min-w-0 items-center justify-between gap-3">
            <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">STATUS</span>
            <span
              className={cn("border px-2 py-0.5 text-[10px] tracking-[0.12em]", statusClassName)}
            >
              {statusCopy}
            </span>
          </div>
        </div>

        <div className="border border-[#282C34] bg-[#101216]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#282C34] px-3 py-2">
            <div>
              <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">AUTHORIZED SIGNERS</div>
              <div className="mt-1 text-[11px] text-[#8A909B]">
                {authorizedSignerCount > 0
                  ? `${authorizedSignerCount} signer${authorizedSignerCount === 1 ? "" : "s"} verified for this governed wallet`
                  : "No contract-verified signer yet"}
              </div>
            </div>
            {lastVerifiedLabel ? (
              <span className="border border-[#282C34] px-2 py-1 text-[10px] tracking-[0.12em] text-[#5B626C]">
                VERIFIED {lastVerifiedLabel}
              </span>
            ) : null}
          </div>
          {signerRows.length > 0 ? (
            <div className="divide-y divide-[#1E222A]">
              {signerRows.map((row) => {
                const rowAuthorized = row.verified === true;
                const rowStale = row.verified === false || row.status === "SYNC FAILED";
                const revokeDisabled =
                  !rowAuthorized || Boolean(managementDisabledReason) || isBusy;

                return (
                  <div
                    key={row.address}
                    className="grid gap-2 px-3 py-3 text-[11px] sm:grid-cols-[minmax(0,1fr)_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="font-mono text-[#D7DBE0]" title={row.address}>
                          {shortAddress(row.address, { head: 8, tail: 6 })}
                        </span>
                        <span
                          className={cn(
                            "border px-1.5 py-0.5 text-[9px] tracking-[0.12em]",
                            rowAuthorized
                              ? "border-[#6E9E7C]/35 text-[#6E9E7C]"
                              : rowStale
                                ? "border-[#EC7A6B]/35 text-[#EC7A6B]"
                                : "border-[#E0A04A]/35 text-[#E0A04A]",
                          )}
                        >
                          {row.status}
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] tracking-[0.1em] text-[#5B626C]">
                        <span>SOURCE {row.source.toUpperCase()}</span>
                        <span>
                          WALLET{" "}
                          {governedWalletAddress ? shortAddress(governedWalletAddress) : "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        onClick={() => void copyAddress(row.address, "AGENT SIGNER")}
                        className="flex h-7 items-center gap-1.5 border border-[#282C34] px-2 text-[9px] tracking-[0.12em] text-[#8A909B] hover:border-[#D7DBE0] hover:text-[#D7DBE0]"
                      >
                        <Copy className="h-3 w-3" strokeWidth={iconStroke} /> COPY
                      </button>
                      <button
                        type="button"
                        onClick={(event) => void submitSignerWrite("revoke", event, row.address)}
                        disabled={revokeDisabled}
                        title={
                          revokeDisabled
                            ? (managementDisabledReason ?? "Only verified signers can be revoked.")
                            : "Revoke signer"
                        }
                        className="flex h-7 items-center gap-1.5 border border-[#EC7A6B]/45 px-2 text-[9px] tracking-[0.12em] text-[#EC7A6B] hover:bg-[#211514] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <UserMinus className="h-3 w-3" strokeWidth={iconStroke} /> REVOKE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-4 text-[11px] text-[#8A909B]">
              No signer authorized for this governed wallet. Add the public address controlled by
              your agent backend below.
            </div>
          )}
        </div>

        <label className="block space-y-2">
          <span className="text-[10px] tracking-[0.18em] text-[#5B626C]">
            AGENT SIGNER PUBLIC ADDRESS
          </span>
          <input
            value={signerInput}
            onChange={(event) => {
              setSignerInput(event.target.value);
              setSignerInputTouched(true);
              setTxStatus("idle");
              setTxHash(null);
              setTxError(null);
            }}
            disabled={isBusy}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x public signer address"
            className="h-10 w-full border border-[#282C34] bg-[#101216] px-3 font-mono text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#4E5663] focus:border-[#FF5A1F]"
          />
        </label>

        {signerValidation && trimmedSigner.length > 0 ? (
          <div className="flex items-start gap-2 border border-[#E0A04A]/30 bg-[#1d170d] p-3 text-[11px] text-[#E0A04A]">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={iconStroke} />
            {signerValidation}
          </div>
        ) : null}

        {txStatus === "synced" && txHash ? (
          <div className="border border-[#6E9E7C]/30 bg-[#111b15] p-3 text-[11px] text-[#6E9E7C]">
            Contract confirmed. Supabase signer state is synced for this governed wallet.
          </div>
        ) : null}

        {txStatus === "syncing" && txHash ? (
          <div className="border border-[#E0A04A]/30 bg-[#1d170d] p-3 text-[11px] text-[#E0A04A]">
            Signer transaction confirmed. Syncing signer state to Supabase.
          </div>
        ) : null}

        {readError ? (
          <div className="border border-[#EC7A6B]/30 bg-[#211514] p-3 text-[11px] text-[#EC7A6B]">
            {readError}
          </div>
        ) : null}

        {txError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border border-[#EC7A6B]/30 bg-[#211514] p-3 text-[11px] text-[#EC7A6B]">
            <span>{txError}</span>
            {txStatus === "sync_failed" && lastSyncRequest ? (
              <button
                type="button"
                onClick={retrySignerSync}
                disabled={syncSignerState.isPending}
                className="h-7 border border-[#EC7A6B]/45 px-2 text-[9px] tracking-[0.12em] hover:bg-[#2a1715] disabled:cursor-not-allowed disabled:opacity-45"
              >
                RETRY SIGNER SYNC
              </button>
            ) : null}
          </div>
        ) : null}

        {txHash ? (
          <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em] text-[#5B626C]">
            <span>TX {shortAddress(txHash, { head: 10, tail: 6 })}</span>
            {txArcscanUrl ? (
              <a
                href={txArcscanUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[#8A909B] hover:text-[#D7DBE0]"
              >
                OPEN IN ARCSCAN <ExternalLink className="h-3 w-3" strokeWidth={iconStroke} />
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {isConnected && chainId !== arcTestnet.id ? (
            <button
              type="button"
              onClick={switchToArcTestnet}
              disabled={switchPending}
              className="flex h-8 items-center gap-1.5 border border-[#FF5A1F]/50 px-3 text-[10px] tracking-[0.12em] text-[#FF5A1F] hover:bg-[#1c1107] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {switchPending ? "SWITCHING" : "SWITCH TO ARC TESTNET"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={(event) => void submitSignerWrite("authorize", event)}
            disabled={!canAuthorize}
            className="flex h-8 items-center gap-1.5 border border-[#6E9E7C]/50 px-3 text-[10px] tracking-[0.12em] text-[#6E9E7C] hover:bg-[#101c14] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            {txStatus === "wallet" ? "CONFIRM IN WALLET" : "AUTHORIZE SIGNER"}
          </button>
          <button
            type="button"
            onClick={(event) => void submitSignerWrite("revoke", event)}
            disabled={!canRevoke}
            className="flex h-8 items-center gap-1.5 border border-[#EC7A6B]/50 px-3 text-[10px] tracking-[0.12em] text-[#EC7A6B] hover:bg-[#211514] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <UserMinus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            {txStatus === "wallet" ? "CONFIRM IN WALLET" : "REVOKE SIGNER"}
          </button>
          {usableSignerAddress ? (
            <button
              type="button"
              onClick={() => void copyAddress(usableSignerAddress, "AGENT SIGNER")}
              className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#D7DBE0] hover:text-[#D7DBE0]"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} /> COPY SIGNER
            </button>
          ) : null}
        </div>

        <div className="text-[10px] leading-relaxed tracking-[0.1em] text-[#5B626C]">
          {signerWriteDisabledReason ??
            (signerAuthorized
              ? "ROTATE BY REVOKING THIS SIGNER, THEN AUTHORIZE THE NEW PUBLIC SIGNER ADDRESS."
              : "THIS SIGNER IS NOT AUTHORIZED FOR THIS GOVERNED WALLET YET.")}
        </div>
      </div>
    </div>
  );
}

function SmallStat({
  label,
  value,
  caption,
  trend,
  green,
  valueClassName,
}: Readonly<{
  label: string;
  value: string;
  caption: string;
  trend: string;
  green?: boolean;
  valueClassName?: string;
}>) {
  return (
    <div className="p-5">
      <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "mt-2 font-cond text-[30px] font-semibold leading-none text-[#EDF0F3]",
          valueClassName,
        )}
      >
        {value}
      </div>
      <div className={cn("mt-2 text-[11px]", green ? "text-[#6E9E7C]" : "text-[#8A909B]")}>
        {trend}
      </div>
      <div className="mt-1 text-[10px] tracking-[0.08em] text-[#5B626C]">{caption}</div>
    </div>
  );
}

function BadgeEmbedSnippet({ wallet }: Readonly<{ wallet: string }>) {
  const publicOrigin = configuredPublicOrigin();
  const badgeUrl = `/badge/${encodeURIComponent(wallet)}`;
  const snippet = `<iframe src="${publicOrigin}${badgeUrl}" width="600" height="60" frameborder="0" title="Arcanum governance badge"></iframe>`;

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet);
    toast.success("BADGE IFRAME COPIED");
  };

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader title="EMBED BADGE">
        <div className="flex items-center gap-2">
          <Link
            href={`/badge/${wallet}`}
            className="flex items-center gap-1.5 border border-[#282C34] px-2 py-1 text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={iconStroke} /> OPEN
          </Link>
          <button
            type="button"
            onClick={() => void copySnippet()}
            className="flex items-center gap-1.5 border border-[#282C34] px-2 py-1 text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <Copy className="h-3 w-3" strokeWidth={iconStroke} /> COPY
          </button>
        </div>
      </PanelHeader>
      <pre className="m-4 overflow-hidden border border-[#282C34] bg-[#101216] p-3 text-[10px] leading-relaxed text-[#6E9E7C]">
        {snippet}
      </pre>
    </div>
  );
}

export function PolicyEditorCanvasPage() {
  const workspace = useWorkspaceMode();
  const params = useParams();
  const routeWalletId =
    typeof params.walletId === "string"
      ? params.walletId
      : Array.isArray(params.walletId)
        ? (params.walletId[0] ?? "")
        : "";
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const [policyDraft, setPolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [activePolicyDraft, setActivePolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [selectedPolicyWalletAddress, setSelectedPolicyWalletAddress] = useState("");
  const [policyWalletOwner, setPolicyWalletOwner] = useState<Address | null>(null);
  const [policyReadStatus, setPolicyReadStatus] = useState<SignerReadStatus>("idle");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyTxHash, setPolicyTxHash] = useState<Hash | null>(null);
  const [policyPendingIndexer, setPolicyPendingIndexer] = useState(false);
  const [anomalyFreezeThresholdBps, setAnomalyFreezeThresholdBps] = useState<bigint | null>(null);
  const policySubmittingRef = useRef(false);
  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled: workspace.isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const policyWalletOptions = useMemo(
    () =>
      (walletsQuery.data ?? []).map((wallet) => ({
        address: wallet.address,
        id: wallet.id,
        label: wallet.label,
      })),
    [walletsQuery.data],
  );
  const selectedGovernedWalletAddress = isEvmAddress(selectedPolicyWalletAddress)
    ? (selectedPolicyWalletAddress as Address)
    : null;
  const ownerMatchesConnectedWallet = Boolean(
    policyWalletOwner && address && isSameAddress(policyWalletOwner, address),
  );
  const policyDiffs = useMemo(
    () => policyDiffRows(activePolicyDraft, policyDraft),
    [activePolicyDraft, policyDraft],
  );
  const unsavedCount = policyDiffs.length;
  const policyWritesBusy =
    policySaving || policySubmittingRef.current || switchPending || writePending;
  const selectedPolicyWalletLabel =
    policyWalletOptions.find((wallet) => isSameAddress(wallet.address, selectedPolicyWalletAddress))
      ?.label ?? "Governed wallet";

  useEffect(() => {
    if (
      selectedPolicyWalletAddress &&
      policyWalletOptions.some((wallet) =>
        isSameAddress(wallet.address, selectedPolicyWalletAddress),
      )
    ) {
      return;
    }

    const normalizedRouteWalletId = routeWalletId.toLowerCase();
    const routeMatch = policyWalletOptions.find(
      (wallet) =>
        wallet.id.toLowerCase() === normalizedRouteWalletId ||
        isSameAddress(wallet.address, routeWalletId) ||
        wallet.label.toLowerCase() === normalizedRouteWalletId,
    );
    setSelectedPolicyWalletAddress(routeMatch?.address ?? policyWalletOptions[0]?.address ?? "");
  }, [policyWalletOptions, routeWalletId, selectedPolicyWalletAddress]);

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || !selectedGovernedWalletAddress) {
      setPolicyWalletOwner(null);
      setPolicyReadStatus(selectedGovernedWalletAddress ? "error" : "idle");
      setAnomalyFreezeThresholdBps(null);
      return () => {
        cancelled = true;
      };
    }

    setPolicyReadStatus("checking");
    setPolicyError(null);
    Promise.all([
      publicClient.readContract({
        address: selectedGovernedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      }),
      publicClient.readContract({
        address: selectedGovernedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "policy",
      }),
      publicClient.readContract({
        address: selectedGovernedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "anomalyFreezeThresholdBps",
      }),
    ])
      .then(([owner, policy, freezeThreshold]) => {
        if (cancelled) {
          return;
        }

        const nextDraft = policyDraftFromEnvelope(policy as readonly unknown[]);
        setPolicyWalletOwner(owner as Address);
        setActivePolicyDraft(nextDraft);
        setPolicyDraft(nextDraft);
        setAnomalyFreezeThresholdBps(freezeThreshold as bigint);
        setPolicyPendingIndexer(false);
        setPolicyReadStatus("ready");
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }

        setPolicyWalletOwner(null);
        setAnomalyFreezeThresholdBps(null);
        setPolicyReadStatus("error");
        setPolicyError(errorMessage(caught));
      });

    return () => {
      cancelled = true;
    };
  }, [publicClient, selectedGovernedWalletAddress]);

  const policyWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsQuery.isLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage policy."
        : policyReadStatus === "checking"
          ? "Reading active policy from Arc Testnet."
          : policyReadStatus === "error"
            ? "Unable to read governed wallet policy on Arc Testnet."
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can update policy."
              : unsavedCount === 0
                ? "No policy changes to submit."
                : null;
  const policyNetworkNotice =
    isConnected && chainId !== arcTestnet.id
      ? "Wallet will be asked to switch to Arc Testnet."
      : null;

  const toggleCategory = (category: DoctrineCategoryValue) => {
    setPolicyDraft((current) => {
      const next = new Set(current.enabledCategories);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return { ...current, enabledCategories: next };
    });
    setPolicyError(null);
    setPolicyPendingIndexer(false);
  };

  const updatePolicyDraft = (patch: Partial<PolicyDraftState>) => {
    setPolicyDraft((current) => ({ ...current, ...patch }));
    setPolicyError(null);
    setPolicyPendingIndexer(false);
  };

  const ensurePolicyWriteReady = async () => {
    if (policyWriteDisabledReason) {
      throw new Error(policyWriteDisabledReason);
    }

    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error("Arc Testnet RPC is unavailable.");
    }

    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }

    return selectedGovernedWalletAddress;
  };

  const savePolicyOnChain = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("policies.update", event)) {
      return;
    }

    if (policySubmittingRef.current) {
      return;
    }

    policySubmittingRef.current = true;
    setPolicySaving(true);
    setPolicyError(null);
    setPolicyTxHash(null);
    try {
      const nextPolicy = buildPolicyEnvelope(policyDraft);
      const governedWallet = await ensurePolicyWriteReady();
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "setPolicy",
        args: [nextPolicy],
        chainId: arcTestnet.id,
      });
      setPolicyTxHash(hash);

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") {
        throw new Error("Policy transaction reverted.");
      }

      setActivePolicyDraft(policyDraft);
      setPolicyPendingIndexer(true);
      await utils.policies.get.invalidate();
      await utils.wallets.listPolicies.invalidate();
      toast.success("POLICY TX CONFIRMED", {
        description:
          "Policy update is confirmed on-chain. Event indexer may lag before read-model refresh.",
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setPolicyError(message);
      toast.error("POLICY UPDATE FAILED", { description: message });
    } finally {
      setPolicySaving(false);
      policySubmittingRef.current = false;
    }
  };

  return (
    <GovernanceFrame
      active="agents"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / AGENTS / ${
        selectedGovernedWalletAddress ? shortAddress(selectedGovernedWalletAddress) : "NO WALLET"
      } / DOCTRINE`}
      showRange={false}
    >
      <main className="px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <ScrollText className="h-4 w-4 text-[#8A909B]" strokeWidth={iconStroke} />
            <span className="min-w-0 truncate text-[13px] tracking-[0.06em] text-[#EDF0F3]">
              DOCTRINE /{" "}
              <span className="text-[#8A909B]">
                {selectedPolicyWalletLabel} /{" "}
                {selectedGovernedWalletAddress
                  ? shortAddress(selectedGovernedWalletAddress)
                  : "NO WALLET"}
              </span>
            </span>
            {unsavedCount > 0 ? (
              <span className="flex items-center gap-1.5 border border-[#E0A04A]/45 bg-[#1f1707] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#E0A04A]">
                <span className="h-1.5 w-1.5 bg-[#E0A04A]" /> {unsavedCount} UNSAVED CHANGES
              </span>
            ) : (
              <span className="flex items-center gap-1.5 border border-[#6E9E7C]/35 bg-[#101915] px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#6E9E7C]">
                ACTIVE POLICY
              </span>
            )}
          </div>
          <div className="text-[10px] tracking-[0.1em] text-[#5B626C]">
            {policyReadStatus === "checking"
              ? "READING ON-CHAIN POLICY"
              : policyPendingIndexer
                ? "PENDING INDEXER SYNC"
                : "ARC TESTNET POLICY"}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_minmax(0,520px)]">
          <DoctrineForm
            anomalyFreezeThresholdBps={anomalyFreezeThresholdBps}
            draft={policyDraft}
            networkNotice={policyNetworkNotice}
            onDraftChange={updatePolicyDraft}
            onWalletChange={setSelectedPolicyWalletAddress}
            onToggleCategory={toggleCategory}
            readStatus={policyReadStatus}
            saving={policyWritesBusy}
            selectedWalletAddress={selectedPolicyWalletAddress}
            walletOptions={policyWalletOptions}
          />
          <DoctrineSimulation
            diffRows={policyDiffs}
            disabledReason={policyWriteDisabledReason}
            enabledCategories={policyDraft.enabledCategories}
            error={policyError}
            onSave={savePolicyOnChain}
            pendingIndexer={policyPendingIndexer}
            saving={policyWritesBusy}
            txHash={policyTxHash}
            unsavedCount={unsavedCount}
          />
        </div>
      </main>
    </GovernanceFrame>
  );
}

function DoctrineForm({
  anomalyFreezeThresholdBps,
  draft,
  networkNotice,
  onDraftChange,
  onWalletChange,
  onToggleCategory,
  readStatus,
  saving,
  selectedWalletAddress,
  walletOptions,
}: Readonly<{
  anomalyFreezeThresholdBps: bigint | null;
  draft: PolicyDraftState;
  networkNotice: string | null;
  onDraftChange: (patch: Partial<PolicyDraftState>) => void;
  onWalletChange: (address: string) => void;
  onToggleCategory: (category: DoctrineCategoryValue) => void;
  readStatus: SignerReadStatus;
  saving: boolean;
  selectedWalletAddress: string;
  walletOptions: ReadonlyArray<{ address: string; id: string; label: string }>;
}>) {
  const freezeThresholdLabel =
    anomalyFreezeThresholdBps === null
      ? "UNKNOWN"
      : `${Number(anomalyFreezeThresholdBps) / 100} deviation`;

  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <PanelHeader
        title="DOCTRINE FORM"
        meta={readStatus === "ready" ? "ACTIVE / ON-CHAIN" : "READING / ARC TESTNET"}
      />
      <FormSection title="01 - IDENTITY">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#5B626C]">
              GOVERNED WALLET
            </div>
            <select
              value={selectedWalletAddress}
              onChange={(event) => onWalletChange(event.target.value)}
              disabled={saving || walletOptions.length === 0}
              className={arcanumSelectClassName}
            >
              {walletOptions.length > 0 ? (
                walletOptions.map((wallet) => (
                  <option
                    key={wallet.address}
                    value={wallet.address}
                    className="bg-[#101216] text-[#EDF0F3]"
                  >
                    {wallet.label} / {shortAddress(wallet.address)}
                  </option>
                ))
              ) : (
                <option value="" className="bg-[#101216] text-[#EDF0F3]">
                  No governed wallet indexed
                </option>
              )}
            </select>
          </label>
          <Field
            label="POLICY SOURCE"
            muted
            icon={<Lock className="h-3 w-3" strokeWidth={iconStroke} />}
          >
            {readStatus === "ready" ? "GuardedWallet.policy()" : "Awaiting on-chain read"}
          </Field>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-[#8A909B]">
          Policy rules control what an authorized agent signer can spend. Updates should be treated
          like security changes because they affect how autonomous payments are approved, denied,
          escalated, or frozen.
        </p>
      </FormSection>
      <FormSection title="02 - SPEND LIMITS">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <PolicyMoneyInput
            label="PER-TX CAP"
            value={draft.perTxCap}
            onChange={(value) => onDraftChange({ perTxCap: value })}
          />
          <PolicyMoneyInput
            label="DAILY CAP"
            value={draft.dailyCap}
            onChange={(value) => onDraftChange({ dailyCap: value })}
          />
          <PolicyMoneyInput
            label="MONTHLY CAP"
            value={draft.monthlyCap}
            onChange={(value) => onDraftChange({ monthlyCap: value })}
          />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <PolicyMoneyInput
            label="ESCALATION THRESHOLD"
            value={draft.escalationThreshold}
            onChange={(value) => onDraftChange({ escalationThreshold: value })}
            warn
          />
          <Field
            label="PER-VENDOR CAP"
            muted
            icon={<Lock className="h-3 w-3" strokeWidth={iconStroke} />}
          >
            Managed in VendorRegistry
          </Field>
        </div>
      </FormSection>
      <FormSection title="03 - ALLOWED CATEGORIES">
        <div className="divide-y divide-[#1E222A] border border-[#282C34]">
          {doctrineCategoryOptions.map((category) => {
            const enabled = draft.enabledCategories.has(category.value);

            return (
              <button
                type="button"
                key={category.value}
                aria-pressed={enabled}
                disabled={saving}
                onClick={() => onToggleCategory(category.value)}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-left hover:bg-[#1B1F26] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span
                  className={cn(
                    "flex items-center gap-2 text-[12px]",
                    enabled ? "text-[#D7DBE0]" : "text-[#8A909B]",
                  )}
                >
                  <span
                    className="h-3 w-1"
                    style={{ background: categoryColors[category.value] }}
                  />
                  {category.label}
                </span>
                <span
                  className={cn(
                    "flex h-5 w-9 items-center px-0.5",
                    enabled ? "bg-[#2A3340]" : "bg-[#101216]",
                  )}
                >
                  <span
                    className={cn("h-4 w-4", enabled ? "ml-auto bg-[#6E9E7C]" : "bg-[#3A4250]")}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </FormSection>
      <FormSection
        title="04 - VENDOR ALLOWLIST"
        right={
          <span className={draft.requireAllowlist ? "text-[#6E9E7C]" : "text-[#E0A04A]"}>
            {draft.requireAllowlist ? "REQUIRED" : "OPTIONAL"}
          </span>
        }
      >
        <button
          type="button"
          aria-pressed={draft.requireAllowlist}
          disabled={saving}
          onClick={() => onDraftChange({ requireAllowlist: !draft.requireAllowlist })}
          className="flex h-9 w-full cursor-pointer items-center justify-between border border-[#282C34] bg-[#101216] px-3 text-left text-[12px] text-[#D7DBE0] hover:border-[#3A4250] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>Require VendorRegistry allowlist before spend</span>
          <span className={draft.requireAllowlist ? "text-[#6E9E7C]" : "text-[#E0A04A]"}>
            {draft.requireAllowlist ? "ON" : "OFF"}
          </span>
        </button>
        <Link
          href="/vendors"
          className="mt-3 flex h-9 w-full items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-left text-[12px] text-[#5B626C] hover:text-[#8A909B]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} /> manage specific vendors in
          VendorRegistry
        </Link>
      </FormSection>
      <FormSection title="05 - QUORUM & APPROVALS">
        <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_1fr]">
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#5B626C]">THRESHOLD</div>
            <div className="flex items-stretch border border-[#282C34]">
              <button
                type="button"
                disabled
                className="flex h-9 w-9 cursor-not-allowed items-center justify-center bg-[#101216] text-[#5B626C]"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              </button>
              <div className="flex h-9 w-24 items-center justify-center bg-[#101216] text-[12px] text-[#8A909B]">
                INDEXER ONLY
              </div>
              <button
                type="button"
                disabled
                className="flex h-9 w-9 cursor-not-allowed items-center justify-center bg-[#101216] text-[#5B626C]"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              </button>
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#5B626C]">APPROVERS</div>
            <div className="border border-[#282C34] bg-[#101216] px-3 py-2 text-[11px] leading-relaxed text-[#8A909B]">
              Escalation council updates are a separate `configureEscalation` transaction. This
              editor does not fake quorum writes until the indexed council read model is available.
            </div>
          </div>
        </div>
      </FormSection>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="text-[10px] tracking-[0.22em] text-[#5B626C]">06 - ANOMALY THRESHOLD</div>
          <div className="text-[12px] text-[#EDF0F3]">{freezeThresholdLabel}</div>
        </div>
        <Gauge value={37.5} label="" min="" max="" />
        <div className="mt-2 flex items-center justify-between text-[9px] tracking-[0.16em] text-[#5B626C]">
          <span>0.0 deviation sensitive</span>
          <span>8.0 deviation permissive</span>
        </div>
        <div className="mt-3 border border-[#282C34] bg-[#101216] px-3 py-2 text-[11px] leading-relaxed text-[#8A909B]">
          Freeze threshold writes are not included in this policy transaction because the deployed
          event does not expose a threshold update for indexer sync.
        </div>
        {networkNotice ? (
          <div className="mt-3 border border-[#E0A04A]/30 bg-[#1d170d] px-3 py-2 text-[11px] tracking-[0.08em] text-[#E0A04A]">
            {networkNotice}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PolicyMoneyInput({
  label,
  onChange,
  value,
  warn,
}: Readonly<{
  label: string;
  onChange: (value: string) => void;
  value: string;
  warn?: boolean;
}>) {
  return (
    <label>
      <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "flex h-9 items-center border bg-[#101216] px-3 text-[12px]",
          warn ? "border-[#E0A04A]/40" : "border-[#282C34]",
        )}
      >
        <span className="text-[#5B626C]">$</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode="decimal"
          className="ml-1 min-w-0 flex-1 bg-transparent text-[#EDF0F3] outline-none"
        />
        <span className="ml-2 text-[10px] tracking-[0.08em] text-[#5B626C]">USDC</span>
      </div>
    </label>
  );
}

function FormSection({
  title,
  right,
  children,
}: Readonly<{ title: string; right?: ReactNode; children: ReactNode }>) {
  return (
    <div className="border-b border-[#282C34] p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] tracking-[0.22em] text-[#5B626C]">{title}</div>
        {right ? <div className="text-[10px] tracking-[0.1em] text-[#5B626C]">{right}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
  prefix,
  icon,
  active,
  muted,
  warn,
  cursor,
}: Readonly<{
  label: string;
  children: ReactNode;
  prefix?: string;
  icon?: ReactNode;
  active?: boolean;
  muted?: boolean;
  warn?: boolean;
  cursor?: boolean;
}>) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] tracking-[0.1em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "flex h-9 items-center border bg-[#101216] px-3 text-[12px]",
          warn ? "border-[#E0A04A]/40" : active ? "border-[#3A4250]" : "border-[#282C34]",
          muted ? "text-[#8A909B]" : "text-[#EDF0F3]",
        )}
      >
        {icon}
        {prefix ? <span className="text-[#5B626C]">{prefix}</span> : null}
        <span className={cn(prefix && "ml-1", icon && "ml-2")}>{children}</span>
        {cursor ? <span className="ml-0.5 inline-block h-3.5 w-px bg-[#FF5A1F]" /> : null}
      </div>
    </div>
  );
}

function DoctrineSimulation({
  diffRows,
  disabledReason,
  enabledCategories,
  error,
  onSave,
  pendingIndexer,
  saving,
  txHash,
  unsavedCount,
}: Readonly<{
  diffRows: ReadonlyArray<readonly [string, string, string]>;
  disabledReason: string | null;
  enabledCategories: ReadonlySet<DoctrineCategoryValue>;
  error: string | null;
  onSave: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  pendingIndexer: boolean;
  saving: boolean;
  txHash: Hash | null;
  unsavedCount: number;
}>) {
  return (
    <div className="self-start border border-[#282C34] bg-[#181B21]">
      <PanelHeader title="POLICY CHANGE PREVIEW">
        <button
          type="button"
          onClick={() =>
            toast.success(`POLICY PREVIEW UPDATED / ${enabledCategories.size} categories enabled`)
          }
          className="flex items-center gap-1.5 border border-[#3A4250] px-2 py-1 text-[10px] tracking-[0.14em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
        >
          <Play className="h-3 w-3" strokeWidth={iconStroke} /> PREVIEW
        </button>
      </PanelHeader>
      <div className="p-4">
        <div className="border border-[#282C34] bg-[#101216] p-3">
          <div className="flex items-center justify-between text-[10px] tracking-[0.14em]">
            <span className="text-[#5B626C]">INDEXED ACTIVITY REPLAY</span>
            <span className="text-[#8A909B]">NOT LOADED</span>
          </div>
          <div className="mt-2 text-[11px] leading-relaxed text-[#8A909B]">
            This panel shows the policy diff only. It does not invent historical spend, vendors, or
            payment verdicts for a live wallet.
          </div>
        </div>
      </div>
      <div className="border-t border-[#282C34]">
        <div className="border-t border-[#282C34] p-4">
          <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">DOCTRINE DIFF</div>
          <div className="mt-2 divide-y divide-[#1E222A] border border-[#282C34] text-[11px]">
            {diffRows.length > 0 ? (
              diffRows.map(([label, before, after]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-[#E0A04A]">+ {label.toLowerCase()}</span>
                  <span className="min-w-0 text-right">
                    <span className="text-[#5B626C]">{before}</span> to{" "}
                    <span className="text-[#D7DBE0]">{after}</span>
                  </span>
                </div>
              ))
            ) : (
              <div className="px-3 py-2 text-[#6E9E7C]">No policy changes pending.</div>
            )}
          </div>
          <PolicyWriteNotice
            disabledReason={disabledReason}
            error={error}
            onSave={onSave}
            pendingIndexer={pendingIndexer}
            saving={saving}
            txHash={txHash}
            unsavedCount={unsavedCount}
          />
        </div>
      </div>
    </div>
  );
}

function PolicyWriteNotice({
  disabledReason,
  error,
  onSave,
  pendingIndexer,
  saving,
  txHash,
  unsavedCount,
}: Readonly<{
  disabledReason: string | null;
  error: string | null;
  onSave: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  pendingIndexer: boolean;
  saving: boolean;
  txHash: Hash | null;
  unsavedCount: number;
}>) {
  const txArcscanUrl = txHash ? getArcscanTxUrl(txHash) : null;

  return (
    <div className="mt-3 space-y-2">
      {pendingIndexer ? (
        <div className="border border-[#6E9E7C]/30 bg-[#111b15] px-3 py-2 text-[11px] text-[#6E9E7C]">
          Contract confirmed. Policy is live on-chain; event indexer may lag before read-model
          refresh.
        </div>
      ) : null}
      {error ? (
        <div className="border border-[#EC7A6B]/30 bg-[#211514] px-3 py-2 text-[11px] text-[#EC7A6B]">
          {error}
        </div>
      ) : null}
      {txHash ? (
        <div className="flex flex-wrap items-center gap-2 text-[10px] tracking-[0.12em] text-[#5B626C]">
          <span>TX {shortAddress(txHash, { head: 10, tail: 6 })}</span>
          {txArcscanUrl ? (
            <a
              href={txArcscanUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-[#8A909B] hover:text-[#D7DBE0]"
            >
              OPEN IN ARCSCAN <ExternalLink className="h-3 w-3" strokeWidth={iconStroke} />
            </a>
          ) : null}
        </div>
      ) : null}
      {disabledReason ? (
        <div className="text-[10px] leading-relaxed tracking-[0.1em] text-[#5B626C]">
          {disabledReason}
        </div>
      ) : null}
      <button
        type="button"
        disabled={saving || Boolean(disabledReason)}
        onClick={(event) => onSave(event)}
        className={cn(
          "text-left text-[10px] tracking-[0.14em]",
          disabledReason
            ? "cursor-not-allowed text-[#5B626C] opacity-70"
            : "text-[#E0A04A] hover:text-[#D7DBE0]",
        )}
      >
        {saving
          ? "CONFIRMING POLICY..."
          : unsavedCount > 0
            ? `${unsavedCount} CHANGES / SUBMIT ON-CHAIN`
            : "NO POLICY CHANGES"}
      </button>
    </div>
  );
}

export function VendorsCanvasPage() {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const liveVendors = useLiveVendors();
  const [localVendors, setLocalVendors] = useState<readonly VendorDisplay[]>([]);
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<AddVendorFormState>(initialVendorForm);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorTxHash, setVendorTxHash] = useState<Hash | null>(null);
  const [vendorQuery, setVendorQuery] = useState("");
  const [vendorCategory, setVendorCategory] = useState("ALL");
  const [openVendorMenuKey, setOpenVendorMenuKey] = useState<string | null>(null);
  const [detailVendor, setDetailVendor] = useState<VendorDisplay | null>(null);
  const [selectedVendorWalletAddress, setSelectedVendorWalletAddress] = useState("");
  const [vendorWalletOwner, setVendorWalletOwner] = useState<Address | null>(null);
  const [vendorOwnerReadStatus, setVendorOwnerReadStatus] = useState<SignerReadStatus>("idle");
  const vendorSubmittingRef = useRef(false);
  const utils = trpc.useUtils();
  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled: workspace.isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const canShowDemoWorkspace = workspace.isDemo;
  const vendorWalletOptions = useMemo(
    () =>
      (walletsQuery.data ?? []).map((wallet) => ({
        address: wallet.address,
        label: wallet.label,
      })),
    [walletsQuery.data],
  );
  const selectedGovernedWalletAddress = isEvmAddress(selectedVendorWalletAddress)
    ? (selectedVendorWalletAddress as Address)
    : null;
  const ownerMatchesConnectedWallet = Boolean(
    vendorWalletOwner && address && isSameAddress(vendorWalletOwner, address),
  );
  const vendorWritesBusy =
    vendorSaving || vendorSubmittingRef.current || switchPending || writePending;
  const baseRows: readonly VendorDisplay[] = useMemo(
    () =>
      liveVendors.data.length > 0
        ? liveVendors.data.map(vendorRowFromLive)
        : canShowDemoWorkspace
          ? vendors
          : [],
    [liveVendors.data, canShowDemoWorkspace],
  );
  const scopedLocalVendors: readonly VendorDisplay[] = useMemo(() => {
    if (!workspace.isAuthenticated || !selectedGovernedWalletAddress) {
      return [];
    }

    return localVendors.filter((vendor) =>
      isSameAddress(vendor[7]?.walletAddress, selectedGovernedWalletAddress),
    );
  }, [localVendors, selectedGovernedWalletAddress, workspace.isAuthenticated]);
  const unfilteredRows: readonly VendorDisplay[] = useMemo(
    () => [...scopedLocalVendors, ...baseRows],
    [baseRows, scopedLocalVendors],
  );
  const rows = useMemo(() => {
    const query = normalizeSearch(vendorQuery);
    return unfilteredRows.filter((vendor) => {
      const [, name, address, category, approvedBy, confidential, used, risk] = vendor;
      const categoryMatches =
        vendorCategory === "ALL" ||
        String(category) === vendorCategory ||
        (vendorCategory === "ARCANEVM" && confidential);
      const queryMatches = matchesSearch(query, [
        name,
        address,
        category,
        approvedBy.join(" "),
        confidential ? "arcanevm confidential shielded" : "public",
        used,
        risk,
      ]);
      return categoryMatches && queryMatches;
    });
  }, [unfilteredRows, vendorCategory, vendorQuery]);
  const vendorFiltersActive = vendorQuery.trim() !== "" || vendorCategory !== "ALL";
  const resetVendorFilters = () => {
    setVendorQuery("");
    setVendorCategory("ALL");
  };
  const vendorCounts = useMemo(
    () => ({
      ALL: unfilteredRows.length,
      API: unfilteredRows.filter((vendor) => vendor[3] === "API").length,
      ARCANEVM: unfilteredRows.filter((vendor) => vendor[5]).length,
      COMPUTE: unfilteredRows.filter((vendor) => vendor[3] === "COMPUTE").length,
      DATA: unfilteredRows.filter((vendor) => vendor[3] === "DATA").length,
    }),
    [unfilteredRows],
  );
  const emptyVendors = getWorkspaceEmptyCopy(workspace.dataMode, "vendors");

  useEffect(() => {
    if (
      selectedVendorWalletAddress &&
      vendorWalletOptions.some((wallet) =>
        isSameAddress(wallet.address, selectedVendorWalletAddress),
      )
    ) {
      return;
    }

    setSelectedVendorWalletAddress(vendorWalletOptions[0]?.address ?? "");
  }, [selectedVendorWalletAddress, vendorWalletOptions]);

  useEffect(() => {
    let cancelled = false;

    if (!publicClient || !selectedGovernedWalletAddress) {
      setVendorWalletOwner(null);
      setVendorOwnerReadStatus(selectedGovernedWalletAddress ? "error" : "idle");
      return () => {
        cancelled = true;
      };
    }

    setVendorOwnerReadStatus("checking");
    publicClient
      .readContract({
        address: selectedGovernedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      })
      .then((owner) => {
        if (cancelled) {
          return;
        }

        setVendorWalletOwner(owner as Address);
        setVendorOwnerReadStatus("ready");
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setVendorWalletOwner(null);
        setVendorOwnerReadStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [publicClient, selectedGovernedWalletAddress]);

  useEffect(() => {
    if (!openVendorMenuKey) {
      return;
    }

    if (!rows.some((vendor) => vendorRowKey(vendor) === openVendorMenuKey)) {
      setOpenVendorMenuKey(null);
    }
  }, [openVendorMenuKey, rows]);

  useEffect(() => {
    if (!detailVendor) {
      return;
    }

    if (!rows.some((vendor) => vendorRowKey(vendor) === vendorRowKey(detailVendor))) {
      setDetailVendor(null);
    }
  }, [detailVendor, rows]);

  const updateVendorForm = (patch: Partial<AddVendorFormState>) => {
    setVendorForm((current) => ({ ...current, ...patch }));
    setVendorError(null);
  };

  const closeAddVendor = () => {
    if (vendorSaving) {
      return;
    }

    setAddVendorOpen(false);
    setVendorError(null);
  };

  const vendorWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsQuery.isLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage VendorRegistry."
        : vendorOwnerReadStatus === "checking"
          ? "Checking governed wallet owner."
          : vendorOwnerReadStatus === "error"
            ? "Unable to read governed wallet owner on Arc Testnet."
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can manage vendors."
              : null;
  const vendorNetworkNotice =
    isConnected && chainId !== arcTestnet.id
      ? "Wallet will be asked to switch to Arc Testnet."
      : null;

  const ensureVendorWriteReady = async () => {
    if (vendorWriteDisabledReason) {
      throw new Error(vendorWriteDisabledReason);
    }

    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error("Arc Testnet RPC is unavailable.");
    }

    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }

    return selectedGovernedWalletAddress;
  };

  const updatePendingVendorRow = (
    vendorAddress: Address,
    name: string,
    category: VendorCategoryValue,
    perVendorCap: bigint,
    note: string | undefined,
    status: VendorDisplayMeta["status"],
  ) => {
    const nextVendor: VendorDisplay = [
      vendorInitials(name),
      name,
      vendorAddress,
      categoryLabel(category),
      ["PENDING"],
      perVendorCap > 0n,
      "Awaiting event indexer",
      {
        createdAt: "Pending indexed timestamp",
        lastUsed: "Never used",
        note,
        status,
        walletAddress: selectedGovernedWalletAddress ?? undefined,
      },
    ];

    setLocalVendors((current) => [
      nextVendor,
      ...current.filter((vendor) => {
        const meta = vendor[7];
        return !(
          isSameAddress(vendor[2], vendorAddress) &&
          isSameAddress(meta?.walletAddress, selectedGovernedWalletAddress)
        );
      }),
    ]);
  };

  const openVendorEditor = (vendor: VendorDisplay) => {
    const [, name, address, category, , confidential, , meta] = vendor;
    if (!isEvmAddress(address)) {
      toast.info("Vendor action unavailable", {
        description: "A full vendor address is required for on-chain updates.",
      });
      return;
    }

    if (meta?.walletAddress && !isSameAddress(meta.walletAddress, selectedVendorWalletAddress)) {
      setSelectedVendorWalletAddress(meta.walletAddress);
    }

    setVendorForm({
      address,
      category:
        vendorCategoryOptions.find((option) => categoryLabel(option.value) === category)?.value ??
        "other",
      confidential,
      name,
      notes: meta?.note ?? "",
      perVendorCap: confidential ? "100" : "0",
    });
    setVendorTxHash(null);
    setVendorError(null);
    setAddVendorOpen(true);
  };

  const addVendorRemote = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("vendors.add", event)) {
      return;
    }

    if (vendorSubmittingRef.current) {
      return;
    }

    const name = vendorForm.name.trim();
    const address = vendorForm.address.trim();
    const notes = vendorForm.notes.trim();

    vendorSubmittingRef.current = true;
    setVendorSaving(true);
    setVendorError(null);
    setVendorTxHash(null);
    try {
      if (name.length < 2) {
        throw new Error("Vendor name must be at least 2 characters.");
      }

      if (!isEvmAddress(address) || isZeroAddress(address)) {
        throw new Error("Vendor add requires a valid non-zero 0x address.");
      }

      const categoryIndex = vendorCategoryIndex(vendorForm.category);
      if (categoryIndex < 0) {
        throw new Error("Select a valid vendor category.");
      }

      const perVendorCap = parseUsdcCapInput(vendorForm.perVendorCap, "Per-vendor cap");
      const governedWallet = await ensureVendorWriteReady();
      const vendorAddress = address as Address;
      const metadataHash = keccak256(toBytes(`arcanum-vendor:${name}:${vendorAddress}:${notes}`));

      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "addVendor",
        args: [vendorAddress, categoryIndex, perVendorCap, metadataHash],
        chainId: arcTestnet.id,
      });
      setVendorTxHash(hash);

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") {
        throw new Error("VendorRegistry transaction reverted.");
      }

      updatePendingVendorRow(
        vendorAddress,
        name,
        vendorForm.category,
        perVendorCap,
        notes || undefined,
        perVendorCap > 0n ? "confidential" : "approved",
      );
      await utils.vendors.list.invalidate();
      setVendorForm(initialVendorForm);
      setAddVendorOpen(false);
      toast.success("VENDOR WRITE CONFIRMED", {
        description:
          "On-chain write confirmed. Event indexer may lag before the read model updates.",
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setVendorError(message);
      toast.error("VENDOR WRITE FAILED", { description: message });
    } finally {
      setVendorSaving(false);
      vendorSubmittingRef.current = false;
    }
  };

  const setVendorStatusRemote = async (
    action: "block" | "remove",
    vendor: VendorDisplay,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`vendors.${action}`, event)) {
      return;
    }

    if (vendorSubmittingRef.current) {
      return;
    }

    const [, name, address, category, , confidential, , meta] = vendor;
    if (!isEvmAddress(address)) {
      toast.info("Vendor action unavailable", {
        description: "A full vendor address is required for on-chain writes.",
      });
      return;
    }

    if (meta?.walletAddress && !isSameAddress(meta.walletAddress, selectedVendorWalletAddress)) {
      toast.info("Vendor action unavailable", {
        description: "Select this vendor's governed wallet before writing.",
      });
      return;
    }

    vendorSubmittingRef.current = true;
    setVendorSaving(true);
    setVendorError(null);
    setVendorTxHash(null);
    try {
      const governedWallet = await ensureVendorWriteReady();
      const functionName = action === "block" ? "blockVendor" : "removeVendor";
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName,
        args: [address as Address],
        chainId: arcTestnet.id,
      });
      setVendorTxHash(hash);

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") {
        throw new Error("VendorRegistry transaction reverted.");
      }

      updatePendingVendorRow(
        address as Address,
        name,
        vendorCategoryOptions.find((option) => categoryLabel(option.value) === category)?.value ??
          "other",
        confidential ? parseUnits("100", 6) : 0n,
        meta?.note,
        action === "block" ? "blocked" : undefined,
      );
      await utils.vendors.list.invalidate();
      toast.success(action === "block" ? "VENDOR BLOCK CONFIRMED" : "VENDOR REMOVE CONFIRMED", {
        description:
          "On-chain write confirmed. Event indexer may lag before the read model updates.",
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setVendorError(message);
      toast.error(action === "block" ? "VENDOR BLOCK FAILED" : "VENDOR REMOVE FAILED", {
        description: message,
      });
    } finally {
      setVendorSaving(false);
      vendorSubmittingRef.current = false;
    }
  };

  return (
    <GovernanceFrame
      active="vendors"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / VENDORS`}
    >
      <Main>
        <div className="grid grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <StatTile
            label="APPROVED VENDORS"
            value={String(vendorCounts.ALL).padStart(2, "0")}
            caption="ON ALLOWLIST"
          />
          <StatTile
            label="CONFIDENTIAL"
            value={String(vendorCounts.ARCANEVM).padStart(2, "0")}
            valueClassName="text-[#FF5A1F]"
            caption="ARCANEVM SHIELDED"
          />
          <StatTile
            label="CATEGORIES"
            value={String(new Set(unfilteredRows.map((vendor) => String(vendor[3]))).size).padStart(
              2,
              "0",
            )}
            caption="PENDING REVIEW 00"
          />
          <StatTile
            label="ALL VETTED"
            value={vendorCounts.ALL > 0 ? "100%" : "00%"}
            caption={canShowDemoWorkspace ? "DEMO DATA" : "LIVE WORKSPACE"}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] tracking-[0.1em]">
            {[
              ["ALL", String(vendorCounts.ALL), undefined],
              ["API", String(vendorCounts.API), "API"],
              ["COMPUTE", String(vendorCounts.COMPUTE), "COMPUTE"],
              ["DATA", String(vendorCounts.DATA), "DATA"],
              ["ARCANEVM", String(vendorCounts.ARCANEVM), undefined],
            ].map(([label, count, category]) => {
              const filter = String(category ?? label);
              const selected = vendorCategory === filter;
              return (
                <button
                  type="button"
                  key={String(label)}
                  onClick={() => setVendorCategory(filter)}
                  className={cn(
                    "flex items-center gap-1.5 border px-3 py-1.5",
                    selected
                      ? "border-[#3A4250] bg-[#1B1F26] text-[#EDF0F3]"
                      : "border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]",
                  )}
                >
                  {category ? (
                    <span
                      className="h-3 w-1"
                      style={{ background: categoryColors[String(category)] }}
                    />
                  ) : null}
                  {label} <span className="text-[#5B626C]">{count}</span>
                </button>
              );
            })}
          </div>
          <label className="flex h-9 min-w-[220px] max-w-[320px] flex-1 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[#5B626C]">
            <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            <input
              value={vendorQuery}
              onChange={(event) => setVendorQuery(event.target.value)}
              placeholder="filter vendors, addresses..."
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
            />
          </label>
          <label className="flex h-9 min-w-[220px] max-w-[300px] flex-1 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[#5B626C]">
            <span className="text-[10px] tracking-[0.12em]">WALLET</span>
            <select
              value={selectedVendorWalletAddress}
              onChange={(event) => setSelectedVendorWalletAddress(event.target.value)}
              disabled={vendorWalletOptions.length === 0 || vendorWritesBusy}
              className="min-w-0 flex-1 appearance-none bg-transparent text-[12px] text-[#EDF0F3] outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              {vendorWalletOptions.length > 0 ? (
                vendorWalletOptions.map((wallet) => (
                  <option
                    key={wallet.address}
                    value={wallet.address}
                    className="bg-[#101216] text-[#EDF0F3]"
                  >
                    {wallet.label} / {shortAddress(wallet.address)}
                  </option>
                ))
              ) : (
                <option value="" className="bg-[#101216] text-[#EDF0F3]">
                  No governed wallet
                </option>
              )}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setAddVendorOpen(true)}
            className="flex h-9 shrink-0 items-center gap-2 border border-[#3A4250] px-4 text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={iconStroke} /> ADD VENDOR
          </button>
        </div>

        <div className="border border-[#282C34] bg-[#181B21]">
          <PanelHeader title="VENDOR REGISTRY" meta={`${vendorCounts.ALL} COUNTERPARTIES`} />
          <div className="overflow-x-auto">
            <div className="min-w-[940px]">
              <div
                className={cn(
                  vendorGridClass,
                  "items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.13em] text-[#5B626C]",
                )}
              >
                <span className="min-w-0 truncate">VENDOR</span>
                <span className="min-w-0 truncate">ADDRESS</span>
                <span className="min-w-0 truncate">CATEGORY</span>
                <span className="min-w-0 truncate">APPROVED BY</span>
                <span className="min-w-0 truncate">CONFIDENTIAL</span>
                <span className="min-w-0 truncate">LAST USED</span>
                <span />
              </div>
              <div className="text-[12px]">
                {liveVendors.isError && unfilteredRows.length === 0 ? (
                  <ErrorState
                    cause="vendor query failed"
                    onRetry={() => void liveVendors.refetch()}
                  />
                ) : rows.length > 0 ? (
                  rows.map((vendor) => {
                    const rowKey = vendorRowKey(vendor);
                    return (
                      <VendorRow
                        key={rowKey}
                        menuOpen={openVendorMenuKey === rowKey}
                        onBlockVendor={(event) =>
                          void setVendorStatusRemote("block", vendor, event)
                        }
                        onEditVendor={() => openVendorEditor(vendor)}
                        onViewDetails={() => {
                          setDetailVendor(vendor);
                          setOpenVendorMenuKey(null);
                        }}
                        vendor={vendor}
                        onMenuOpenChange={(open) => setOpenVendorMenuKey(open ? rowKey : null)}
                        onRemoveVendor={(event) =>
                          void setVendorStatusRemote("remove", vendor, event)
                        }
                      />
                    );
                  })
                ) : vendorFiltersActive && unfilteredRows.length > 0 ? (
                  <EmptyState
                    actionLabel={vendorQuery.trim() ? "CLEAR SEARCH" : "RESET FILTERS"}
                    description={
                      vendorQuery.trim()
                        ? `No vendors match "${vendorQuery.trim()}". Clear search or try another term.`
                        : "No vendors match this filter. Reset filters or try another term."
                    }
                    onAction={resetVendorFilters}
                    title="NO VENDORS MATCH THIS FILTER"
                  />
                ) : (
                  <EmptyState description={emptyVendors.description} title={emptyVendors.title} />
                )}
              </div>
              <div className="flex h-9 items-center justify-between border-t border-[#282C34] px-4 text-[10px] tracking-[0.14em] text-[#5B626C]">
                <span>
                  {vendorCounts.ALL} COUNTERPARTIES /{" "}
                  {String(vendorCounts.ARCANEVM).padStart(2, "0")} SHIELDED
                </span>
                <span>{canShowDemoWorkspace ? "DEMO DATA" : "LIVE WORKSPACE"}</span>
              </div>
            </div>
          </div>
        </div>
      </Main>
      {addVendorOpen ? (
        <AddVendorModal
          error={vendorError}
          form={vendorForm}
          networkNotice={vendorNetworkNotice}
          onAdd={addVendorRemote}
          onChange={updateVendorForm}
          onClose={closeAddVendor}
          onWalletChange={setSelectedVendorWalletAddress}
          saving={vendorSaving}
          selectedWalletAddress={selectedVendorWalletAddress}
          txHash={vendorTxHash}
          walletOptions={vendorWalletOptions}
          writeDisabledReason={vendorWriteDisabledReason}
        />
      ) : null}
      {detailVendor ? (
        <VendorDetailsModal
          onClose={() => setDetailVendor(null)}
          selectedWalletAddress={selectedVendorWalletAddress}
          vendor={detailVendor}
        />
      ) : null}
    </GovernanceFrame>
  );
}

function AddVendorModal({
  error,
  form,
  networkNotice,
  onAdd,
  onChange,
  onClose,
  onWalletChange,
  saving,
  selectedWalletAddress,
  txHash,
  walletOptions,
  writeDisabledReason,
}: Readonly<{
  error: string | null;
  form: AddVendorFormState;
  networkNotice: string | null;
  onAdd: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onChange: (patch: Partial<AddVendorFormState>) => void;
  onClose: () => void;
  onWalletChange: (address: string) => void;
  saving: boolean;
  selectedWalletAddress: string;
  txHash: Hash | null;
  walletOptions: ReadonlyArray<{ address: string; label: string }>;
  writeDisabledReason: string | null;
}>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="Close add vendor dialog"
        className="fixed inset-0 z-50 bg-[#0a0b0e]/70"
        onClick={onClose}
      />
      <section className="fixed left-1/2 top-1/2 z-[60] flex max-h-[calc(100vh-32px)] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col border border-[#282C34] bg-[#181B21] shadow-[0_0_60px_rgba(0,0,0,0.65)]">
        <div className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
          <div className="text-[11px] tracking-[0.18em] text-[#D7DBE0]">ADD VENDOR</div>
          <button
            type="button"
            aria-label="Close add vendor dialog"
            onClick={onClose}
            disabled={saving}
            className="flex h-7 w-7 items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={iconStroke} />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 text-[12px] text-[#8A909B]">
          <p className="leading-relaxed">
            Vendors are approved payment destinations for your governed wallet. Agent spend requests
            to vendors still pass through policy checks.
          </p>
          <label className="space-y-1.5">
            <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">
              GOVERNED WALLET
            </span>
            <select
              value={selectedWalletAddress}
              onChange={(event) => onWalletChange(event.target.value)}
              disabled={saving || walletOptions.length === 0}
              className={arcanumSelectClassName}
            >
              {walletOptions.length > 0 ? (
                walletOptions.map((wallet) => (
                  <option
                    key={wallet.address}
                    value={wallet.address}
                    className="bg-[#101216] text-[#EDF0F3]"
                  >
                    {wallet.label} / {shortAddress(wallet.address)}
                  </option>
                ))
              ) : (
                <option value="" className="bg-[#101216] text-[#EDF0F3]">
                  No governed wallet indexed
                </option>
              )}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">
                VENDOR NAME
              </span>
              <input
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="Qdrant Cloud"
                className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#4D5560] focus:border-[#3A4250]"
              />
            </label>
            <label className="space-y-1.5">
              <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">CATEGORY</span>
              <select
                value={form.category}
                onChange={(event) =>
                  onChange({ category: event.target.value as VendorCategoryValue })
                }
                className={arcanumSelectClassName}
              >
                {vendorCategoryOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-[#101216] text-[#EDF0F3]"
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="space-y-1.5">
            <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">
              ADDRESS / DOMAIN
            </span>
            <input
              value={form.address}
              onChange={(event) => onChange({ address: event.target.value })}
              placeholder="0x vendor address"
              className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 font-mono text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#4D5560] focus:border-[#3A4250]"
            />
            <span className="block text-[10px] tracking-[0.1em] text-[#5B626C]">
              On-chain VendorRegistry writes require a 0x destination address. Domains can be
              captured in notes.
            </span>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">
              PER-VENDOR CAP / USDC
            </span>
            <input
              value={form.perVendorCap}
              onChange={(event) => onChange({ perVendorCap: event.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="h-9 w-full border border-[#282C34] bg-[#101216] px-3 text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#4D5560] focus:border-[#3A4250]"
            />
            <span className="block text-[10px] tracking-[0.1em] text-[#5B626C]">
              `0` means no vendor-specific cap; global policy caps still apply.
            </span>
          </label>
          <label className="space-y-1.5">
            <span className="block text-[10px] tracking-[0.14em] text-[#5B626C]">NOTES</span>
            <textarea
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="approval context, domain, owner"
              className="min-h-20 w-full resize-none border border-[#282C34] bg-[#101216] px-3 py-2 text-[12px] text-[#D7DBE0] outline-none placeholder:text-[#4D5560] focus:border-[#3A4250]"
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] tracking-[0.12em] text-[#8A909B]">
            <input
              type="checkbox"
              checked={false}
              disabled
              className="h-4 w-4 border border-[#282C34] bg-[#101216]"
            />
            REVIEW-REQUIRED FLAG IS NOT SUPPORTED BY THE DEPLOYED CONTRACT
          </label>
          {networkNotice ? (
            <div className="border border-[#E0A04A]/30 bg-[#1d170d] px-3 py-2 text-[11px] tracking-[0.08em] text-[#E0A04A]">
              {networkNotice}
            </div>
          ) : null}
          {writeDisabledReason ? (
            <div className="border border-[#282C34] bg-[#101216] px-3 py-2 text-[11px] tracking-[0.08em] text-[#8A909B]">
              {writeDisabledReason}
            </div>
          ) : null}
          {error ? (
            <div className="border border-[#FF5A1F]/40 bg-[#1c1107] px-3 py-2 text-[11px] tracking-[0.08em] text-[#FF5A1F]">
              {error}
            </div>
          ) : null}
          {txHash ? (
            <div className="flex flex-wrap items-center gap-2 border border-[#6E9E7C]/30 bg-[#111b15] px-3 py-2 text-[11px] tracking-[0.08em] text-[#6E9E7C]">
              <span>TX {shortAddress(txHash, { head: 10, tail: 6 })}</span>
              {getArcscanTxUrl(txHash) ? (
                <a
                  href={getArcscanTxUrl(txHash) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#8A909B] hover:text-[#D7DBE0]"
                >
                  OPEN IN ARCSCAN
                </a>
              ) : null}
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex h-9 items-center justify-center border border-[#282C34] text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={(event) => onAdd(event)}
              disabled={saving || Boolean(writeDisabledReason)}
              className="flex h-9 items-center justify-center border border-[#3A4250] bg-[#2A2E35] text-[11px] tracking-[0.12em] text-[#EDF0F3] hover:border-[#FF5A1F] hover:text-[#FF5A1F] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? "CONFIRMING..." : "ADD / UPDATE VENDOR"}
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function VendorDetailsModal({
  onClose,
  selectedWalletAddress,
  vendor,
}: Readonly<{
  onClose: () => void;
  selectedWalletAddress: string;
  vendor: VendorDisplay;
}>) {
  const [, name, address, category, approvedBy, confidential, used, meta] = vendor;
  const arcscanAddressUrl = getArcscanAddressUrl(address);
  const status = meta?.status ?? (confidential ? "confidential" : "approved");
  const linkedWallet = meta?.walletAddress || selectedWalletAddress;
  const createdAt = meta?.createdAt ?? "N/A";
  const lastUsed = meta?.lastUsed ?? used ?? "Never used";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const copyVendorAddress = async () => {
    await navigator.clipboard.writeText(address);
    toast.success("VENDOR ADDRESS COPIED", { description: name });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close vendor details"
        className="fixed inset-0 z-50 bg-[#0a0b0e]/70"
        onClick={onClose}
      />
      <section className="fixed right-4 top-4 z-[60] flex max-h-[calc(100vh-32px)] w-[520px] max-w-[calc(100vw-32px)] flex-col border border-[#282C34] bg-[#181B21] shadow-[0_0_60px_rgba(0,0,0,0.65)]">
        <div className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
          <div>
            <div className="text-[11px] tracking-[0.18em] text-[#D7DBE0]">VENDOR DETAILS</div>
            <div className="mt-1 text-[10px] tracking-[0.12em] text-[#5B626C]">
              {linkedWallet && isEvmAddress(linkedWallet)
                ? `WALLET ${shortAddress(linkedWallet)}`
                : "WALLET SCOPE UNAVAILABLE"}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close vendor details"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <X className="h-4 w-4" strokeWidth={iconStroke} />
          </button>
        </div>
        <div className="min-h-0 space-y-4 overflow-y-auto p-5 text-[12px] text-[#8A909B]">
          <div className="border border-[#282C34] bg-[#15181D] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-[16px] font-semibold tracking-[0.04em] text-[#EDF0F3]">
                  {name}
                </div>
                <div className="mt-2 flex min-w-0 items-center gap-2 font-mono text-[11px] text-[#8A909B]">
                  <span className="min-w-0 truncate" title={address}>
                    {address}
                  </span>
                  <button
                    type="button"
                    aria-label="Copy vendor address"
                    onClick={() => void copyVendorAddress()}
                    className="shrink-0 text-[#8A909B] hover:text-[#D7DBE0]"
                  >
                    <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                  </button>
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 border px-2 py-1 text-[10px] tracking-[0.12em]",
                  status === "blocked"
                    ? "border-[#FF5A1F]/40 text-[#FF5A1F]"
                    : "border-[#6E9E7C]/30 text-[#6E9E7C]",
                )}
              >
                {status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <VendorDetailField label="CATEGORY" value={category} />
            <VendorDetailField
              label="CONFIDENTIALITY"
              value={confidential ? "ArcaneVM shielded" : "Public"}
            />
            <VendorDetailField
              label="LINKED WALLET"
              value={
                linkedWallet && isEvmAddress(linkedWallet) ? shortAddress(linkedWallet) : "N/A"
              }
            />
            <VendorDetailField label="CREATED" value={createdAt} />
            <VendorDetailField label="LAST USED" value={lastUsed} />
            <VendorDetailField
              label="APPROVED BY"
              value={approvedBy.length > 0 ? approvedBy.join(", ") : "Owner-managed"}
            />
          </div>

          <div className="border border-[#282C34] bg-[#101216] p-4">
            <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">POLICY CONTEXT</div>
            <div className="mt-3 grid gap-2 text-[11px] leading-relaxed">
              <div className="flex items-center justify-between gap-3">
                <span>Vendor allowlist</span>
                <span className="text-[#D7DBE0]">Controlled by wallet doctrine</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Per-vendor cap</span>
                <span className="text-[#D7DBE0]">
                  {confidential ? "Configured / shielded" : "Not set in read model"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Review state</span>
                <span className="text-[#D7DBE0]">Owner-managed</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {arcscanAddressUrl ? (
              <a
                href={arcscanAddressUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 items-center gap-1.5 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#D7DBE0] hover:text-[#D7DBE0]"
              >
                OPEN IN ARCSCAN <ExternalLink className="h-3 w-3" strokeWidth={iconStroke} />
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 items-center justify-center border border-[#3A4250] px-3 text-[10px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
            >
              CLOSE
            </button>
          </div>
        </div>
      </section>
    </>
  );
}

function VendorDetailField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border border-[#282C34] bg-[#101216] p-3">
      <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">{label}</div>
      <div className="mt-1 min-h-5 break-words text-[12px] text-[#D7DBE0]">{value || "N/A"}</div>
    </div>
  );
}

function VendorRow({
  menuOpen,
  onBlockVendor,
  onEditVendor,
  onMenuOpenChange,
  onRemoveVendor,
  onViewDetails,
  vendor,
}: Readonly<{
  menuOpen: boolean;
  onBlockVendor: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onEditVendor: () => void;
  onMenuOpenChange: (open: boolean) => void;
  onRemoveVendor: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onViewDetails: () => void;
  vendor: VendorDisplay;
}>) {
  const [initials, name, address, category, approvedBy, confidential, used, meta] = vendor;
  const avatarColors: Record<string, string> = { AC: "#2A2E35", RK: "#3A2A1E", JM: "#1E2A2E" };
  const menuRef = useRef<HTMLDivElement | null>(null);
  const arcscanAddressUrl = getArcscanAddressUrl(address);
  const fullAddressAvailable = isEvmAddress(address);
  const blocked = meta?.status === "blocked";

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        onMenuOpenChange(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onMenuOpenChange(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen, onMenuOpenChange]);

  const copyVendorAddress = async () => {
    await navigator.clipboard.writeText(address);
    toast.success("VENDOR ADDRESS COPIED", {
      description: name,
    });
    onMenuOpenChange(false);
  };

  const showUnavailable = () => {
    toast.info("Vendor action unavailable", {
      description: fullAddressAvailable
        ? "Select the governed wallet owner before writing to VendorRegistry."
        : "A full vendor address is required for on-chain writes.",
    });
    onMenuOpenChange(false);
  };

  return (
    <RowShell
      className={cn(vendorGridClass, "relative items-center border-b border-[#1E222A] px-4 py-3")}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#282C34] bg-[#15171B] text-[10px] font-bold text-[#D7DBE0]">
          {initials}
        </span>
        <span className="min-w-0 truncate text-[13px] text-[#EDF0F3]" title={name}>
          {name}
        </span>
      </div>
      <div className="flex min-w-0 items-center gap-1.5 pr-3 font-mono text-[11px] text-[#8A909B]">
        <span className="min-w-0 truncate" title={address}>
          {address}
        </span>
        <CopyIcon />
      </div>
      <div className="min-w-0 pr-3">
        <CategoryTick category={String(category)} label={String(category)} />
      </div>
      <div className="flex min-w-0 items-center overflow-hidden pr-3">
        {approvedBy.map((person, index) => (
          <span
            key={person}
            className={cn(
              "flex h-5 min-w-0 items-center justify-center truncate border border-[#181B21] text-[9px] font-bold text-[#D7DBE0]",
              person.length <= 3 ? "w-5" : "max-w-[96px] px-1.5",
            )}
            style={{
              background: avatarColors[person] ?? "#2A2E35",
              marginLeft: index && person.length <= 3 ? -6 : 0,
            }}
            title={person}
          >
            {person}
          </span>
        ))}
      </div>
      <div className="min-w-0 pr-3">
        {confidential ? (
          <span className="inline-flex max-w-full items-center gap-1.5 truncate border border-[#282C34] bg-[#15171B] px-2 py-0.5 text-[10px] tracking-[0.08em] text-[#8A909B]">
            <Lock className="h-3 w-3" strokeWidth={iconStroke} /> ARCANEVM
          </span>
        ) : (
          <span className="text-[10px] tracking-[0.08em] text-[#5B626C]">PUBLIC</span>
        )}
      </div>
      <span className="min-w-0 truncate pr-3 text-[11px] text-[#5B626C]" title={used}>
        {used}
      </span>
      <div
        ref={menuRef}
        className="relative flex justify-end"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={`Open actions for ${name}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onMenuOpenChange(!menuOpen);
          }}
          className="flex h-6 w-6 cursor-pointer items-center justify-center text-[#5B626C] hover:text-[#D7DBE0]"
        >
          <EllipsisVertical className="h-3.5 w-3.5" strokeWidth={iconStroke} />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-7 z-50 w-[244px] border border-[#282C34] bg-[#111419] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)]"
            onPointerDown={(event) => event.stopPropagation()}
          >
            <VendorMenuButton
              onClick={() => {
                onViewDetails();
                onMenuOpenChange(false);
              }}
            >
              VIEW VENDOR DETAILS
            </VendorMenuButton>
            <VendorMenuButton onClick={() => void copyVendorAddress()}>
              COPY VENDOR ADDRESS
            </VendorMenuButton>
            {arcscanAddressUrl ? (
              <a
                role="menuitem"
                href={arcscanAddressUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-8 cursor-pointer items-center justify-between px-2 text-left text-[10px] tracking-[0.12em] text-[#8A909B] hover:bg-[#181B21] hover:text-[#D7DBE0]"
                onClick={(event) => {
                  event.stopPropagation();
                  onMenuOpenChange(false);
                }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                VIEW ON ARCSCAN
                <ExternalLink className="h-3 w-3" strokeWidth={iconStroke} />
              </a>
            ) : (
              <VendorMenuButton muted onClick={showUnavailable}>
                VIEW ON ARCSCAN - NO FULL ADDRESS
              </VendorMenuButton>
            )}
            <div className="my-1 border-t border-[#282C34]" />
            <VendorMenuButton
              muted={!fullAddressAvailable}
              onClick={() => {
                onEditVendor();
                onMenuOpenChange(false);
              }}
            >
              {blocked ? "ALLOW / UPDATE VENDOR" : "UPDATE CATEGORY / CAP"}
            </VendorMenuButton>
            <VendorMenuButton danger muted={!fullAddressAvailable} onClick={onBlockVendor}>
              BLOCK VENDOR
            </VendorMenuButton>
            <VendorMenuButton danger muted={!fullAddressAvailable} onClick={onRemoveVendor}>
              REMOVE FROM REGISTRY
            </VendorMenuButton>
            <div className="mt-1 border border-[#282C34] bg-[#0F1115] px-2 py-1.5 font-body text-[11px] leading-snug text-[#6F7682]">
              {blocked
                ? "This vendor is blocked in the indexed read model."
                : "Writes require the governed wallet owner and Arc Testnet."}
            </div>
          </div>
        ) : null}
      </div>
    </RowShell>
  );
}

function VendorMenuButton({
  children,
  danger,
  muted,
  onClick,
}: Readonly<{
  children: ReactNode;
  danger?: boolean;
  muted?: boolean;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}>) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
      onPointerDown={(event) => event.stopPropagation()}
      className={cn(
        "flex h-8 w-full cursor-pointer items-center px-2 text-left text-[10px] tracking-[0.12em] hover:bg-[#181B21]",
        danger
          ? "text-[#FF5A1F] hover:text-[#FF7A45]"
          : muted
            ? "text-[#6F7682] hover:text-[#D7DBE0]"
            : "text-[#8A909B] hover:text-[#D7DBE0]",
      )}
    >
      {children}
    </button>
  );
}

export function LedgerCanvasPage() {
  const workspace = useWorkspaceMode();
  const liveLedger = useLiveLedger();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [ledgerQuery, setLedgerQuery] = useState("");
  const [selectedRow, setSelectedRow] = useState<LedgerDisplay | null>(null);
  const [flaggedVendors, setFlaggedVendors] = useState<ReadonlySet<string>>(() => new Set());
  const canShowDemoWorkspace = workspace.isDemo;
  const baseRows: readonly LedgerDisplay[] = useMemo(
    () =>
      liveLedger.data.length > 0
        ? liveLedger.data.map(ledgerRowFromLive)
        : canShowDemoWorkspace
          ? (ledgerRows as readonly LedgerDisplay[])
          : [],
    [liveLedger.data, canShowDemoWorkspace],
  );
  const rows = useMemo(() => {
    const query = normalizeSearch(ledgerQuery);
    return baseRows.filter((row) => {
      const statusMatches = statusFilter === "ALL" || row[5] === statusFilter;
      const queryMatches = matchesSearch(query, row);
      return statusMatches && queryMatches;
    });
  }, [baseRows, ledgerQuery, statusFilter]);
  const ledgerFiltersActive = ledgerQuery.trim() !== "" || statusFilter !== "ALL";
  const resetLedgerFilters = () => {
    setLedgerQuery("");
    setStatusFilter("ALL");
  };
  const ledgerTotal = baseRows.reduce(
    (sum, row) => sum + Number(String(row[4]).replace(/[$,]/g, "")),
    0,
  );
  const ledgerCounts = useMemo(
    () => ({
      APPROVED: baseRows.filter((row) => row[5] === "APPROVED").length,
      ESCALATED: baseRows.filter((row) => row[5] === "ESCALATED").length,
      FROZEN: baseRows.filter((row) => row[5] === "FROZEN").length,
      REJECTED: baseRows.filter((row) => row[5] === "REJECTED").length,
    }),
    [baseRows],
  );
  const emptyLedger = getWorkspaceEmptyCopy(workspace.dataMode, "ledger");

  useEffect(() => {
    if (!selectedRow) {
      return undefined;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedRow(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedRow]);

  const flagVendor = (counterparty: string) => {
    setFlaggedVendors((previous) => {
      const next = new Set(previous);
      next.add(counterparty);
      return next;
    });
    toast.success(`${counterparty} FLAGGED / review marker added for this session`);
  };

  return (
    <GovernanceFrame
      active="ledger"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / LEDGER`}
      relative
      showRange={false}
    >
      <Main>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,300px)_1fr]">
          <div className="border border-[#282C34] bg-[#181B21] p-5">
            <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">
              TOTAL VALUE / LAST 24H
            </div>
            <div className="mt-2 font-cond text-[40px] font-semibold leading-none text-[#EDF0F3]">
              ${ledgerTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })}
            </div>
            <div className="mt-3 flex items-center gap-3 text-[10px] tracking-[0.08em] text-[#5B626C]">
              <span className="flex items-center gap-1 text-[#6E9E7C]">
                <Check className="h-3 w-3" strokeWidth={iconStroke} />
                {ledgerCounts.APPROVED} APPROVED
              </span>
              <span className="flex items-center gap-1 text-[#FF5A1F]">
                <X className="h-3 w-3" strokeWidth={iconStroke} />
                {ledgerCounts.REJECTED} REJECTED
              </span>
              <span className="flex items-center gap-1 text-[#E0A04A]">
                <TriangleAlert className="h-3 w-3" strokeWidth={iconStroke} />
                {ledgerCounts.ESCALATED} ESC
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center border border-[#282C34] bg-[#181B21] px-5 py-4">
            <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.08em]">
              <span className="text-[10px] tracking-[0.18em] text-[#5B626C]">STATUS</span>
              {(
                [
                  ["ALL", Check],
                  ["APPROVED", Check],
                  ["REJECTED", X],
                  ["ESCALATED", TriangleAlert],
                  ["FROZEN", Snowflake],
                ] as const
              ).map(([label, Icon]) => {
                const TypedIcon = Icon as typeof Check;
                const selected = statusFilter === label;
                return (
                  <button
                    key={String(label)}
                    type="button"
                    onClick={() => setStatusFilter(label)}
                    className={cn(
                      "flex items-center gap-1.5 border px-2.5 py-1",
                      selected
                        ? "border-[#3A4250] bg-[#1B1F26] text-[#6E9E7C]"
                        : "border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]",
                    )}
                  >
                    <TypedIcon className="h-3 w-3" strokeWidth={iconStroke} /> {label}
                  </button>
                );
              })}
              <span className="mx-1 h-5 w-px bg-[#282C34]" />
              <label className="flex h-7 min-w-[200px] flex-1 items-center gap-1.5 border border-[#282C34] bg-[#101216] px-2.5 py-1 text-[#8A909B] sm:flex-none">
                <Search className="h-3 w-3" strokeWidth={iconStroke} />
                <input
                  value={ledgerQuery}
                  onChange={(event) => setLedgerQuery(event.target.value)}
                  placeholder="filter ledger rows..."
                  className="min-w-0 flex-1 bg-transparent text-[11px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
                />
              </label>
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    canShowDemoWorkspace
                      ? "LEDGER WINDOW / Demo data is limited to the visible 24h set"
                      : "LEDGER WINDOW / Live read model is limited to the visible 24h set",
                  )
                }
                className="flex items-center gap-1.5 border border-[#282C34] px-2.5 py-1 text-[#8A909B] hover:text-[#D7DBE0]"
              >
                <Calendar className="h-3 w-3" strokeWidth={iconStroke} /> LAST 24H
              </button>
            </div>
          </div>
        </div>

        <div className="border border-[#282C34] bg-[#181B21]">
          <PanelHeader
            title="GOVERNED LEDGER"
            meta={`${baseRows.length} TRANSACTIONS / 24H WINDOW`}
          />
          <div className="overflow-x-auto">
            <div className="min-w-[860px]">
              <div className="grid grid-cols-[110px_minmax(150px,1fr)_minmax(150px,1fr)_120px_120px_120px] items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.13em] text-[#5B626C]">
                <span>TIME</span>
                <span>AGENT</span>
                <span>COUNTERPARTY</span>
                <span>CATEGORY</span>
                <span className="text-right">AMOUNT</span>
                <span className="text-right">STATUS</span>
              </div>
              <div className="max-h-[560px] overflow-y-auto text-[12px]">
                {liveLedger.isError && baseRows.length === 0 ? (
                  <ErrorState
                    cause="ledger query failed"
                    onRetry={() => void liveLedger.refetch()}
                  />
                ) : rows.length > 0 ? (
                  rows.map((row) => (
                    <LedgerRow key={ledgerRowKey(row)} row={row} onOpen={setSelectedRow} />
                  ))
                ) : ledgerFiltersActive && baseRows.length > 0 ? (
                  <EmptyState
                    actionLabel={ledgerQuery.trim() ? "CLEAR SEARCH" : "RESET FILTERS"}
                    description="No events match the current search and status filters."
                    onAction={resetLedgerFilters}
                    title="NO LEDGER EVENTS MATCH THIS FILTER"
                  />
                ) : (
                  <EmptyState description={emptyLedger.description} title={emptyLedger.title} />
                )}
              </div>
              <div className="flex h-9 items-center justify-between border-t border-[#282C34] px-4 text-[10px] tracking-[0.14em] text-[#5B626C]">
                <span>
                  SHOWING {rows.length} / {baseRows.length}
                </span>
                <span>CLICK ROW FOR FULL DECISION RECORD</span>
              </div>
            </div>
          </div>
        </div>
      </Main>
      {selectedRow ? (
        <DecisionDrawer
          flagged={flaggedVendors.has(selectedRow[2])}
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onFlag={() => flagVendor(selectedRow[2])}
        />
      ) : null}
    </GovernanceFrame>
  );
}

function LedgerRow({
  row,
  onOpen,
}: Readonly<{ row: LedgerDisplay; onOpen: (row: LedgerDisplay) => void }>) {
  const [time, agent, counterparty, category, amount, status] = row;
  const danger = status === "REJECTED";

  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={cn(
        "grid w-full cursor-pointer grid-cols-[110px_minmax(150px,1fr)_minmax(150px,1fr)_120px_120px_120px] items-center border-b border-[#1E222A] px-4 py-2.5 text-left hover:bg-[#1b1f26]",
        danger && "bg-[#1a1207]",
      )}
    >
      <span className="text-[#5B626C]">{time}</span>
      <span className="text-[#EDF0F3]">{agent}</span>
      <span className={danger ? "text-[#FF5A1F]" : "text-[#D7DBE0]"}>{counterparty}</span>
      <CategoryTick category={category} label={category === "SUB" ? "SUBCON" : category} />
      <span className="text-right text-[#D7DBE0]">{amount}</span>
      <StatusLabel status={status} align="right" />
    </button>
  );
}

function DecisionDrawer({
  flagged,
  row,
  onClose,
  onFlag,
}: Readonly<{ flagged: boolean; row: LedgerDisplay; onClose: () => void; onFlag: () => void }>) {
  const [time, agent, counterparty, category, amount, status, txHash] = row;
  const explorerUrl = getArcscanTxUrl(txHash);
  const openExplorer = () => {
    if (!explorerUrl) {
      toast.info("ARCSCAN UNAVAILABLE / this row has no transaction hash");
      return;
    }

    window.open(explorerUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close decision record"
        className="fixed inset-0 z-40 bg-[#0a0b0e]/70"
        onClick={onClose}
      />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-[480px] max-w-full flex-col border-l border-[#FF5A1F]/40 bg-[#15171B] shadow-[0_0_60px_rgba(0,0,0,0.7)] sm:max-w-[calc(100vw-16px)]"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.18em] text-[#8A909B]">
            <span className="flex h-5 w-5 items-center justify-center bg-[#FF5A1F]/15 text-[#FF5A1F]">
              <X className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            </span>
            DECISION RECORD
          </div>
          <button
            type="button"
            aria-label="Close decision record"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <X className="h-4 w-4" strokeWidth={iconStroke} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-20">
          <div className="border-b border-[#282C34] bg-[#1a1207] p-5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 border border-[#FF5A1F]/50 px-2 py-0.5 text-[10px] tracking-[0.12em] text-[#FF5A1F]">
                <X className="h-3 w-3" strokeWidth={iconStroke} />
                {status} BY DOCTRINE
              </span>
              <span className="text-[10px] tracking-[0.1em] text-[#5B626C]">{time}Z UTC</span>
            </div>
            <div className="mt-4 flex items-end gap-2">
              <span className="font-cond text-[52px] font-semibold leading-[0.8] text-[#EDF0F3]">
                {amount}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px] text-[#FF5A1F]">
              <span
                className="h-3.5 w-1"
                style={{ background: categoryColors[category] ?? "#8E7CC0" }}
              />
              {category} - <span className="underline decoration-dotted">{counterparty}</span>
            </div>
          </div>
          <div className="space-y-0 text-[12px]">
            <div className="grid grid-cols-2 gap-px bg-[#282C34]">
              <DrawerMetric label="AGENT" value={agent} />
              <DrawerMetric label="BLOCK HEIGHT" value={txHash ? "LIVE INDEXED" : "NO TX HASH"} />
              <DrawerMetric label="GAS USED" value={txHash ? "INDEXED" : "N/A"} />
              <DrawerMetric
                label="STATUS"
                value={status}
                hazard={status === "REJECTED" || status === "FROZEN"}
              />
            </div>
            <div className="border-t border-[#282C34] p-5">
              <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">TX HASH</div>
              <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2 border border-[#282C34] bg-[#101216] px-3 py-2 text-[11px] text-[#8A909B]">
                <span className="min-w-0 truncate">
                  {txHash ?? "No tx hash available for this row"}
                </span>
                <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              </div>
            </div>
            <div className="border-t border-[#282C34] p-5">
              <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">POLICY DECISION</div>
              <div className="mt-2 border-l-2 border-[#FF5A1F] bg-[#1a1207] px-3 py-2.5 text-[12px] leading-relaxed text-[#D7DBE0]">
                Counterparty <span className="text-[#FF5A1F]">{counterparty}</span> produced a{" "}
                <span className="text-[#D7DBE0]">{status}</span> decision for {agent}.{" "}
                {flagged
                  ? "Vendor is marked for local review."
                  : "Open Arcscan when a live transaction hash is available, or flag the vendor for review."}
              </div>
            </div>
            <div className="border-t border-[#282C34] p-5">
              <div className="flex items-center justify-between">
                <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">RAW CALLDATA</div>
                <span className="text-[10px] text-[#5B626C]">312 BYTES</span>
              </div>
              <pre className="mt-2 max-h-[88px] overflow-hidden border border-[#282C34] bg-[#101216] p-3 text-[10px] leading-relaxed text-[#6E9E7C]">{`0xa9059cbb000000000000000000000000
ev1ldatabr0ker00000000000000000000
00000000000000000000000000000002e5
1f0a00000000000000000000000000...`}</pre>
            </div>
          </div>
        </div>
        <div className="shrink-0 border-t border-[#282C34] bg-[#16181D] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openExplorer}
              className={cn(
                "flex h-9 flex-1 items-center justify-center gap-2 border text-[11px] tracking-[0.1em]",
                explorerUrl
                  ? "border-[#282C34] text-[#8A909B] hover:text-[#D7DBE0]"
                  : "cursor-not-allowed border-[#282C34] text-[#5B626C]",
              )}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              {explorerUrl ? "ARCSCAN" : "NO TX HASH"}
            </button>
            <button
              type="button"
              onClick={onFlag}
              disabled={flagged}
              className="flex h-9 flex-1 items-center justify-center gap-2 border border-[#FF5A1F]/50 text-[11px] tracking-[0.1em] text-[#FF5A1F] hover:bg-[#1c1107] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Flag className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              {flagged ? "FLAGGED" : "FLAG VENDOR"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function DrawerMetric({
  label,
  value,
  hazard,
}: Readonly<{ label: string; value: string; hazard?: boolean }>) {
  return (
    <div className="bg-[#15171B] p-4">
      <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">{label}</div>
      <div className={cn("mt-1", hazard ? "text-[#FF5A1F]" : "text-[#D7DBE0]")}>{value}</div>
    </div>
  );
}

export function EscalationsCanvasPage() {
  const workspace = useWorkspaceMode();
  const liveEscalations = useLiveEscalations("PENDING");
  const [escalationQuery, setEscalationQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortNewest, setSortNewest] = useState(false);
  const canShowDemoWorkspace = workspace.isDemo;
  const baseRows: readonly EscalationDisplay[] = useMemo(
    () =>
      liveEscalations.data.length > 0
        ? liveEscalations.data.map(escalationRowFromLive)
        : canShowDemoWorkspace
          ? escalations
          : [],
    [liveEscalations.data, canShowDemoWorkspace],
  );
  const emptyEscalations = getWorkspaceEmptyCopy(workspace.dataMode, "escalations");
  const agentOptions = useMemo(
    () => Array.from(new Set(baseRows.map((row) => row[0]))),
    [baseRows],
  );
  const categoryOptions = useMemo(
    () => Array.from(new Set(baseRows.map((row) => row[4]))),
    [baseRows],
  );
  const rows = useMemo(() => {
    const query = normalizeSearch(escalationQuery);
    const filtered = baseRows.filter((row) => {
      const agentMatches = agentFilter === "ALL" || row[0] === agentFilter;
      const categoryMatches = categoryFilter === "ALL" || row[4] === categoryFilter;
      const rowStatus = row[7]
        ? "CRITICAL"
        : String(row[8]).startsWith("1")
          ? "SIGNED"
          : "UNSIGNED";
      const statusMatches = statusFilter === "ALL" || rowStatus === statusFilter;
      const queryMatches = matchesSearch(query, row);
      return agentMatches && categoryMatches && statusMatches && queryMatches;
    });

    return sortNewest ? [...filtered].reverse() : filtered;
  }, [agentFilter, baseRows, categoryFilter, escalationQuery, sortNewest, statusFilter]);
  const filtersActive =
    escalationQuery.trim() !== "" ||
    agentFilter !== "ALL" ||
    categoryFilter !== "ALL" ||
    statusFilter !== "ALL";
  const resetEscalationFilters = () => {
    setEscalationQuery("");
    setAgentFilter("ALL");
    setCategoryFilter("ALL");
    setStatusFilter("ALL");
  };

  return (
    <GovernanceFrame
      active="escalations"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / ESCALATIONS`}
      bellCount={4}
      escalationCount={4}
      showRange={false}
    >
      <Main>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-cond text-[24px] font-bold tracking-[0.04em] text-[#EDF0F3]">
                RESTRAINT QUEUE
              </h1>
              <span className="bg-[#FF5A1F] px-2 py-0.5 text-[11px] font-bold text-[#121419]">
                {rows.length.toString().padStart(2, "0")} /{" "}
                {baseRows.length.toString().padStart(2, "0")} PENDING
              </span>
            </div>
            <p className="mt-1 text-[12px] text-[#8A909B]">
              Transactions held for human approval. Quorum required before release.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] tracking-[0.1em]">
            <label className="flex h-8 min-w-[210px] flex-1 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[#5B626C] sm:flex-none">
              <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              <input
                value={escalationQuery}
                onChange={(event) => setEscalationQuery(event.target.value)}
                placeholder="search queue..."
                className="min-w-0 flex-1 bg-transparent text-[11px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
              />
            </label>
            <button
              type="button"
              onClick={() => setSortNewest((value) => !value)}
              className="cursor-pointer border border-[#282C34] px-3 py-1.5 text-[#8A909B] hover:text-[#D7DBE0]"
            >
              SORT / {sortNewest ? "NEWEST" : "EXPIRY"}
            </button>
            <label className="flex items-center border border-[#282C34] px-2 py-1.5 text-[#8A909B]">
              <select
                value={agentFilter}
                onChange={(event) => setAgentFilter(event.target.value)}
                className="cursor-pointer bg-transparent text-[11px] outline-none"
              >
                <option value="ALL">ALL AGENTS</option>
                {agentOptions.map((agent) => (
                  <option key={agent} value={agent}>
                    {agent}
                  </option>
                ))}
              </select>
              <ChevronDown className="ml-1 inline h-3 w-3" strokeWidth={iconStroke} />
            </label>
            <label className="flex items-center border border-[#282C34] px-2 py-1.5 text-[#8A909B]">
              <select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                className="cursor-pointer bg-transparent text-[11px] outline-none"
              >
                <option value="ALL">ALL CATEGORIES</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <ChevronDown className="ml-1 inline h-3 w-3" strokeWidth={iconStroke} />
            </label>
            <label className="flex items-center border border-[#282C34] px-2 py-1.5 text-[#8A909B]">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="cursor-pointer bg-transparent text-[11px] outline-none"
              >
                <option value="ALL">ALL STATES</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="SIGNED">SIGNED</option>
                <option value="UNSIGNED">UNSIGNED</option>
              </select>
              <ChevronDown className="ml-1 inline h-3 w-3" strokeWidth={iconStroke} />
            </label>
          </div>
        </div>
        <div className="space-y-3">
          {liveEscalations.isError && baseRows.length === 0 ? (
            <ErrorState
              cause="escalation query failed"
              onRetry={() => void liveEscalations.refetch()}
            />
          ) : rows.length > 0 ? (
            rows.map((item) => <EscalationCard key={escalationRowKey(item)} item={item} />)
          ) : filtersActive && baseRows.length > 0 ? (
            <EmptyState
              actionLabel={escalationQuery.trim() ? "CLEAR SEARCH" : "RESET FILTERS"}
              description="No escalations match this filter. Try a different term or reset filters."
              onAction={resetEscalationFilters}
              title="NO ESCALATIONS MATCH THIS FILTER"
            />
          ) : (
            <EmptyState description={emptyEscalations.description} title={emptyEscalations.title} />
          )}
        </div>
      </Main>
    </GovernanceFrame>
  );
}

function EscalationCard({ item }: Readonly<{ item: EscalationDisplay }>) {
  const [
    agent,
    wallet,
    amount,
    counterparty,
    category,
    reason,
    expires,
    danger,
    quorum,
    deviation,
    txHash = fallbackEscalationHash,
  ] = item;
  const qfill = String(quorum).startsWith("1") ? 50 : 0;
  const countdown = useCountdownState(String(expires));
  const countdownRisk = danger || countdown.isSoon || countdown.isExpired;

  return (
    <div className="flex border border-[#FF5A1F]/30 bg-[#181B21]">
      <HazardStripe />
      <div className="grid min-w-0 flex-1 grid-cols-1 items-stretch divide-y divide-[#282C34] xl:grid-cols-[minmax(220px,1fr)_minmax(280px,1.4fr)_300px] xl:divide-x xl:divide-y-0">
        <div className="flex flex-col justify-center p-5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center border border-[#282C34] bg-[#15171B] text-[11px] font-bold text-[#D7DBE0]">
              {String(agent).slice(0, 2)}
            </span>
            <div>
              <div className="text-[13px] text-[#EDF0F3]">{agent}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[#5B626C]">
                {wallet}
                <Copy className="h-3 w-3" strokeWidth={iconStroke} />
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="font-cond text-[40px] font-semibold leading-[0.8] text-[#EDF0F3]">
              {amount}
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-[#8A909B]">
              <span
                className="border border-[#282C34] px-1.5 py-0.5 text-[10px] tracking-[0.08em]"
                style={{ color: categoryColors[String(category)] }}
              >
                {category}
              </span>
              - {counterparty}
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center p-5">
          <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">HELD BECAUSE</div>
          <p className="mt-2 text-[12.5px] leading-relaxed text-[#D7DBE0]">{reason}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-[#282C34] pt-3 text-[10px] tracking-[0.1em] text-[#5B626C]">
            <div>
              DEVIATION<div className="mt-0.5 text-[13px] text-[#D7DBE0]">{deviation}</div>
            </div>
            <div>
              QUORUM
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 w-16 bg-[#20242B]">
                  <div className="h-full bg-[#6E9E7C]" style={{ width: `${qfill}%` }} />
                </div>
                <span className="text-[12px] text-[#D7DBE0]">{quorum}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-3 p-5">
          <div className="text-center">
            <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">EXPIRES IN</div>
            <div
              className="mt-1 font-cond text-[30px] font-semibold leading-none"
              style={{ color: countdownRisk ? "#EC7A6B" : "#D7DBE0" }}
            >
              {countdown.label}
            </div>
            {countdown.isExpired ? (
              <div className="mt-1 text-[9px] tracking-[0.14em] text-[#FF5A1F]">
                EXPIRED - RELEASE DISABLED
              </div>
            ) : countdown.isMissing ? (
              <div className="mt-1 text-[9px] tracking-[0.14em] text-[#8A909B]">NO EXPIRY</div>
            ) : countdown.isSoon || danger ? (
              <div className="mt-1 text-[9px] tracking-[0.14em] text-[#EC7A6B]">
                CRITICAL - UNDER 5 MIN
              </div>
            ) : null}
          </div>
          <EscalationResolutionActions
            amount={amount}
            buttonClassName="h-11"
            counterparty={counterparty}
            expiresAt={String(expires)}
            txHash={txHash}
          />
          <Link
            href={`/approve/${txHash}`}
            className="flex h-8 items-center justify-center gap-2 border border-[#282C34] text-[10px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            APPROVER PORTAL
          </Link>
        </div>
      </div>
    </div>
  );
}

export function AnomaliesCanvasPage() {
  const workspace = useWorkspaceMode();
  const liveAnomalies = useLiveAnomalies();
  const canShowDemoWorkspace = workspace.isDemo;
  const rows: readonly AnomalyDisplay[] = useMemo(
    () =>
      liveAnomalies.data.length > 0
        ? liveAnomalies.data.map(anomalyRowFromLive)
        : canShowDemoWorkspace
          ? anomalyRows
          : [],
    [liveAnomalies.data, canShowDemoWorkspace],
  );
  const emptyAnomalies = getWorkspaceEmptyCopy(workspace.dataMode, "anomalies");
  const criticalAnomalies = rows.filter((row) => row.severity === "CRITICAL").length;
  const elevatedAnomalies = rows.filter((row) => row.severity !== "CRITICAL").length;
  const peakScore = rows[0]?.score.replace("deviation", "").trim() ?? "0.0";

  return (
    <GovernanceFrame
      active="anomalies"
      file={`${workspaceFileRoot(workspace)} / GOVERNANCE / ANOMALIES`}
      escalationCount={4}
      showRange={false}
    >
      <Main>
        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,400px)_1fr]">
          <div className="relative border border-[#282C34] bg-[#181B21] p-6">
            <CornerMarks />
            <div className="text-[10px] tracking-[0.28em] text-[#5B626C]">DEVIATION INDEX</div>
            <div className="mt-1 flex items-end gap-4">
              <span className="font-cond text-[112px] font-bold leading-[0.74] text-[#FF5A1F]">
                {peakScore}
              </span>
              <div className="mb-2">
                <div className="text-[15px] font-semibold tracking-[0.06em] text-[#FF5A1F]">
                  {criticalAnomalies > 0 ? "CRITICAL" : "NOMINAL"}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[11px] text-[#8A909B]">
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} /> PEAK DEVIATION /
                  24H
                </div>
              </div>
            </div>
            <Gauge value={93} marker={38} label="DEVIATION SCALE" min="0" max="8" hazard />
            <div className="mt-7 border-t border-[#282C34] pt-3 text-[11px] leading-relaxed text-[#8A909B]">
              {rows.length} active deviations across fleet.{" "}
              <span className="text-[#FF5A1F]">
                {criticalAnomalies > 0
                  ? `${criticalAnomalies} critical deviation indexed.`
                  : "No critical anomalies indexed."}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <StatTile
              label="CRITICAL"
              value={String(criticalAnomalies).padStart(2, "0")}
              valueClassName="text-[#FF5A1F]"
              caption={<span className="text-[#E0A04A]">5.0+ deviation</span>}
              accent
            />
            <StatTile
              label="ELEVATED"
              value={String(elevatedAnomalies).padStart(2, "0")}
              valueClassName="text-[#E0A04A]"
              caption="1.0-5.0 deviation"
            />
            <StatTile label="RESOLVED / 30D" value={canShowDemoWorkspace ? "86" : "00"}>
              <div className="mt-2 flex items-center gap-1 text-[10px] tracking-[0.08em] text-[#6E9E7C]">
                <Check className="h-3 w-3" strokeWidth={iconStroke} />
                NEUTRALIZED
              </div>
            </StatTile>
          </div>
        </section>

        <div className="border border-[#282C34] bg-[#181B21]">
          <PanelHeader title="ANOMALY REGISTER" meta={`${rows.length} ACTIVE DEVIATIONS`} />
          <div>
            {liveAnomalies.isError && rows.length === 0 ? (
              <ErrorState
                cause="anomaly query failed"
                onRetry={() => void liveAnomalies.refetch()}
              />
            ) : rows.length > 0 ? (
              rows.map((row) => <AnomalyRow key={anomalyRowKey(row)} row={row} />)
            ) : (
              <EmptyState description={emptyAnomalies.description} title={emptyAnomalies.title} />
            )}
          </div>
        </div>
      </Main>
    </GovernanceFrame>
  );
}

function AnomalyRow({ row }: Readonly<{ row: AnomalyDisplay }>) {
  const [state, setState] = useState<"idle" | "restrained" | "dismissed">("idle");
  const utils = trpc.useUtils();
  const acknowledge = trpc.anomalies.acknowledge.useMutation();
  const dismiss = trpc.anomalies.dismiss.useMutation();

  const settleAnomalyRemote = async (
    next: "restrained" | "dismissed",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    const action = next === "dismissed" ? "anomalies.dismiss" : "anomalies.acknowledge";
    if (!allowTrustedMutation(action, event)) {
      return;
    }

    setState(next);
    try {
      const anomalyId = row.id ?? fallbackAnomalyId;
      if (next === "dismissed") {
        await dismiss.mutateAsync({ anomalyId });
      } else {
        await acknowledge.mutateAsync({ anomalyId });
      }

      await utils.anomalies.list.invalidate();
      toast.success(
        next === "dismissed"
          ? `${row.agent} DISMISSED / anomaly archived`
          : `${row.agent} FROZEN / anomaly restraint active`,
      );
    } catch {
      setState("idle");
      toast.error(`${row.agent} ACTION FAILED / CONNECT WALLET`);
    }
  };

  return (
    <div
      className={cn(
        "flex border-b border-[#1E222A]",
        row.severity === "CRITICAL" && "bg-[#1a1207]",
        state !== "idle" && "opacity-60",
      )}
    >
      <div className="w-1" style={{ background: row.color }} />
      <div className="flex flex-1 items-center gap-5 px-5 py-4">
        <div className="w-[150px] shrink-0">
          <div className="text-[13px] text-[#EDF0F3]">{row.agent}</div>
          <div className="mt-0.5 text-[10px] tracking-[0.08em] text-[#5B626C]">{row.time}</div>
          {row.frozen ? (
            <div className="mt-2 inline-flex items-center gap-1 border border-[#FF5A1F]/50 px-1.5 py-0.5 text-[9px] tracking-[0.12em] text-[#FF5A1F]">
              <Snowflake className="h-3 w-3" strokeWidth={iconStroke} />
              FROZEN
            </div>
          ) : (
            <div className="mt-2 inline-flex items-center gap-1 px-0 py-0.5 text-[9px] tracking-[0.12em] text-[#E0A04A]">
              <Eye className="h-3 w-3" strokeWidth={iconStroke} />
              WATCH
            </div>
          )}
        </div>
        <div className="w-[78px] shrink-0 text-center">
          <div
            className="font-cond text-[34px] font-bold leading-none"
            style={{ color: row.color }}
          >
            {row.score}
          </div>
          <div className="mt-1 text-[9px] tracking-[0.14em]" style={{ color: row.color }}>
            {row.severity}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] leading-relaxed text-[#D7DBE0]">{row.narrative}</p>
          <div className="mt-3 flex items-center gap-3">
            <Sparkline points={row.points} flag={row.flag} color={row.color} />
            <span className="text-[10px] tracking-[0.1em] text-[#5B626C]">
              FLAGGED EVENT / {row.points[row.flag] ?? 0}x BASELINE
            </span>
          </div>
        </div>
        <div className="flex w-[150px] shrink-0 flex-col gap-2">
          <button
            type="button"
            disabled={state !== "idle"}
            onClick={(event) => void settleAnomalyRemote("restrained", event)}
            className="flex h-8 items-center justify-center gap-1.5 border border-[#FF5A1F]/50 text-[10px] tracking-[0.1em] text-[#FF5A1F] hover:bg-[#1c1107] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Snowflake className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            {state === "restrained" ? "RESTRAINED" : "RESTRAIN"}
          </button>
          <button
            type="button"
            onClick={() => toast.info(`${row.agent} INVESTIGATION / local timeline focused`)}
            className="flex h-8 items-center justify-center gap-1.5 border border-[#282C34] text-[10px] tracking-[0.1em] text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            INVESTIGATE
          </button>
          <button
            type="button"
            disabled={state !== "idle"}
            onClick={(event) => void settleAnomalyRemote("dismissed", event)}
            className="flex h-8 items-center justify-center gap-1.5 text-[10px] tracking-[0.1em] text-[#5B626C] hover:text-[#8A909B] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <X className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            {state === "dismissed" ? "DISMISSED" : "DISMISS"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sparkline({
  points,
  flag,
  color,
}: Readonly<{ points: readonly number[]; flag: number; color: string }>) {
  const width = 180;
  const height = 40;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const x = (index: number) => index * (width / Math.max(points.length - 1, 1));
  const y = (value: number) => height - 2 - ((value - min) / (max - min || 1)) * (height - 6);
  const d = points
    .map((value, index) => `${index ? "L" : "M"}${x(index).toFixed(1)},${y(value).toFixed(1)}`)
    .join(" ");
  const fx = x(flag);
  const fy = y(points[flag] ?? points[0] ?? 0);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={d} fill="none" stroke="#3A4250" strokeWidth="1.5" />
      <circle cx={fx} cy={fy} r="3" fill={color} />
      <line
        x1={fx}
        y1="0"
        x2={fx}
        y2={height}
        stroke={color}
        strokeWidth="1"
        strokeDasharray="2 2"
        opacity="0.5"
      />
    </svg>
  );
}

export function ApprovalCanvasPage() {
  const reduced = useReducedMotion();
  const params = useParams();
  const txHash = routeParamString(params.txHash);
  const approvalQuery = trpc.escalations.byTxHash.useQuery(
    { txHash: txHash as `0x${string}` },
    {
      enabled: isTxHashValue(txHash),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const approvalExpiry =
    approvalQuery.data?.expiresAt !== undefined && approvalQuery.data?.expiresAt !== null
      ? new Date(approvalQuery.data.expiresAt).toISOString()
      : null;
  const approvalAmount =
    approvalQuery.data?.amount !== undefined
      ? amountLabel(Number(approvalQuery.data.amount) / 1_000_000)
      : "NO DATA";
  const approvalCounterparty = approvalQuery.data?.toAddress
    ? shortAddress(approvalQuery.data.toAddress)
    : "NO INDEXED ESCALATION";
  const approvalWallet = approvalQuery.data?.walletId ?? "UNKNOWN";
  const approvalReason =
    approvalQuery.data?.reason ?? "No indexed escalation was found for this id.";
  const approvalQuorum = approvalQuery.data
    ? `${approvalQuery.data.signaturesCount} / ${approvalQuery.data.threshold}`
    : "N/A";
  const approvalState = approvalQuery.data
    ? `STATE / ${approvalQuery.data.status}`
    : approvalQuery.isLoading
      ? "STATE / LOADING"
      : "STATE / NOT INDEXED";

  return (
    <MotionDiv
      className="relative flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-foundry-grid px-4 py-20 font-mono text-[#D7DBE0] lg:flex-row lg:gap-10 lg:px-8 lg:py-12"
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      <Link
        href="/escalations"
        className="absolute left-4 top-4 flex h-9 cursor-pointer items-center gap-2 border border-[#282C34] bg-[#15171B] px-3 text-[10px] tracking-[0.14em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0] sm:left-8 sm:top-8"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={iconStroke} />
        BACK TO ESCALATIONS
      </Link>
      <ApprovalCard
        amount={approvalAmount}
        counterparty={approvalCounterparty}
        disabledReason={approvalQuery.data ? null : "No indexed escalation found for this id."}
        expiresAt={approvalExpiry}
        quorum={approvalQuorum}
        reason={approvalReason}
        state={approvalState}
        txHash={txHash}
        wallet={approvalWallet}
      />
      <SignedCard />
    </MotionDiv>
  );
}

function ApprovalCard({
  amount,
  counterparty,
  disabledReason,
  expiresAt,
  quorum,
  reason,
  state,
  txHash,
  wallet,
}: Readonly<{
  amount: string;
  counterparty: string;
  disabledReason?: string | null;
  expiresAt: string | null | undefined;
  quorum: string;
  reason: string;
  state: string;
  txHash?: string;
  wallet: string;
}>) {
  const countdown = useCountdownState(expiresAt);

  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <div className="mb-2 text-center text-[10px] tracking-[0.22em] text-[#5B626C]">{state}</div>
      <div className="border border-[#282C34] bg-[#15171B] px-7 py-8">
        <PublicLogo />
        <div className="mt-7 text-center">
          <div className="text-[10px] tracking-[0.24em] text-[#5B626C]">RELEASE REQUEST</div>
          <div className="mt-2 font-cond text-[72px] font-bold leading-[0.8] text-[#EDF0F3]">
            {amount}
          </div>
          <div className="mt-3 inline-flex items-center gap-2 text-[12px] text-[#8A909B]">
            <span className="h-3 w-1 bg-[#3FA89B]" />
            {counterparty}
          </div>
        </div>
        <div className="mt-7 divide-y divide-[#282C34] border-y border-[#282C34] text-[12px]">
          <InfoLine label="AGENT" value="AUTHORIZED SIGNER" />
          <InfoLine label="WALLET" value={wallet} muted />
          <InfoLine label="QUORUM" value={quorum} />
        </div>
        <div className="mt-4 border-l-2 border-[#FF5A1F] bg-[#1a1207] px-3 py-2.5 text-[11px] leading-relaxed text-[#D7DBE0]">
          {reason}
        </div>
        <div className="mt-4 flex items-center justify-between border border-[#282C34] bg-[#101216] px-3 py-2">
          <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">EXPIRES IN</span>
          <span
            className={cn(
              "font-cond text-[24px] font-semibold leading-none text-[#D7DBE0]",
              countdown.isSoon && "text-[#EC7A6B]",
              countdown.isExpired && "text-[#FF5A1F]",
              countdown.isMissing && "text-[#8A909B]",
            )}
          >
            {countdown.label}
          </span>
        </div>
        <EscalationResolutionActions
          amount={amount}
          buttonClassName="h-[64px] text-[15px] font-bold"
          counterparty={counterparty}
          disabledReason={disabledReason}
          expiresAt={expiresAt}
          txHash={txHash}
        />
        <div className="mt-4 text-center text-[10px] tracking-[0.1em] text-[#5B626C]">
          Approve or reject with an authorized approver wallet.
        </div>
      </div>
    </div>
  );
}

function SignedCard() {
  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <div className="mb-2 text-center text-[10px] tracking-[0.22em] text-[#5B626C]">
        STATE / SIGNED
      </div>
      <div className="border border-[#6E9E7C]/40 bg-[#15171B] px-7 py-8">
        <PublicLogo />
        <div className="mt-10 flex flex-col items-center">
          <span className="flex h-16 w-16 items-center justify-center border-2 border-[#6E9E7C] text-[#6E9E7C]">
            <Check className="h-8 w-8" strokeWidth={iconStroke} />
          </span>
          <div className="mt-6 font-cond text-[26px] font-bold leading-tight tracking-[0.04em] text-[#EDF0F3]">
            RELEASED
          </div>
          <div className="mt-2 text-center text-[12px] leading-relaxed text-[#8A909B]">
            Your signature is recorded.
            <br />
            Awaiting <span className="text-[#E0A04A]">1 more signature</span> to execute.
          </div>
        </div>
        <div className="mt-8">
          <div className="flex items-center justify-between text-[10px] tracking-[0.16em] text-[#5B626C]">
            <span>QUORUM</span>
            <span>1 OF 2</span>
          </div>
          <div className="mt-2 flex gap-1.5">
            <div className="h-2 flex-1 bg-[#6E9E7C]" />
            <div className="h-2 flex-1 bg-[#282C34]" />
          </div>
        </div>
        <div className="mt-8 divide-y divide-[#282C34] border-y border-[#282C34] text-[12px]">
          <InfoLine label="AMOUNT" value="$73.42" />
          <InfoLine label="SIGNED AT" value="02:51:44Z UTC" muted />
          <InfoLine label="SIGNER" value="0x9f4e...3B7" muted />
        </div>
        <button
          type="button"
          onClick={() => toast.info("ARCSCAN / public badge demo has no live transaction hash")}
          className="mt-7 flex h-11 w-full items-center justify-center gap-2 border border-[#282C34] text-[12px] tracking-[0.12em] text-[#8A909B] hover:text-[#D7DBE0]"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={iconStroke} />
          VIEW ON ARCSCAN
        </button>
      </div>
    </div>
  );
}

function PublicLogo() {
  return (
    <div className="flex items-center justify-center gap-2">
      <img src="/brand/arcanum-mark.png" alt="Arcanum" className="h-6 w-6 object-contain" />
      <span className="font-cond text-[16px] font-bold tracking-[0.18em] text-[#EDF0F3]">
        ARCANUM
      </span>
    </div>
  );
}

function InfoLine({
  label,
  value,
  muted,
}: Readonly<{ label: string; value: ReactNode; muted?: boolean }>) {
  return (
    <div className="flex items-center justify-between py-3">
      <span className="text-[#5B626C]">{label}</span>
      <span className={muted ? "text-[#8A909B]" : "text-[#EDF0F3]"}>{value}</span>
    </div>
  );
}

export function PublicExplorerCanvasPage({
  wallet = sampleAgentWallet,
}: Readonly<{ wallet?: string }>) {
  const reduced = useReducedMotion();
  const profileQuery = trpc.wallets.publicProfile.useQuery(
    { address: wallet as Address },
    {
      enabled: isViemAddress(wallet),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const profile = profileQuery.data;
  const walletLabel = wallet.startsWith("0x") ? shortAddress(wallet, { tail: 6 }) : wallet;
  const badgeHref = `/badge/${encodeURIComponent(wallet)}`;
  const postureScore = profile?.postureScore ?? null;
  const hasPublicProfile = Boolean(profile);
  const explorerTone = postureScore !== null && postureScore < 50 ? "bad" : "good";
  const profileLabel = profile?.label?.toUpperCase() ?? "UNKNOWN WALLET";
  const profileStatus = profile?.state ?? "NO PUBLIC PROFILE";
  const profileGrade =
    postureScore === null ? "NA" : postureScore < 50 ? "D" : postureScore < 75 ? "B" : "A";
  const profileSpend = profile?.spend ?? (hasPublicProfile ? "PENDING INDEXER" : "NO DATA");
  const profileBlocked =
    profile?.threatsBlocked === null || profile?.threatsBlocked === undefined
      ? hasPublicProfile
        ? "PENDING"
        : "0"
      : String(profile.threatsBlocked);
  const profileDays =
    profile?.governedDays === null || profile?.governedDays === undefined
      ? hasPublicProfile
        ? "PENDING"
        : "0"
      : String(profile.governedDays);

  const copyExplorerWallet = async () => {
    await navigator.clipboard.writeText(wallet);
    toast.success("WALLET ADDRESS COPIED", {
      description: walletLabel,
    });
  };

  return (
    <MotionDiv
      className="min-h-screen w-full bg-[linear-gradient(0deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_38px),linear-gradient(90deg,rgba(255,255,255,0.015)_0_1px,transparent_1px_38px)] bg-[#0F1115] px-3 py-4 font-mono text-[#D7DBE0] sm:px-8 sm:py-8"
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      <div className="mx-auto max-w-[1300px]">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border border-[#282C34] bg-[#15171B] px-4 py-2">
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2.5 hover:text-[#EDF0F3]"
          >
            <PublicLogo />
            <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">/ PUBLIC EXPLORER</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agents"
              className="flex h-8 cursor-pointer items-center gap-2 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              BACK TO AGENTS
            </Link>
            <button
              type="button"
              onClick={() => void copyExplorerWallet()}
              className="flex h-8 cursor-pointer items-center gap-2 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              COPY WALLET
            </button>
            <Link
              href={badgeHref}
              className="flex h-8 cursor-pointer items-center gap-2 border border-[#3A4250] px-3 text-[10px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
            >
              VIEW BADGE
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            </Link>
          </div>
        </header>
        <section className="mt-6 border border-[#282C34] bg-[#15171B] px-6 py-5">
          <div className="text-[10px] tracking-[0.24em] text-[#FF5A1F]">
            PUBLIC GOVERNANCE PROFILE
          </div>
          <div className="mt-2 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8">
            <div>
              <h1 className="font-cond text-[34px] font-bold tracking-[0.04em] text-[#EDF0F3]">
                Arcanum wallet explorer
              </h1>
              <p className="mt-2 max-w-[760px] font-body text-[13px] leading-relaxed text-[#8A909B]">
                Shareable wallet posture, restraints, and badge context for governed agent wallets.
                Public explorer pages stay read-only and use the current public/local read model
                when a live indexer row is not available.
              </p>
            </div>
            <div className="border border-[#282C34] bg-[#101216] px-4 py-3">
              <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">FOCUSED WALLET</div>
              <div className="mt-1 font-mono text-[13px] text-[#D7DBE0]">{walletLabel}</div>
              <div className="mt-2 text-[11px] leading-relaxed text-[#6F7682]">
                Open in console for private doctrine editing and operational controls.
              </div>
            </div>
          </div>
        </section>
        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          <ExplorerCard
            agent={profileLabel}
            blocked={profileBlocked}
            days={profileDays}
            dataSource={profile?.dataSource ?? "none"}
            grade={profileGrade}
            hasProfile={hasPublicProfile}
            spend={profileSpend}
            status={profileStatus}
            tone={explorerTone}
            wallet={walletLabel}
          />
          <div className="border border-[#282C34] bg-[#15171B] p-5">
            <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">DATA SCOPE</div>
            <div className="mt-3 text-[12px] leading-relaxed text-[#8A909B]">
              This public page is scoped only to the requested wallet. If Supabase has no public
              profile for this address, Arcanum shows an honest empty public state instead of
              borrowing demo metrics from another governed wallet.
            </div>
            <div className="mt-4 border border-[#282C34] bg-[#101216] p-3 text-[10px] tracking-[0.12em] text-[#5B626C]">
              READ MODEL:{" "}
              <span className="text-[#D7DBE0]">
                {profileQuery.isLoading
                  ? "LOADING"
                  : (profile?.dataSource ?? "NO PUBLIC PROFILE").toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </MotionDiv>
  );
}

function ExplorerCard({
  tone,
  agent,
  wallet,
  spend,
  blocked,
  days,
  grade,
  hasProfile = true,
  dataSource,
  status,
}: Readonly<{
  tone: "good" | "bad";
  agent: string;
  wallet: string;
  spend: string;
  blocked: string;
  days: string;
  grade: string;
  hasProfile?: boolean;
  dataSource?: string;
  status: string;
}>) {
  const good = tone === "good";
  const accent = good ? "#6E9E7C" : "#FF5A1F";

  return (
    <div className={cn("border bg-[#15171B]", good ? "border-[#282C34]" : "border-[#FF5A1F]/30")}>
      <div
        className="relative flex flex-col items-center border-b border-[#282C34] px-7 py-8"
        style={{
          background: `radial-gradient(circle at 50% 0%,${good ? "rgba(110,158,124,0.14)" : "rgba(255,90,31,0.14)"},transparent 60%)`,
        }}
      >
        <div
          className="inline-flex items-center gap-2 border px-3 py-1.5 text-[11px] tracking-[0.16em]"
          style={{ borderColor: `${accent}66`, background: `${accent}1A`, color: accent }}
        >
          {good ? (
            <ShieldCheck className="h-4 w-4" strokeWidth={iconStroke} />
          ) : (
            <ShieldAlert className="h-4 w-4" strokeWidth={iconStroke} />
          )}
          GOVERNED BY ARCANUM
        </div>
        <div className="mt-4 text-[12px] text-[#8A909B]">{agent}</div>
        <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#5B626C]">
          {wallet} <Copy className="h-3 w-3" strokeWidth={iconStroke} />
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-y divide-[#282C34]">
        <ExplorerMetric label="TOTAL APPROVED SPEND" value={spend} />
        <ExplorerMetric label="THREATS BLOCKED" value={blocked} accent={!good} />
        <ExplorerMetric label="DAYS UNDER GOVERNANCE" value={days} />
        <div className="flex items-center justify-between p-5">
          <div>
            <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">HEALTH GRADE</div>
            <div className="mt-1 text-[10px]" style={{ color: accent }}>
              {status}
            </div>
          </div>
          <div className="font-cond text-[64px] font-bold leading-none" style={{ color: accent }}>
            {grade}
          </div>
        </div>
      </div>
      <div className="border-t border-[#282C34] p-5">
        <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">
          GOVERNANCE SUMMARY / READ ONLY
        </div>
        {!hasProfile ? (
          <div className="mt-3 border-l-2 border-[#3A4250] bg-[#101216] px-3 py-2.5 text-[11px] leading-relaxed text-[#D7DBE0]">
            No public Arcanum profile exists for this wallet yet. Create or index a governed wallet
            before sharing live posture metrics.
          </div>
        ) : good ? (
          <div className="mt-3 space-y-3">
            <PublicBudget label="API" category="API" amount="$612 / $1,500" width={41} />
            <PublicBudget label="COMPUTE" category="COMPUTE" amount="$338 / $900" width={38} />
            <PublicBudget label="DATA" category="DATA" amount="$220 / $700" width={31} />
          </div>
        ) : (
          <>
            <div className="mt-3 border-l-2 border-[#FF5A1F] bg-[#1a1207] px-3 py-2.5 text-[11px] leading-relaxed text-[#D7DBE0]">
              Wallet frozen 02:47Z after a 7.4 deviation event. 47 transactions to an unrecognized
              counterparty were denied automatically.
            </div>
            <div className="mt-3 space-y-3">
              <PublicBudget
                label="DATA"
                category="DATA"
                amount="$847 BLOCKED"
                width={96}
                color="#FF5A1F"
              />
              <PublicBudget
                label="API"
                category="API"
                amount="$312 / $400"
                width={78}
                color="#E0A04A"
              />
            </div>
          </>
        )}
        {dataSource ? (
          <div className="mt-3 text-[10px] tracking-[0.14em] text-[#5B626C]">
            SOURCE {dataSource.toUpperCase()}
          </div>
        ) : null}
      </div>
      <div className="border-t border-[#282C34] bg-[#101216] p-5">
        <div className="flex items-center justify-between text-[10px] tracking-[0.2em] text-[#5B626C]">
          EMBED THIS BADGE{" "}
          <button
            type="button"
            onClick={() => toast.success("BADGE EMBED COPIED / local snippet ready")}
            className="flex cursor-pointer items-center gap-1.5 border border-[#282C34] px-2 py-1 text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <Copy className="h-3 w-3" strokeWidth={iconStroke} />
            COPY
          </button>
        </div>
        <pre className="mt-2 overflow-hidden border border-[#282C34] bg-[#0c0d10] p-3 text-[10px] leading-relaxed text-[#6E9E7C]">{`<a href="https://thearcanum.in/explorer/${wallet}">
  <iframe src="https://thearcanum.in/badge/${wallet}" title="Arcanum governance badge"></iframe>
</a>`}</pre>
      </div>
    </div>
  );
}

function ExplorerMetric({
  label,
  value,
  accent,
}: Readonly<{ label: string; value: string; accent?: boolean }>) {
  return (
    <div className="relative p-5">
      {accent ? <div className="absolute inset-y-0 left-0 w-[3px] bg-[#FF5A1F]" /> : null}
      <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "mt-2 font-cond text-[30px] font-semibold text-[#EDF0F3]",
          accent && "text-[#FF5A1F]",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function PublicBudget({
  label,
  category,
  amount,
  width,
  color,
}: Readonly<{ label: string; category: string; amount: string; width: number; color?: string }>) {
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-[#8A909B]">
          <span className="h-3 w-1" style={{ background: categoryColors[category] }} />
          {label}
        </span>
        <span className={color === "#FF5A1F" ? "text-[#FF5A1F]" : "text-[#D7DBE0]"}>{amount}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-[#20242B]">
        <div className="h-full" style={{ width: `${width}%`, background: color ?? "#3A4250" }} />
      </div>
    </div>
  );
}

const docsNavItems = [
  {
    id: "deploy",
    label: "Deploy a GuardedWallet",
    group: "QUICKSTART",
    keywords: "wallet deploy create signer Arc Testnet event indexer empty state",
  },
  {
    id: "author-doctrine",
    label: "Author a Doctrine",
    group: "QUICKSTART",
    keywords: "policy caps vendor category quorum anomaly threshold allowlist",
  },
  {
    id: "first-restraint",
    label: "First Restraint",
    group: "QUICKSTART",
    keywords: "release deny escalation approver portal signatures quorum",
  },
  {
    id: "sdk",
    label: "SDK",
    group: "REFERENCE",
    keywords: "npm install client typescript rpc setup",
  },
  {
    id: "contracts",
    label: "Contracts",
    group: "REFERENCE",
    keywords:
      "WalletFactory PolicyEngine EscalationManager AnomalyOracle VendorRegistry USDC obsolete implementation",
  },
  {
    id: "api-reference",
    label: "API Reference",
    group: "REFERENCE",
    keywords: "read models mutations trpc click only indexed pending request storm",
  },
  {
    id: "examples",
    label: "Examples",
    group: "REFERENCE",
    keywords: "allowlist ledger badge explorer share normal escalated transaction",
  },
  {
    id: "glossary",
    label: "Glossary",
    group: "REFERENCE",
    keywords: "agent vendor indexer Arcscan approver restraint definitions",
  },
] as const;

type DocsSectionId = (typeof docsNavItems)[number]["id"];

export function DocsCanvasPage() {
  const reduced = useReducedMotion();
  const [activeSection, setActiveSection] = useState<DocsSectionId>("deploy");
  const [docsSearch, setDocsSearch] = useState("");
  const visibleDocsItems = useMemo(() => {
    const query = docsSearch.trim().toLowerCase();
    if (!query) {
      return docsNavItems;
    }

    return docsNavItems.filter(
      (item) =>
        item.label.toLowerCase().includes(query) ||
        item.group.toLowerCase().includes(query) ||
        item.keywords.toLowerCase().includes(query),
    );
  }, [docsSearch]);
  const visibleDocsIds = useMemo(
    () => new Set<DocsSectionId>(visibleDocsItems.map((item) => item.id)),
    [visibleDocsItems],
  );
  const activeItem = docsNavItems.find((item) => item.id === activeSection) ?? docsNavItems[0];

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (docsNavItems.some((item) => item.id === hash)) {
      setActiveSection(hash as DocsSectionId);
      window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView());
    }
  }, []);

  const openDocsSection = (sectionId: DocsSectionId) => {
    setActiveSection(sectionId);
    window.history.replaceState(null, "", `/docs#${sectionId}`);
    window.requestAnimationFrame(() =>
      document.getElementById(sectionId)?.scrollIntoView({ block: "start", behavior: "smooth" }),
    );
  };

  const openFirstSearchResult = () => {
    const first = visibleDocsItems[0];
    if (first) {
      openDocsSection(first.id);
    }
  };

  return (
    <MotionDiv
      className="flex min-h-screen w-full flex-col overflow-hidden bg-[#121419] font-mono text-[#D7DBE0] lg:h-screen lg:flex-row"
      variants={reduced ? undefined : enterRise}
      initial={reduced ? false : "hidden"}
      animate={reduced ? undefined : "show"}
    >
      <aside className="flex max-h-[45vh] w-full shrink-0 flex-col overflow-hidden border-b border-[#282C34] bg-[#16181D] lg:sticky lg:top-0 lg:h-screen lg:max-h-none lg:w-[268px] lg:border-b-0 lg:border-r">
        <div className="flex h-[52px] items-center gap-2.5 border-b border-[#282C34] px-5">
          <Link href="/dashboard" className="flex items-center gap-2.5 hover:text-[#EDF0F3]">
            <img src="/brand/arcanum-mark.png" alt="Arcanum" className="h-5 w-5 object-contain" />
            <span className="font-cond text-[16px] font-bold tracking-[0.16em] text-[#EDF0F3]">
              ARCANUM
            </span>
          </Link>
          <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">/ DOCS</span>
        </div>
        <div className="flex h-9 items-center gap-2 border-b border-[#282C34] px-4 text-[#5B626C]">
          <Search className="h-3.5 w-3.5" strokeWidth={iconStroke} />
          <input
            value={docsSearch}
            onChange={(event) => setDocsSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                openFirstSearchResult();
              }
            }}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-[#D7DBE0] outline-none placeholder:text-[#5B626C]"
            placeholder="search docs..."
            type="search"
          />
          <span className="ml-auto border border-[#282C34] px-1.5 text-[10px]">ENTER</span>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 text-[12px]">
          <Link
            href="/dashboard"
            className="mb-4 flex h-8 items-center gap-2 border border-[#282C34] px-3 text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            BACK TO DASHBOARD
          </Link>
          <DocGroup label="QUICKSTART" />
          <button
            type="button"
            onClick={() => openDocsSection("deploy")}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left",
              !visibleDocsIds.has("deploy") && "hidden",
              activeSection === "deploy"
                ? "relative border-l-2 border-[#FF5A1F] bg-[#1B1F26] text-[#EDF0F3]"
                : "text-[#8A909B] hover:text-[#D7DBE0]",
            )}
          >
            Deploy a GuardedWallet
          </button>
          <button
            type="button"
            onClick={() => openDocsSection("author-doctrine")}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left",
              !visibleDocsIds.has("author-doctrine") && "hidden",
              activeSection === "author-doctrine"
                ? "relative border-l-2 border-[#FF5A1F] bg-[#1B1F26] text-[#EDF0F3]"
                : "text-[#8A909B] hover:text-[#D7DBE0]",
            )}
          >
            Author a Doctrine
          </button>
          <button
            type="button"
            onClick={() => openDocsSection("first-restraint")}
            className={cn(
              "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left",
              !visibleDocsIds.has("first-restraint") && "hidden",
              activeSection === "first-restraint"
                ? "relative border-l-2 border-[#FF5A1F] bg-[#1B1F26] text-[#EDF0F3]"
                : "text-[#8A909B] hover:text-[#D7DBE0]",
            )}
          >
            First Restraint
          </button>
          <DocGroup label="REFERENCE" />
          {docsNavItems
            .slice(3)
            .filter((item) => visibleDocsIds.has(item.id))
            .map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openDocsSection(item.id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 px-3 py-1.5 text-left",
                  activeSection === item.id
                    ? "relative border-l-2 border-[#FF5A1F] bg-[#1B1F26] text-[#EDF0F3]"
                    : "text-[#8A909B] hover:text-[#D7DBE0]",
                )}
              >
                {item.label}
              </button>
            ))}
          {visibleDocsItems.length === 0 ? (
            <div className="mt-3 border border-[#282C34] bg-[#101216] px-3 py-3 text-[11px] leading-relaxed text-[#8A909B]">
              No docs matched.
            </div>
          ) : null}
        </nav>
        <div className="border-t border-[#282C34] px-5 py-3 text-[10px] tracking-[0.12em] text-[#5B626C]">
          ARCANUM v0.9.2 / ARC-TESTNET
        </div>
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-[52px] shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[#282C34] bg-[#16181D] px-4 py-2 text-[11px] tracking-[0.12em] text-[#5B626C] sm:px-8">
          <span>
            DOCS / {activeItem.group} / {activeItem.label.toUpperCase()}
          </span>
          <a
            href="https://github.com/bunnyyxtan/ARCANUM"
            target="_blank"
            rel="noreferrer"
            className="flex cursor-pointer items-center gap-1.5 text-[#8A909B] hover:text-[#D7DBE0]"
          >
            <Github className="h-4 w-4" strokeWidth={iconStroke} />
            VIEW ON GITHUB
          </a>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <DocsArticle onOpenSection={openDocsSection} />
        </div>
      </main>
    </MotionDiv>
  );
}

function DocGroup({ label }: Readonly<{ label: string }>) {
  return (
    <div className="mb-1 mt-4 px-2 text-[10px] tracking-[0.18em] text-[#5B626C] first:mt-0">
      {label}
    </div>
  );
}

function DocsArticle({
  onOpenSection,
}: Readonly<{ onOpenSection: (sectionId: DocsSectionId) => void }>) {
  return (
    <div id="deploy" className="mx-auto max-w-[760px] scroll-mt-6 px-8 py-9">
      <div className="text-[10px] tracking-[0.24em] text-[#FF5A1F]">QUICKSTART</div>
      <h1 className="mt-2 font-cond text-[36px] font-bold leading-tight text-[#EDF0F3]">
        Deploy your first GuardedWallet
      </h1>
      <p className="mt-3 font-body text-[14px] leading-relaxed text-[#9AA1AC]">
        Stand up a governed agent wallet on Arc Testnet in five steps. Every transaction it attempts
        will be evaluated against a Doctrine before it can settle on-chain.
      </p>
      <DocBulletList
        items={[
          "A GuardedWallet is a real wallet owned by your signer, but spending is checked by policy before it is allowed through.",
          "Use it when an AI agent, automation, or team wallet needs budget limits, vendor rules, and human review for risky actions.",
          "Arc Testnet is the safe place to practice. You can connect a wallet, deploy, and inspect results without risking production funds.",
          "Live workspaces show indexed, pending, empty, or error states while the indexer catches up; labeled demo rows are only for the configured demo wallet.",
        ]}
      />
      <DocStep n="01" title="Install the SDK">
        Add the Arcanum SDK to your project. It ships with typed{" "}
        <span className="border border-[#282C34] bg-[#15171B] px-1.5 py-0.5 font-mono text-[11px] text-[#D7DBE0]">
          GuardedWallet
        </span>{" "}
        helpers and Arc Testnet chain config.
        <CodeBlock label="TERMINAL" lang="bash" code="npm install @arcanum/sdk" green />
      </DocStep>
      <DocStep n="02" title="Configure the signer">
        Point the client at Arc Testnet and supply an admin signer that will own the Doctrine. The
        signer is the account that pays gas and becomes the first operator. Keep private keys
        outside the browser; the console uses your connected wallet instead of asking for secrets.
      </DocStep>
      <DocStep n="03" title="Deploy the wallet with a Doctrine">
        Create a GuardedWallet through WalletFactory and attach spend limits, category caps, and an
        escalation quorum. The Doctrine is the wallet rulebook: it decides what can pass, what needs
        a reviewer, and what should be denied before funds move.
        <CodeBlock
          label="deploy.ts"
          lang="typescript"
          code={`import { WalletFactoryAbi } from "@arcanum/contracts";
import { parseUnits } from "viem";

const policy = {
  perTxCap: parseUnits("50", 6),
  daily24hCap: parseUnits("500", 6),
  monthlyRollingCap: parseUnits("5000", 6),
  allowedCategories: 0b11111n,
  escalationThreshold: parseUnits("100", 6),
  requireAllowlist: true,
};

const txHash = await walletClient.writeContract({
  address: process.env.NEXT_PUBLIC_WALLET_FACTORY as \`0x\${string}\`,
  abi: WalletFactoryAbi,
  functionName: "createWallet",
  args: [ownerAddress, "AgentBackend", policy, [agentSigner], council, 2],
});`}
        />
      </DocStep>
      <DocStep n="04" title="Fund the wallet">
        Transfer test USDC to the deployed address - it appears in the{" "}
        <span className="border border-[#282C34] bg-[#15171B] px-1.5 py-0.5 font-mono text-[11px] text-[#D7DBE0]">
          AGENT REGISTER
        </span>{" "}
        immediately.
      </DocStep>
      <DocStep n="05" title="Watch the Event Stream">
        Every attempted transaction now flows through the GOVERNED EVENT STREAM with an APPROVE /
        ESCALATE / DENY verdict. A normal transaction appears as approved. A risky transaction
        appears as a restraint and waits for release from the escalation workflow.
      </DocStep>
      <div className="mt-8 space-y-3">
        <DocNotice
          icon={
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[#FF5A1F]"
              strokeWidth={iconStroke}
            />
          }
          tone="#FF5A1F"
          title="RESTRAINT"
        >
          On-chain policy changes affect real testnet state. Test with small limits first.
        </DocNotice>
        <DocNotice
          icon={
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-[#E0A04A]"
              strokeWidth={iconStroke}
            />
          }
          tone="#E0A04A"
          title="WARNING"
        >
          A quorum of 1 disables multi-party approval. Use 2 or more for treasury wallets.
        </DocNotice>
        <DocNotice
          icon={
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5E7FB5]" strokeWidth={iconStroke} />
          }
          tone="#5E7FB5"
          title="INFO"
        >
          USDC token amounts are expressed in 6-decimal base units. The SDK exposes{" "}
          <span className="font-mono text-[11px] text-[#D7DBE0]">usdcErc20()</span> helpers.
        </DocNotice>
      </div>
      <DocReferenceSection id="author-doctrine" eyebrow="DOCTRINE" title="Author a Doctrine">
        <p>
          A Doctrine defines the spend caps, approved vendor categories, escalation quorum, and
          anomaly sensitivity that govern each wallet. Start with conservative limits, then adjust
          after the first testnet run.
        </p>
        <p>
          Think of a Doctrine like parental controls for an agent wallet. It does not make the agent
          smarter; it makes the wallet safer by checking each payment before it can leave.
        </p>
        <DocBulletList
          items={[
            "Daily cap: the most the wallet can spend in one day before activity is restrained.",
            "Per transaction cap: the largest single payment that can pass without escalation.",
            "Per vendor per day cap: a vendor-specific budget so one service cannot drain the wallet.",
            "Categories: labels like API, DATA, COMPUTE, SUBCONTRACT, and OTHER that help separate normal spend from unusual spend.",
            "Vendor allowlist: approved recipients. If a vendor is not allowed, the transaction should be held for review.",
            "Quorum: how many approvers must sign before a restrained transaction can be released.",
            "Anomaly threshold: how sensitive the system should be to weird behavior. Lower is stricter, higher is more tolerant.",
          ]}
        />
        <p>
          Safe starter settings are intentionally boring: small daily cap, smaller per-transaction
          cap, allow only the categories you actually use, and set quorum to 2 so one person cannot
          release a risky transfer alone.
        </p>
        <CodeBlock
          label="doctrine.ts"
          lang="typescript"
          code={`const doctrine = {
  dailyLimit: 500_000000n,
  perVendorLimit: 50_000000n,
  allowedCategories: ["API", "COMPUTE"],
  quorum: 2,
  anomalySigma: 5,
};`}
        />
      </DocReferenceSection>
      <DocReferenceSection id="first-restraint" eyebrow="WORKFLOW" title="First Restraint">
        <p>
          When a transaction exceeds policy, Arcanum records a restraint instead of claiming a fake
          approval. Review the escalation, collect signatures, then release or reject from the
          approver portal.
        </p>
        <DocBulletList
          items={[
            "A restraint is a pause, not a failure. It means the wallet needs a human decision before money moves.",
            "Release means the approvers agree the transaction is safe and let it continue.",
            "Deny means the approvers decide the transaction should not execute.",
            "Quorum shows how many signatures have been collected and how many are still needed.",
            "The approver portal is public/shareable for the specific request, so reviewers can open the release page directly.",
          ]}
        />
        <p>
          In the console, restrained transactions appear in Escalations. Open the row, inspect the
          vendor, amount, category, and reason, then use RELEASE or REJECT only when you mean to
          take that action.
        </p>
        <DocNotice
          icon={
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#5E7FB5]" strokeWidth={iconStroke} />
          }
          tone="#5E7FB5"
          title="DEMO / INDEXER STATE"
        >
          Demo rows are only available to the configured demo wallet. Live workspaces must show
          indexed, pending, empty, or error states instead of fake operational data.
        </DocNotice>
      </DocReferenceSection>
      <DocReferenceSection id="sdk" eyebrow="SDK" title="SDK">
        <p>
          Install the SDK with npm and point it at Arc Testnet. The current console does not require
          a GuardedWallet implementation address because WalletFactory deploys full wallet instances
          directly.
        </p>
        <DocBulletList
          items={[
            "Install with npm. This repository no longer requires pnpm for normal development.",
            "Configure the Arc Testnet RPC and contract addresses before sending transactions.",
            "Use the SDK for typed helpers and formatting; use the console when you want a visual operator workflow.",
            "Keep private keys out of committed files, screenshots, browser logs, and support messages.",
          ]}
        />
        <CodeBlock label="TERMINAL" lang="bash" code="npm install @arcanum/sdk" green />
        <CodeBlock
          label="client.ts"
          lang="typescript"
          code={`import { ArcanumClient } from "@arcanum/sdk";
import { ARC_TESTNET_RPC_URL, arcTestnet, usdcErc20 } from "@arcanum/sdk/chains";

const arcanum = new ArcanumClient({
  walletAddress,
  agentSigner,
  chain: arcTestnet,
  rpcUrl: process.env.ARC_TESTNET_RPC ?? ARC_TESTNET_RPC_URL,
});

const simulation = await arcanum.simulate({
  to: vendorAddress,
  amount: usdcErc20(12),
});`}
        />
      </DocReferenceSection>
      <DocReferenceSection id="contracts" eyebrow="CONTRACTS" title="Contracts">
        <p>
          Deployed Arc Testnet contracts are read from the frontend environment and the deployment
          artifact. Configure WalletFactory, PolicyEngine, EscalationManager, AnomalyOracle, and
          VendorRegistry before enabling on-chain wallet creation.
        </p>
        <DocBulletList
          items={[
            "WalletFactory creates full GuardedWallet instances. Users interact with it when creating a governed wallet.",
            "PolicyEngine evaluates spend limits, categories, vendor rules, and escalation requirements.",
            "EscalationManager tracks restrained transactions and release/reject decisions.",
            "AnomalyOracle supplies risk signals used by policy checks.",
            "VendorRegistry stores allowlisted counterparties once write actions are wired.",
            "NEXT_PUBLIC_GUARDED_WALLET_IMPL is obsolete and must not be used because there is no proxy implementation address.",
          ]}
        />
        <CodeBlock
          label="ARC TESTNET"
          lang="text"
          code={`WalletFactory      0x1Da7E51b537F9E6CF5bB308b3B2d6fdc5D9E4750
PolicyEngine       0x767C95C3E914d63bD26a5f1cDE4d6DA950462112
EscalationManager  0x6E03e0030fCeE242E2cCB77Da8D7C6c93a36A37E
AnomalyOracle      0x7A80C967A69E1d1a6bb2286089BB5945f3274cf4
VendorRegistry     0x4A4d419292F2E374421B45907861BBB5adA6eF82
USDC               0x3600000000000000000000000000000000000000`}
        />
      </DocReferenceSection>
      <DocReferenceSection id="api-reference" eyebrow="API" title="API Reference">
        <p>
          Local development reads through stable tRPC adapters for agents, vendors, ledger rows,
          escalations, anomalies, notifications, and organization state. Mutations are user-click
          only and should never run from render, hover, polling, or effects.
        </p>
        <DocBulletList
          items={[
            "Read models: dashboard, agents, vendors, ledger, escalations, anomalies, and notifications.",
            "Click-only actions: release, reject, flag vendor, add vendor, and create governed wallet.",
            "Local fallback: if a database, indexer, or session is unavailable, the console may show stable demo-safe rows instead of crashing.",
            "Pending integration: VendorRegistry writes and some policy writes still show honest disabled states until wired.",
            "Request storm rule: opening a route, hovering, focusing, or changing filters must never submit a mutation.",
          ]}
        />
      </DocReferenceSection>
      <DocReferenceSection id="examples" eyebrow="EXAMPLES" title="Examples">
        <p>
          Use the dashboard sample org to test the end-to-end loop: deploy readiness, vendor
          allowlisting, governed ledger decisions, escalation review, and public badge sharing.
        </p>
        <DocBulletList
          items={[
            "Deploy first governed wallet: open Agents, click Deploy Governed Wallet, connect to Arc Testnet, and submit createWallet once.",
            "Add a vendor allowlist entry: use Vendors to create a local row today; on-chain VendorRegistry writes are still pending.",
            "See a normal approved transaction: open Ledger and filter for approved/settled rows.",
            "See an escalated transaction: open Escalations, inspect the reason, then use the approver portal link for review.",
            "Share trust context: open an agent, then use Public Explorer or Badge links for read-only external sharing.",
          ]}
        />
      </DocReferenceSection>
      <DocReferenceSection id="glossary" eyebrow="GLOSSARY" title="Glossary">
        <p>
          GuardedWallet: an agent wallet governed by a Doctrine. Doctrine: policy rules evaluated
          before settlement. Restraint: a held transaction pending review. ArcaneVM: the
          confidential execution layer label used in the console.
        </p>
        <DocBulletList
          items={[
            "Agent: a wallet or automation identity that can request payments or operational actions.",
            "GuardedWallet: a wallet whose transactions are checked by Arcanum policy before they settle.",
            "Doctrine: the plain-language rulebook turned into machine-checkable spend policy.",
            "Vendor: a counterparty the wallet might pay, such as an API provider, cloud service, or contractor.",
            "Allowlist: the approved set of vendors or categories that can be used without extra review.",
            "Restraint: a paused transaction that requires a release or reject decision.",
            "Approver: a person or wallet allowed to sign release decisions.",
            "Indexer: the service that reads on-chain events and turns them into fast UI rows.",
            "Arcscan: the Arc Testnet explorer for checking transactions and contract addresses.",
          ]}
        />
      </DocReferenceSection>
      <div className="mt-8 flex items-center justify-between border-t border-[#282C34] pt-5 text-[12px]">
        <button
          type="button"
          onClick={() => onOpenSection("deploy")}
          className="flex cursor-pointer items-center gap-2 text-[#8A909B] hover:text-[#D7DBE0]"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={iconStroke} />
          Deploy a GuardedWallet
        </button>
        <button
          type="button"
          onClick={() => onOpenSection("author-doctrine")}
          className="flex cursor-pointer items-center gap-2 text-[#8A909B] hover:text-[#D7DBE0]"
        >
          Author a Doctrine
          <ArrowRight className="h-4 w-4" strokeWidth={iconStroke} />
        </button>
      </div>
    </div>
  );
}

function DocReferenceSection({
  id,
  eyebrow,
  title,
  children,
}: Readonly<{ id: DocsSectionId; eyebrow: string; title: string; children: ReactNode }>) {
  return (
    <section id={id} className="mt-10 scroll-mt-6 border-t border-[#282C34] pt-6">
      <div className="text-[10px] tracking-[0.24em] text-[#FF5A1F]">{eyebrow}</div>
      <h2 className="mt-2 font-cond text-[24px] font-bold leading-tight text-[#EDF0F3]">{title}</h2>
      <div className="mt-3 space-y-3 font-body text-[13px] leading-relaxed text-[#9AA1AC]">
        {children}
      </div>
    </section>
  );
}

function DocBulletList({ items }: Readonly<{ items: readonly string[] }>) {
  return (
    <ul className="mt-4 space-y-2 border border-[#282C34] bg-[#101216] p-3">
      {items.map((item, index) => (
        <li
          key={`${index}-${item}`}
          className="flex gap-2 font-body text-[12.5px] leading-relaxed text-[#9AA1AC]"
        >
          <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-[#FF5A1F]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DocStep({
  n,
  title,
  children,
}: Readonly<{ n: string; title: string; children: ReactNode }>) {
  return (
    <div className="mt-7 flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#282C34] bg-[#181B21] text-[12px] text-[#FF5A1F]">
        {n}
      </span>
      <div className="flex-1">
        <h3 className="text-[15px] text-[#EDF0F3]">{title}</h3>
        <div className="mt-1 font-body text-[13px] leading-relaxed text-[#9AA1AC]">{children}</div>
      </div>
    </div>
  );
}

function CodeBlock({
  label,
  lang,
  code,
  green,
}: Readonly<{ label: string; lang: string; code: string; green?: boolean }>) {
  return (
    <div className="mt-3 border border-[#282C34] bg-[#101216]">
      <div className="flex items-center justify-between border-b border-[#282C34] px-3 py-1.5 text-[10px] tracking-[0.12em] text-[#5B626C]">
        <span>{label}</span>
        <span className="border border-[#282C34] px-1.5 text-[#8A909B]">{lang}</span>
      </div>
      <pre
        className={cn(
          "overflow-x-auto px-3 py-2.5 text-[12px] leading-relaxed",
          green ? "text-[#6E9E7C]" : "text-[#D7DBE0]",
        )}
      >
        {code}
      </pre>
    </div>
  );
}

function DocNotice({
  icon,
  tone,
  title,
  children,
}: Readonly<{ icon: ReactNode; tone: string; title: string; children: ReactNode }>) {
  const bg = tone === "#FF5A1F" ? "#1a1207" : tone === "#E0A04A" ? "#1a1607" : "#0f1620";
  return (
    <div className="flex gap-3 border-l-2 px-4 py-3" style={{ borderColor: tone, background: bg }}>
      {icon}
      <div>
        <div className="text-[11px] tracking-[0.12em]" style={{ color: tone }}>
          {title}
        </div>
        <div className="mt-1 font-body text-[12.5px] leading-relaxed text-[#D7DBE0]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SettingsCanvasPage() {
  const liveMembers = useLiveMembers().data;
  const workspace = useWorkspaceMode();
  const [activeTab, setActiveTab] = useState("TEAM");
  const rows: readonly TeamDisplay[] = workspace.isDemo
    ? teamMembers
    : liveMembers.map(teamRowFromLiveMember);
  const workspaceSummary = getSettingsWorkspaceSummary(
    workspace.dataMode,
    workspace.isAuthenticated,
  );
  const memberCaption =
    rows.length > 0 ? "LIVE MEMBERS INDEXED" : "INVITE APPROVERS AFTER WALLET SETUP";

  return (
    <GovernanceFrame file={`${workspaceFileRoot(workspace)} / SETTINGS / TEAM`} showRange={false}>
      <Main>
        <div className="grid grid-cols-1 divide-y divide-[#282C34] border border-[#282C34] bg-[#181B21] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
          <SettingsStat
            label="ORGANIZATION"
            value={workspaceSummary.label}
            caption={workspaceSummary.caption}
          />
          <SettingsStat label="DEPLOYMENT" value="ARC TESTNET" caption="INDEXED READ MODEL" green />
          <SettingsStat
            label="MEMBERS"
            value={String(rows.length).padStart(2, "0")}
            caption={workspace.isDemo ? "DEMO PERSONAS" : memberCaption}
          />
          <SettingsStat
            label="GOVERNANCE MODE"
            value="OWNER-MANAGED"
            caption="POLICY-CONTROLLED WORKSPACE"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1 border-b border-[#282C34] text-[12px] tracking-[0.12em]">
          {["TEAM", "ORG", "INTEGRATIONS", "WEBHOOKS"].map((tab) => {
            const selected = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative shrink-0 px-4 py-2.5",
                  selected ? "text-[#EDF0F3]" : "text-[#5B626C] hover:text-[#8A909B]",
                )}
              >
                {tab}
                {selected ? (
                  <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#FF5A1F]" />
                ) : null}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-1 gap-2 text-[10px] tracking-[0.1em] text-[#5B626C] sm:grid-cols-2 xl:grid-cols-4">
          <SettingsHint icon={<Building2 />} text="ORG / logo + name fields" />
          <SettingsHint icon={<Plug />} text="INTEGRATIONS / Slack / Discord / Email" />
          <SettingsHint icon={<ShieldCheck />} text="SECURITY / roles + approvers" />
          <SettingsHint icon={<Webhook />} text="WEBHOOKS / endpoints + secret" />
        </div>
        <div className="border border-[#282C34] bg-[#181B21]">
          <div className="flex h-10 items-center justify-between border-b border-[#282C34] px-4">
            <span className="text-[11px] tracking-[0.22em] text-[#8A909B]">
              {workspace.isDemo ? "DEMO TEAM MEMBERS" : "TEAM MEMBERS"}
            </span>
            <button
              type="button"
              onClick={() =>
                toast.info(
                  "INVITE MEMBER / approver invitations are not enabled in this Arc Testnet deployment yet",
                )
              }
              className="flex h-8 items-center gap-2 border border-[#3A4250] px-3 text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
            >
              <UserPlus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              INVITE MEMBER
            </button>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[minmax(240px,1.6fr)_140px_minmax(160px,1fr)_60px] items-center border-b border-[#282C34] px-4 py-2 text-[10px] tracking-[0.13em] text-[#5B626C]">
                <span>MEMBER</span>
                <span>ROLE</span>
                <span>LAST ACTIVE</span>
                <span />
              </div>
              <div className="text-[12px]">
                {rows.length > 0 ? (
                  rows.map((member) => <TeamRow key={member[1]} member={member} />)
                ) : (
                  <EmptyState
                    description="Invite approvers after creating a governed wallet and defining the human review path."
                    title="No team members yet"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </Main>
    </GovernanceFrame>
  );
}

function teamRowFromLiveMember(member: ReturnType<typeof useLiveMembers>["data"][number]) {
  return [
    member.name,
    member.initials,
    member.email,
    member.role.toUpperCase(),
    member.status === "active" ? "active now" : member.lastActive,
  ] as TeamDisplay;
}

function SettingsStat({
  label,
  value,
  caption,
  hazard,
  green,
}: Readonly<{ label: string; value: string; caption: string; hazard?: boolean; green?: boolean }>) {
  return (
    <div className="p-5">
      <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">{label}</div>
      <div
        className={cn(
          "mt-2 font-cond text-[24px] font-semibold leading-none text-[#EDF0F3]",
          hazard && "text-[#FF5A1F]",
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          "mt-2 text-[10px] tracking-[0.08em]",
          green ? "text-[#6E9E7C]" : "text-[#5B626C]",
        )}
      >
        {caption}
      </div>
    </div>
  );
}

function SettingsHint({ icon, text }: Readonly<{ icon: ReactNode; text: string }>) {
  return (
    <div className="flex items-center gap-2 border border-[#282C34] bg-[#15171B] px-3 py-2">
      {icon}
      <span>{text}</span>
    </div>
  );
}

function TeamRow({ member }: Readonly<{ member: TeamDisplay }>) {
  const [name, initials, email, role, active] = member;
  const roleColor: Record<string, string> = {
    ADMIN: "#FF5A1F",
    APPROVER: "#6E9E7C",
    VIEWER: "#8A909B",
  };
  const color = roleColor[role] ?? "#8A909B";
  const live = active === "active now";

  return (
    <RowShell className="group grid grid-cols-[minmax(240px,1.6fr)_140px_minmax(160px,1fr)_60px] items-center border-b border-[#1E222A] px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center border border-[#282C34] bg-[#15171B] text-[11px] font-bold text-[#D7DBE0]">
          {initials}
        </span>
        <div>
          <div className="font-body text-[13px] text-[#EDF0F3]">{name}</div>
          <div className="text-[10px] text-[#5B626C]">{email}</div>
        </div>
      </div>
      <div>
        <span
          className="inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] tracking-[0.1em]"
          style={{ borderColor: `${color}55`, color }}
        >
          <span className="h-1.5 w-1.5" style={{ background: color }} />
          {role}
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px]",
          live ? "text-[#6E9E7C]" : "text-[#5B626C]",
        )}
      >
        {live ? <span className="h-1.5 w-1.5 bg-[#6E9E7C]" /> : null}
        {active}
      </div>
      <div className="text-right">
        <button
          type="button"
          onClick={() => toast.info(`${name} / member removal requires owner confirmation`)}
          className="flex h-6 w-6 items-center justify-center text-[#5B626C] opacity-0 transition group-hover:opacity-100 hover:text-[#FF5A1F]"
        >
          <UserMinus className="h-3.5 w-3.5" strokeWidth={iconStroke} />
        </button>
      </div>
    </RowShell>
  );
}

type StatusSupabaseHealth = {
  api: { urlConfigured: boolean; anonKeyConfigured: boolean; error: string | null };
  serviceRole: { status: string };
  readModel: { status: string; sampleRows: number; error: string | null };
};

function healthStatusLabel(status: string | null | undefined) {
  return status ? status.replaceAll("_", " ").toUpperCase() : "UNAVAILABLE";
}

function supabaseCaption(supabase: StatusSupabaseHealth | null | undefined) {
  if (!supabase) {
    return "SUPABASE STATUS UNKNOWN";
  }

  if (!supabase.api.urlConfigured) {
    return "SUPABASE URL MISSING";
  }

  if (!supabase.api.anonKeyConfigured) {
    return "PUBLIC ANON KEY MISSING";
  }

  if (supabase.serviceRole.status !== "configured") {
    return "SERVICE ROLE MISSING";
  }

  if (supabase.readModel.error) {
    return supabase.readModel.error;
  }

  return supabase.readModel.sampleRows > 0
    ? "SERVICE ROLE CONFIGURED / READ MODEL REACHABLE"
    : "AVAILABLE, NO INDEXED ROWS YET";
}

export function StatusCanvasPage() {
  const health = trpc.health.ping.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const indexer = health.data?.indexer;
  const rpc = health.data?.rpc;
  const supabase = health.data?.supabase;
  const indexerStatus = health.isLoading ? "CHECKING" : healthStatusLabel(indexer?.status);
  const indexerCaption =
    indexer?.status === "stale" && indexer.lastIndexedBlock !== null
      ? `STALE / LAST BLOCK ${indexer.lastIndexedBlock}`
      : indexer?.lastIndexedBlock !== null && indexer?.lastIndexedBlock !== undefined
        ? `LAST BLOCK ${indexer.lastIndexedBlock}`
        : (indexer?.error ?? "NO INDEXED EVENTS YET");
  const readModelStatus = health.isLoading
    ? "CHECKING"
    : healthStatusLabel(supabase?.readModel.status);
  const readModelCaption = supabaseCaption(supabase);
  const readModelAvailable = supabase?.readModel.status === "available";
  const rpcStatus = health.isLoading ? "CHECKING" : healthStatusLabel(rpc?.status);
  const rpcCaption = rpc?.latestBlock
    ? `LATEST BLOCK ${rpc.latestBlock}`
    : (rpc?.error ?? "RPC STATUS UNKNOWN");

  return (
    <GovernanceFrame file="FILE / ARCANUM / GOVERNANCE / STATUS" showRange={false}>
      <Main>
        <div className="grid grid-cols-3 divide-x divide-[#282C34] border border-[#282C34] bg-[#181B21]">
          <SettingsStat
            label="EVENT INDEXER"
            value={indexerStatus}
            caption={indexerCaption}
            hazard={indexer?.status === "stale" || indexer?.status === "unavailable"}
            green={indexer?.status === "available"}
          />
          <SettingsStat
            label="SUPABASE READ MODEL"
            value={readModelStatus}
            caption={readModelCaption}
            hazard={!health.isLoading && !readModelAvailable}
            green={readModelAvailable}
          />
          <SettingsStat
            label="ARC RPC"
            value={rpcStatus}
            caption={rpcCaption}
            hazard={!health.isLoading && rpc?.status !== "available"}
            green={rpc?.status === "available"}
          />
        </div>
        <div className="border border-[#282C34] bg-[#181B21] px-4 py-3 text-[11px] leading-relaxed text-[#8A909B]">
          Supabase read model stores wallet creation and setup writes. Event indexer tracks on-chain
          history and may lag behind; fresh wallets can be synced in Supabase while showing no
          indexed activity yet.
        </div>
      </Main>
    </GovernanceFrame>
  );
}
