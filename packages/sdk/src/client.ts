import {
  EscalationManagerAbi,
  GuardedWalletAbi,
  PolicyEngineAbi,
  VendorRegistryAbi,
} from "@arcanum/contracts";
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS,
  createPaymentIntentMessage,
  createPaymentIntentResult,
  paymentIntentInputSchema,
} from "@arcanum/shared";
import {
  http,
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  stringToHex,
} from "viem";

import {
  ArcanumError,
  AgentNotAuthorizedError,
  EscalationRequiredError,
  InsufficientUSDCError,
  PolicyDeniedError,
  WalletFrozenError,
} from "./errors";
import type {
  ArcanumClientConfig,
  EscalationResolved,
  ExecuteUSDCInput,
  ExecuteUSDCResult,
  PaymentIntentInput,
  PaymentIntentResult,
  PolicyEnvelope,
  SignedPaymentIntentInput,
  SimulateInput,
  SimulationResult,
  Unwatch,
  VendorInfo,
} from "./types";

const VERDICTS = ["ALLOW", "ESCALATE", "DENY", "FREEZE"] as const;
const REASONS = [
  "NONE",
  "ALLOWLIST_REQUIRED",
  "PER_TX_CAP",
  "DAILY_CAP",
  "ESCALATION_THRESHOLD",
  "BLOCKED_VENDOR",
  "CATEGORY_DISABLED",
] as const;
const ESCALATION_STATUSES = ["PENDING", "EXECUTED", "REJECTED", "EXPIRED"] as const;

export class ArcanumClient {
  readonly walletAddress: Address;
  readonly dashboardUrl?: string;
  private readonly pollingIntervalMs: number;
  private readonly publicClient;
  private readonly walletClient;

  constructor(config: ArcanumClientConfig) {
    this.walletAddress = config.walletAddress;
    this.dashboardUrl = config.dashboardUrl;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 4_000;
    const transport = http(config.rpcUrl);

    this.publicClient = createPublicClient({
      chain: config.chain,
      transport,
    });
    this.walletClient = createWalletClient({
      account: config.agentSigner,
      chain: config.chain,
      transport,
    });
  }

  async signPaymentIntent(input: PaymentIntentInput): Promise<SignedPaymentIntentInput> {
    const intent = paymentIntentInputSchema.parse(input);
    const signature = await this.walletClient.signMessage({
      account: this.walletClient.account,
      message: createPaymentIntentMessage(intent),
    });

    return {
      ...intent,
      signature,
    };
  }

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const intent = paymentIntentInputSchema.parse(input);
    const amount = parsePaymentIntentAmount(intent.amount);

    if (!sameAddress(intent.governedWalletAddress, this.walletAddress)) {
      return paymentIntentResult(intent, {
        decision: "validation_error",
        reason: "Intent governed wallet does not match this SDK client.",
        errorCode: "WALLET_MISMATCH",
      });
    }

    if (!sameAddress(intent.agentSignerAddress, this.walletClient.account.address)) {
      return paymentIntentResult(intent, {
        decision: "validation_error",
        reason: "Intent agent signer does not match this SDK signer.",
        errorCode: "SIGNER_MISMATCH",
      });
    }

    if (intent.chainId !== ARC_TESTNET_CHAIN_ID) {
      return paymentIntentResult(intent, {
        decision: "unsupported",
        reason: "Only Arc Testnet payment intents are supported.",
        errorCode: "UNSUPPORTED_CHAIN",
      });
    }

    if (!sameAddress(intent.tokenAddress, ARC_TESTNET_USDC_ADDRESS)) {
      return paymentIntentResult(intent, {
        decision: "unsupported",
        reason: "Only Arc Testnet USDC payment intents are supported.",
        errorCode: "UNSUPPORTED_TOKEN",
      });
    }

    if (amount === null) {
      return paymentIntentResult(intent, {
        decision: "validation_error",
        reason: "Amount must be greater than zero with up to 6 decimals.",
        errorCode: "INVALID_AMOUNT",
      });
    }

