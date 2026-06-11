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
  monthlyRollingCap: bigint;
  allowedCategories: bigint;
  escalationThreshold: bigint;
  requireAllowlist: boolean;
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
  agentSigner: Account;
  chain: Chain;
  rpcUrl: string;
  dashboardUrl?: string;
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
  status: "PENDING" | "EXECUTED" | "REJECTED" | "EXPIRED";
}>;

export type Unwatch = () => void;
