import type {
  PaymentIntentResult,
  PaymentReceiptEnvelope,
  PaymentReceiptEvidence,
} from "@arcanum/shared";
import type { Account, Address, Chain, Hash, Hex } from "viem";

export type {
  NormalizedPaymentIntentInput,
  NormalizedSignedPaymentIntentInput,
  PaymentIntentDecision,
  PaymentIntentInput,
  PaymentIntentResult,
  SignedPaymentIntentInput,
  SupportedPaymentToken,
} from "@arcanum/shared";

import type { ArcanumError, ArcanumVerdict } from "./errors";

export type RestraintCategory = "API" | "COMPUTE" | "DATA" | "SUBCONTRACTING" | "OTHER";

export type PolicyEnvelope = Readonly<{
  perTxCap: bigint;
  daily24hCap: bigint;
  monthlyCap: bigint;
  allowedCategories: bigint;
  escalationThreshold: bigint;
  requireAllowlist: boolean;
  freezeOnBlockedVendor: boolean;
}>;

export type VendorInfo = Readonly<{
  allowed: boolean;
  blocked: boolean;
  category: number;
  perVendorCap: bigint;
  metadataHash: Hex;
}>;

export type ArcanumClientConfig = Readonly<{
  walletAddress: Address;
  /** Required for signing and executing payments; omit for read-only clients. */
  agentSigner?: Account;
  chain: Chain;
  rpcUrl: string;
  dashboardUrl?: string;
  /**
   * Origin of the Arcanum deployment that issues payment decision receipts,
   * e.g. `https://thearcanum.in`. Only the receipt methods need it.
   */
  apiUrl?: string;
  /** Overrides the global fetch used for the receipt API. */
  fetch?: typeof fetch;
  pollingIntervalMs?: number;
}>;

export type ExecuteUSDCInput = Readonly<{
  to: Address;
  amount: bigint;
  reason: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}>;

export type SimulateInput = Readonly<{
  to: Address;
  amount: bigint;
}>;

export type ExecuteUSDCResult = Readonly<{
  verdict: ArcanumVerdict;
  txHash?: Hash;
  escalationId?: Hex;
  error?: ArcanumError;
}>;

export type SimulationResult = Readonly<{
  verdict: ArcanumVerdict;
  reason: string;
}>;

export type EscalationResolved = Readonly<{
  escalationId: Hex;
  status: "PENDING" | "EXECUTED" | "REJECTED" | "EXPIRED" | "DENIED" | "CANCELLED" | "INVALIDATED";
}>;

export type Escalation = Readonly<{
  wallet: Address;
  to: Address;
  amount: bigint;
  reason: Hex;
  createdAt: bigint;
  expiresAt: bigint;
  threshold: bigint;
  signaturesCount: number;
  status: EscalationResolved["status"];
  policyVersion: bigint;
  heldCouncilVersion: bigint;
}>;

export type Unwatch = () => void;

/** Outcome of a receipt-first payment: the signed decision, what was done about it, and the link between the two. */
export type PaymentIntentWithReceiptResult = Readonly<{
  receipt: PaymentReceiptEnvelope;
  /** True when the reference had already been attested and the stored receipt was reused. */
  replayed: boolean;
  result: PaymentIntentResult;
  /** Evidence rows the API linked to the receipt, or null when nothing was sent onchain. */
  evidence: readonly PaymentReceiptEvidence[] | null;
  /** Set when the payment went through but the API could not link it; the tx hash is still in `result`. */
  evidenceError?: Error;
}>;
