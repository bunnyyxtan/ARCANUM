import { contractAddresses } from "@/lib/deployment";
import type { Address } from "viem";

export const zeroEvmAddress = "0x0000000000000000000000000000000000000000" as const;

/** Deployed contract addresses come from the configured Arc network env. */
export const deployedContracts = [
  { label: "WalletFactory", value: contractAddresses.walletFactory },
  { label: "PolicyEngine", value: contractAddresses.policyEngine },
  { label: "EscalationManager", value: contractAddresses.escalationManager },
  { label: "AnomalyOracle", value: contractAddresses.anomalyOracle },
  { label: "VendorRegistry", value: contractAddresses.vendorRegistry },
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
          { name: "monthlyCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
          { name: "freezeOnBlockedVendor", type: "bool" },
        ],
      },
      { name: "initialSigners", type: "address[]" },
      { name: "escalationCouncil", type: "address[]" },
      { name: "escalationThreshold", type: "uint8" },
      { name: "escalationExpirySeconds", type: "uint64" },
    ],
    outputs: [{ name: "wallet", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "nonces",
    inputs: [{ name: "deployer", type: "address" }],
    outputs: [{ name: "nonce", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "predictWallet",
    inputs: [
      { name: "deployer", type: "address" },
      { name: "owner", type: "address" },
      { name: "label", type: "string" },
      { name: "nonce", type: "uint256" },
      {
        name: "initialPolicy",
        type: "tuple",
        components: [
          { name: "perTxCap", type: "uint256" },
          { name: "daily24hCap", type: "uint256" },
          { name: "monthlyCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
          { name: "freezeOnBlockedVendor", type: "bool" },
        ],
      },
      { name: "initialSigners", type: "address[]" },
      { name: "escalationCouncil", type: "address[]" },
      { name: "escalationThreshold", type: "uint8" },
      { name: "escalationExpirySeconds", type: "uint64" },
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
      { name: "defaultsVersion", type: "uint256", indexed: false },
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
      { name: "monthlyCap", type: "uint256" },
      { name: "allowedCategories", type: "uint256" },
      { name: "escalationThreshold", type: "uint256" },
      { name: "requireAllowlist", type: "bool" },
      { name: "freezeOnBlockedVendor", type: "bool" },
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
          { name: "monthlyCap", type: "uint256" },
          { name: "allowedCategories", type: "uint256" },
          { name: "escalationThreshold", type: "uint256" },
          { name: "requireAllowlist", type: "bool" },
          { name: "freezeOnBlockedVendor", type: "bool" },
        ],
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "frozen",
    inputs: [],
    outputs: [{ name: "frozen", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "freeze",
    inputs: [{ name: "reason", type: "bytes" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "cancelEscalation",
    inputs: [{ name: "escalationId", type: "bytes32" }],
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
      { name: "policyVersion", type: "uint256" },
      { name: "heldCouncilVersion", type: "uint256" },
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
  freezeOnBlockedVendor: boolean;
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
  freezeOnBlockedVendor: true,
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
  freezeOnBlockedVendor: boolean;
};

export const initialPolicyDraft: PolicyDraftState = {
  dailyCap: "500",
  enabledCategories: new Set(["API", "DATA", "COMPUTE"]),
  escalationThreshold: "100",
  monthlyCap: "15000",
  perTxCap: "50",
  requireAllowlist: true,
  freezeOnBlockedVendor: true,
};

export type PolicyEnvelopeValue = {
  allowedCategories: bigint;
  daily24hCap: bigint;
  escalationThreshold: bigint;
  monthlyCap: bigint;
  perTxCap: bigint;
  requireAllowlist: boolean;
  freezeOnBlockedVendor: boolean;
};

export type { Address };