    const [walletToken, isSigner, frozen] = await Promise.all([
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "usdc",
      }),
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "agentSigners",
        args: [intent.agentSignerAddress],
      }),
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "frozen",
      }),
    ]);

    if (!sameAddress(walletToken, ARC_TESTNET_USDC_ADDRESS)) {
      return paymentIntentResult(intent, {
        amount,
        decision: "unsupported",
        reason: "GuardedWallet is not configured for Arc Testnet USDC.",
        errorCode: "UNSUPPORTED_WALLET_TOKEN",
      });
    }

    if (!isSigner) {
      return paymentIntentResult(intent, {
        amount,
        decision: "deny",
        reason: "Agent signer is not authorized for this GuardedWallet.",
        errorCode: "AGENT_NOT_AUTHORIZED",
      });
    }

    if (frozen) {
      return paymentIntentResult(intent, {
        amount,
        decision: "freeze",
        reason: "GuardedWallet is frozen.",
        errorCode: "WALLET_FROZEN",
      });
    }

    const simulation = await this.simulate({
      to: intent.vendorAddress,
      amount,
    });

    return paymentIntentResult(intent, {
      amount,
      decision: verdictToPaymentDecision(simulation.verdict),
      reason: simulation.reason,
      policyReference: `guarded-wallet:${intent.governedWalletAddress}`,
    });
  }

  async executePaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    const intent = paymentIntentInputSchema.parse(input);
    const preflight = await this.createPaymentIntent(intent);

    if (!isExecutablePaymentDecision(preflight.decision)) {
      return preflight;
    }

    if (preflight.amountBaseUnits === undefined) {
      return createPaymentIntentResult(intent, {
        decision: "validation_error",
        reason: "Payment intent amount could not be prepared for execution.",
        errorCode: "INVALID_AMOUNT",
      });
    }

    try {
      const execution = await this.executeUSDC({
        to: intent.vendorAddress,
        amount: BigInt(preflight.amountBaseUnits),
        reason: intent.purpose,
        metadata: {
          idempotencyKey: intent.idempotencyKey,
          tokenSymbol: intent.tokenSymbol ?? "USDC",
        },
      });

      return paymentIntentExecutionResult(intent, preflight, execution);
    } catch (error) {
      return paymentIntentExecutionErrorResult(intent, preflight, error);
    }
  }

  async executeUSDC(input: ExecuteUSDCInput): Promise<ExecuteUSDCResult> {
    await this.assertSignerAndWalletOpen();
    const simulation = await this.simulate(input);

    if (simulation.verdict === "DENY") {
      return { verdict: "DENY", error: new PolicyDeniedError(simulation.reason) };
    }

    if (simulation.verdict === "ALLOW") {
      await this.assertSufficientBalance(input.amount);
    }

    const txHash = await this.walletClient.writeContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "executeUSDC",
      args: [input.to, input.amount, reasonBytes(input.reason, input.metadata)],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    const escalationId = findEscalationId(receipt.logs);

    if (simulation.verdict === "ESCALATE") {
      this.logEscalationLink(escalationId);
      return {
        verdict: "ESCALATE",
        txHash,
        escalationId,
        error: new EscalationRequiredError(simulation.reason, escalationId),
      };
    }

    if (simulation.verdict === "FREEZE") {
      return {
        verdict: "FREEZE",
        txHash,
        error: new WalletFrozenError(simulation.reason),
      };
    }

    return { verdict: "ALLOW", txHash };
  }

  async getPolicy(): Promise<PolicyEnvelope> {
    const policy = await this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "policy",
    });

    return {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyRollingCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
    };
  }

  async getDailySpent(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "dailySpent",
    });
  }

  async simulate(input: SimulateInput): Promise<SimulationResult> {
    const [policy, dailySpent, policyEngine, vendorRegistry] = await Promise.all([
      this.getPolicy(),
      this.getDailySpent(),
      this.policyEngine(),
      this.vendorRegistry(),
    ]);
    const result = await this.publicClient.readContract({
      account: this.walletAddress,
      address: policyEngine,
      abi: PolicyEngineAbi,
      functionName: "evaluate",
      args: [policy, input.to, input.amount, dailySpent, vendorRegistry],
    });
    const verdictIndex = Number(result[0]);
    const reasonIndex = Number(result[1]);

    return {
      verdict: VERDICTS[verdictIndex] ?? "DENY",
      reason: REASONS[reasonIndex] ?? "UNKNOWN",
    };
  }

  async getVendor(address: Address): Promise<VendorInfo> {
    const vendorRegistry = await this.vendorRegistry();
    const vendor = await this.publicClient.readContract({
      address: vendorRegistry,
      abi: VendorRegistryAbi,
      functionName: "getVendorFor",
      args: [this.walletAddress, address],
    });

    return vendor as VendorInfo;
  }

  onEscalationResolved(escalationId: Hex, callback: (event: EscalationResolved) => void): Unwatch {
    let stopped = false;
    let lastStatus = "PENDING";

    const tick = async () => {
      if (stopped) {
        return;
      }

      const escalationManager = await this.escalationManager();
      const statusIndex = Number(
        await this.publicClient.readContract({
          address: escalationManager,
          abi: EscalationManagerAbi,
          functionName: "statusOf",
          args: [escalationId],
        }),
      );
      const status = ESCALATION_STATUSES[statusIndex] ?? "PENDING";

      if (status !== lastStatus) {
        lastStatus = status;
        callback({ escalationId, status });
      }
    };

    const interval = setInterval(() => {
      void tick();
    }, this.pollingIntervalMs);
    void tick();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }

  onFrozen(callback: (reason: string) => void): Unwatch {
    return this.publicClient.watchContractEvent({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      eventName: "Frozen",
      onLogs: (logs) => {
        for (const log of logs) {
          callback(String(log.args.reason ?? "FROZEN"));
        }
      },
    });
  }

  private async assertSignerAndWalletOpen() {
    const [isSigner, frozen] = await Promise.all([
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "agentSigners",
        args: [this.walletClient.account.address],
      }),
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "frozen",
      }),
    ]);

    if (!isSigner) {
      throw new AgentNotAuthorizedError(this.walletClient.account.address);
    }

    if (frozen) {
      throw new WalletFrozenError();
    }
  }

  private async assertSufficientBalance(amount: bigint) {
    const balance = await this.publicClient.readContract({
      address: ARC_TESTNET_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [this.walletAddress],
    });

    if (balance < amount) {
      throw new InsufficientUSDCError(amount, balance);
    }
  }

  private async policyEngine(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "policyEngine",
    });
  }

  private async escalationManager(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "escalationManager",
    });
  }

  private async vendorRegistry(): Promise<Address> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "vendorRegistry",
    });
  }

  private logEscalationLink(escalationId?: Hex) {
    if (this.dashboardUrl === undefined || escalationId === undefined) {
      return;
    }

    console.info(
      `Arcanum escalation queued: ${this.dashboardUrl}/escalations?focus=${escalationId}`,
    );
  }
}

