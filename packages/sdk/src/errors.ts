import type { Address, Hash } from "viem";

export type ArcanumVerdict = "ALLOW" | "ESCALATE" | "DENY" | "FREEZE";

export type ArcanumErrorCode =
  | "POLICY_DENIED"
  | "ESCALATION_REQUIRED"
  | "WALLET_FROZEN"
  | "AGENT_NOT_AUTHORIZED"
  | "AGENT_SIGNER_REQUIRED"
  | "INSUFFICIENT_USDC"
  | "TRANSFER_REVERTED"
  | "RPC_ERROR"
  | "API_URL_REQUIRED"
  | "WALLET_MISMATCH";

export class ArcanumError extends Error {
  readonly code: ArcanumErrorCode;
  readonly verdict: ArcanumVerdict;
  readonly reason?: string;

  constructor(input: {
    code: ArcanumErrorCode;
    message: string;
    verdict: ArcanumVerdict;
    reason?: string;
  }) {
    super(input.message);
    this.name = "ArcanumError";
    this.code = input.code;
    this.verdict = input.verdict;
    this.reason = input.reason;
  }
}

export class TransferRevertedError extends ArcanumError {
  readonly txHash: Hash;
  readonly customErrorName?: string;

  constructor(txHash: Hash, customErrorName?: string) {
    super({
      code: "TRANSFER_REVERTED",
      message: customErrorName
        ? `Transaction ${txHash} reverted with ${customErrorName}`
        : `Transaction ${txHash} reverted`,
      verdict: "DENY",
      reason: customErrorName,
    });
    this.name = "TransferRevertedError";
    this.txHash = txHash;
    this.customErrorName = customErrorName;
  }
}

export class PolicyDeniedError extends ArcanumError {
  constructor(reason: string) {
    super({
      code: "POLICY_DENIED",
      message: `Policy denied transfer: ${reason}`,
      verdict: "DENY",
      reason,
    });
    this.name = "PolicyDeniedError";
  }
}

export class EscalationRequiredError extends ArcanumError {
  readonly escalationId?: `0x${string}`;

  constructor(reason: string, escalationId?: `0x${string}`) {
    super({
      code: "ESCALATION_REQUIRED",
      message: `Transfer requires escalation: ${reason}`,
      verdict: "ESCALATE",
      reason,
    });
    this.name = "EscalationRequiredError";
    this.escalationId = escalationId;
  }
}

export class WalletFrozenError extends ArcanumError {
  constructor(reason = "WALLET_FROZEN") {
    super({
      code: "WALLET_FROZEN",
      message: `Wallet is frozen: ${reason}`,
      verdict: "FREEZE",
      reason,
    });
    this.name = "WalletFrozenError";
  }
}

export class AgentNotAuthorizedError extends ArcanumError {
  constructor(agent: Address) {
    super({
      code: "AGENT_NOT_AUTHORIZED",
      message: `Agent signer is not authorized for this GuardedWallet: ${agent}`,
      verdict: "DENY",
      reason: "NOT_SIGNER",
    });
    this.name = "AgentNotAuthorizedError";
  }
}

export class InsufficientUSDCError extends ArcanumError {
  constructor(required: bigint, available: bigint) {
    super({
      code: "INSUFFICIENT_USDC",
      message: `Insufficient USDC: required ${required.toString()}, available ${available.toString()}`,
      verdict: "DENY",
      reason: "INSUFFICIENT_USDC",
    });
    this.name = "InsufficientUSDCError";
  }
}
