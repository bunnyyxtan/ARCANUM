/**
 * On-chain contract surface for ARCANUM governed wallets.
 *
 * Extracted verbatim from the old frontend (components/arcanum/canvas/pages.tsx)
 * before the UI was removed, so the contract logic survives the frontend
 * replacement. The full old UI lives on the `pre-frontend-delete-backup` branch.
 */

import type { Address } from "viem";

export const zeroEvmAddress = "0x0000000000000000000000000000000000000000" as const;

/** Deployed contract addresses come from env (Arc Testnet). */
export const deployedContracts = [
  { label: "WalletFactory", value: process.env.NEXT_PUBLIC_WALLET_FACTORY },
  { label: "PolicyEngine", value: process.env.NEXT_PUBLIC_POLICY_ENGINE },
  { label: "EscalationManager", value: process.env.NEXT_PUBLIC_ESCALATION_MANAGER },
  { label: "AnomalyOracle", value: process.env.NEXT_PUBLIC_ANOMALY_ORACLE },
  { label: "VendorRegistry", value: process.env.NEXT_PUBLIC_VENDOR_REGISTRY },
] as const;

export const walletFactoryAbi = [
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

export const guardedWalletControlAbi = [
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

export const escalationManagerAbi = [
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

export const escalationStatusLabels = ["PENDING", "EXECUTED", "REJECTED", "EXPIRED"] as const;

/** Bitmask enabling all five vendor spend categories. */
export const allPolicyCategoriesMask = 31n;

/* ------------------------------------------------------------------ */
/* Domain option sets + form defaults preserved from the old UI        */
/* (Deploy Governed Wallet + Add Vendor modals).                       */
/* ------------------------------------------------------------------ */

export const vendorCategoryOptions = [
  { label: "API", value: "api" },
  { label: "COMPUTE", value: "compute" },
  { label: "DATA", value: "data" },
  { label: "SUBCONTRACTING", value: "subcontracting" },
  { label: "OTHER", value: "other" },
] as const;

export const doctrineCategoryOptions = [
  { label: "API", value: "API", defaultEnabled: true },
  { label: "DATA", value: "DATA", defaultEnabled: true },
  { label: "COMPUTE", value: "COMPUTE", defaultEnabled: true },
  { label: "SUBCONTRACT", value: "SUBCONTRACTING", defaultEnabled: false },
  { label: "OTHER", value: "OTHER", defaultEnabled: false },
] as const;

export type VendorCategoryValue = (typeof vendorCategoryOptions)[number]["value"];
export type DoctrineCategoryValue = (typeof doctrineCategoryOptions)[number]["value"];

export type DeployWalletFormState = {
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

export const initialDeployWalletForm: DeployWalletFormState = {
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

export type AddVendorFormState = {
  address: string;
  category: VendorCategoryValue;
  confidential: boolean;
  name: string;
  notes: string;
  perVendorCap: string;
};

export const initialVendorForm: AddVendorFormState = {
  address: "",
  category: "api",
  confidential: true,
  name: "",
  notes: "",
  perVendorCap: "0",
};

export type PolicyDraftState = {
  dailyCap: string;
  enabledCategories: ReadonlySet<DoctrineCategoryValue>;
  escalationThreshold: string;
  monthlyCap: string;
  perTxCap: string;
  requireAllowlist: boolean;
};

export const initialPolicyDraft: PolicyDraftState = {
  dailyCap: "500",
  enabledCategories: new Set(["API", "DATA", "COMPUTE"]),
  escalationThreshold: "100",
  monthlyCap: "15000",
  perTxCap: "50",
  requireAllowlist: true,
};

export type PolicyEnvelopeValue = {
  allowedCategories: bigint;
  daily24hCap: bigint;
  escalationThreshold: bigint;
  monthlyRollingCap: bigint;
  perTxCap: bigint;
  requireAllowlist: boolean;
};

export type { Address };