function reasonBytes(
  reason: string,
  metadata?: Readonly<Record<string, string | number | boolean>>,
) {
  const payload =
    metadata === undefined
      ? reason
      : JSON.stringify({
          reason,
          metadata,
        });

  return stringToHex(payload);
}

function findEscalationId(logs: ReadonlyArray<{ data: Hex; topics: readonly Hex[] }>) {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({
        abi: GuardedWalletAbi,
        data: log.data,
        topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]],
      });

      if (decoded.eventName === "TransferEscalated") {
        return decoded.args.escalationId as Hex;
      }
    } catch {}
  }

  return undefined;
}

export function encodeExecuteUSDC(input: ExecuteUSDCInput) {
  return encodeFunctionData({
    abi: GuardedWalletAbi,
    functionName: "executeUSDC",
    args: [input.to, input.amount, reasonBytes(input.reason, input.metadata)],
  });
}

function parsePaymentIntentAmount(amount: string) {
  try {
    const parsed = parseUnits(amount, 6);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

function verdictToPaymentDecision(verdict: SimulationResult["verdict"]) {
  switch (verdict) {
    case "ALLOW":
      return "allow";
    case "ESCALATE":
      return "escalate";
    case "FREEZE":
      return "freeze";
    case "DENY":
    default:
      return "deny";
  }
}

function isExecutablePaymentDecision(decision: PaymentIntentResult["decision"]) {
  return decision === "allow" || decision === "escalate" || decision === "freeze";
}

function paymentIntentExecutionResult(
  intent: PaymentIntentInput,
  preflight: PaymentIntentResult,
  execution: ExecuteUSDCResult,
): PaymentIntentResult {
  return createPaymentIntentResult(intent, {
    decision: verdictToPaymentDecision(execution.verdict),
    reason: execution.error?.reason ?? preflight.reason,
    amountBaseUnits: preflight.amountBaseUnits,
    policyReference: preflight.policyReference,
    escalationId: execution.escalationId,
    txHash: execution.txHash,
    pendingIndexer: execution.txHash !== undefined,
    errorCode: execution.error?.code,
  });
}

function paymentIntentExecutionErrorResult(
  intent: PaymentIntentInput,
  preflight: PaymentIntentResult,
  error: unknown,
): PaymentIntentResult {
  if (error instanceof ArcanumError) {
    return createPaymentIntentResult(intent, {
      decision: verdictToPaymentDecision(error.verdict),
      reason: error.reason ?? error.message,
      amountBaseUnits: preflight.amountBaseUnits,
      policyReference: preflight.policyReference,
      errorCode: error.code,
    });
  }

  return createPaymentIntentResult(intent, {
    decision: "validation_error",
    reason: "Payment transaction could not be submitted.",
    amountBaseUnits: preflight.amountBaseUnits,
    policyReference: preflight.policyReference,
    errorCode: "TRANSACTION_FAILED",
  });
}

function paymentIntentResult(
  intent: PaymentIntentInput,
  input: Readonly<{
    decision: PaymentIntentResult["decision"];
    reason: string;
    amount?: bigint;
    policyReference?: string;
    errorCode?: string;
  }>,
): PaymentIntentResult {
  return createPaymentIntentResult(intent, {
    decision: input.decision,
    reason: input.reason,
    amountBaseUnits: input.amount,
    policyReference: input.policyReference,
    errorCode: input.errorCode,
  });
}

function sameAddress(a: Address | string, b: Address | string) {
  return a.toLowerCase() === b.toLowerCase();
}
