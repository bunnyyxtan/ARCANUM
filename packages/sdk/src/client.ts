import {
  EscalationManagerAbi,
  GuardedWalletAbi,
  PolicyEngineAbi,
  VendorRegistryAbi,
} from "@arcanum/contracts";
import {
  ARC_CHAIN_ID,
  ARC_NETWORK_NAME,
  ARC_USDC_ADDRESS,
  type PaymentReceiptEnvelope,
  type PaymentReceiptIssuer,
  type PaymentReceiptVerification,
  createPaymentIntentMessage,
  createPaymentIntentResult,
  paymentIntentInputSchema,
  paymentRequestDigest,
  verifyPaymentReceipt,
} from "@arcanum/shared";
import {
  http,
  type Address,
  type Hash,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeErrorResult,
  decodeEventLog,
  encodeEventTopics,
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  stringToHex,
} from "viem";

import {
  AgentNotAuthorizedError,
  ArcanumError,
  EscalationRequiredError,
  InsufficientUSDCError,
  PolicyDeniedError,
  TransferRevertedError,
  WalletFrozenError,
} from "./errors";
import { type AttachedReceiptEvidence, ReceiptApi, type RequestedReceipt } from "./receipts";
import type {
  ArcanumClientConfig,
  Escalation,
  EscalationResolved,
  ExecuteUSDCInput,
  ExecuteUSDCResult,
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentIntentWithReceiptResult,
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
  "MONTHLY_CAP",
  "PER_VENDOR_CAP",
] as const;
const ESCALATION_STATUSES = [
  "PENDING",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
  "DENIED",
  "CANCELLED",
  "INVALIDATED",
] as const;

export class ArcanumClient {
  readonly walletAddress: Address;
  readonly dashboardUrl?: string;
  private readonly pollingIntervalMs: number;
  private readonly publicClient;
  private readonly walletClient;
  private readonly receiptApi: ReceiptApi | null;
  private readonly receiptIssuers: readonly PaymentReceiptIssuer[] | undefined;

  constructor(config: ArcanumClientConfig) {
    this.walletAddress = config.walletAddress;
    this.dashboardUrl = config.dashboardUrl;
    this.pollingIntervalMs = config.pollingIntervalMs ?? 4_000;
    this.receiptApi = config.apiUrl
      ? new ReceiptApi({ apiUrl: config.apiUrl, fetch: config.fetch })
      : null;
    this.receiptIssuers = config.receiptIssuers;
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

  private requireReceiptApi() {
    if (!this.receiptApi) {
      throw new ArcanumError({
        code: "API_URL_REQUIRED",
        message:
          "Payment decision receipts need the Arcanum API. Construct ArcanumClient with apiUrl.",
        verdict: "DENY",
        reason: "API_URL_REQUIRED",
      });
    }
    return this.receiptApi;
  }

  private requireSigner() {
    const account = this.walletClient.account;
    if (!account) {
      throw new ArcanumError({
        code: "AGENT_SIGNER_REQUIRED",
        message:
          "This action needs an agent signer. Construct ArcanumClient with agentSigner to sign or execute payments.",
        verdict: "DENY",
        reason: "AGENT_SIGNER_REQUIRED",
      });
    }
    return account;
  }

  async signPaymentIntent(input: PaymentIntentInput): Promise<SignedPaymentIntentInput> {
    const intent = paymentIntentInputSchema.parse(input);
    const signature = await this.walletClient.signMessage({
      account: this.requireSigner(),
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

    if (!sameAddress(intent.agentSignerAddress, this.requireSigner().address)) {
      return paymentIntentResult(intent, {
        decision: "validation_error",
        reason: "Intent agent signer does not match this SDK signer.",
        errorCode: "SIGNER_MISMATCH",
      });
    }

    if (intent.chainId !== ARC_CHAIN_ID) {
      return paymentIntentResult(intent, {
        decision: "unsupported",
        reason: `Only ${ARC_NETWORK_NAME} payment intents are supported.`,
        errorCode: "UNSUPPORTED_CHAIN",
      });
    }

    if (!sameAddress(intent.tokenAddress, ARC_USDC_ADDRESS)) {
      return paymentIntentResult(intent, {
        decision: "unsupported",
        reason: `Only ${ARC_NETWORK_NAME} USDC payment intents are supported.`,
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

    if (!sameAddress(walletToken, ARC_USDC_ADDRESS)) {
      return paymentIntentResult(intent, {
        amount,
        decision: "unsupported",
        reason: `GuardedWallet is not configured for ${ARC_NETWORK_NAME} USDC.`,
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
          reference: intent.reference,
          tokenSymbol: intent.tokenSymbol ?? "USDC",
        },
      });

      return paymentIntentExecutionResult(intent, preflight, execution);
    } catch (error) {
      return paymentIntentExecutionErrorResult(intent, preflight, error);
    }
  }

  /**
   * Ask the Arcanum API for a signed Payment Decision Receipt: the verdict
   * this wallet's policy gives the intent, evaluated at one pinned block and
   * signed by the Arcanum issuer. Nothing moves onchain.
   *
   * The receipt is verified before it is returned: issuer signature against
   * the trusted registry, digest, and the agent's own request signature, and
   * it must describe exactly the intent that was just signed. The API is the
   * transport for a receipt, never the authority on what one says.
   */
  async requestPaymentReceipt(input: PaymentIntentInput): Promise<RequestedReceipt> {
    const api = this.requireReceiptApi();
    const intent = paymentIntentInputSchema.parse(input);
    if (!sameAddress(intent.governedWalletAddress, this.walletAddress)) {
      throw new ArcanumError({
        code: "WALLET_MISMATCH",
        message: "Intent governed wallet does not match this SDK client.",
        verdict: "DENY",
        reason: "WALLET_MISMATCH",
      });
    }
    const requested = await api.requestReceipt(await this.signPaymentIntent(intent));
    await this.assertReceiptDescribesIntent(requested.receipt, intent);
    return requested;
  }

  private async assertReceiptDescribesIntent(
    envelope: PaymentReceiptEnvelope,
    intent: PaymentIntentInput,
  ): Promise<void> {
    const verification = await verifyPaymentReceipt(envelope, {
      ...(this.receiptIssuers ? { issuers: this.receiptIssuers } : {}),
    });
    if (!verification.ok) {
      throw new ArcanumError({
        code: "RECEIPT_UNVERIFIED",
        message: `Receipt ${envelope.receipt.receiptId} failed verification (${describeVerification(verification)}).`,
        verdict: "DENY",
        reason: "RECEIPT_UNVERIFIED",
      });
    }
    // The request digest covers every field of the signed intent, so equal
    // digests mean the receipt answers this payment and no other.
    if (envelope.receipt.requestDigest !== paymentRequestDigest(intent)) {
      throw new ArcanumError({
        code: "RECEIPT_MISMATCH",
        message: `Receipt ${envelope.receipt.receiptId} describes a different payment intent than the one requested.`,
        verdict: "DENY",
        reason: "RECEIPT_MISMATCH",
      });
    }
  }

  /** Link the transaction that acted on a receipt; the API verifies the link onchain. */
  async attachPaymentReceiptEvidence(
    receiptId: string,
    txHash: Hash,
  ): Promise<AttachedReceiptEvidence> {
    return this.requireReceiptApi().attachEvidence(receiptId, txHash);
  }

  /**
   * Receipt-first payment: obtain the receipt, act on its verdict, and link
   * the resulting transaction back to it. The receipt id travels in the
   * executeUSDC reason bytes, so the chain itself names the decision it acted
   * on. Denied and frozen verdicts never reach the chain.
   */
  async executePaymentIntentWithReceipt(
    input: PaymentIntentInput,
  ): Promise<PaymentIntentWithReceiptResult> {
    const intent = paymentIntentInputSchema.parse(input);
    const { receipt, replayed } = await this.requestPaymentReceipt(intent);
    const decision = receipt.receipt.decision;
    const preflight = createPaymentIntentResult(intent, {
      decision: decision.verdict,
      reason: decision.reasonCode,
      amountBaseUnits: receipt.receipt.amountBaseUnits,
      policyReference: `payment-receipt:${receipt.receipt.receiptId}`,
    });

    if (decision.verdict !== "allow" && decision.verdict !== "escalate") {
      return { receipt, replayed, result: preflight, evidence: null };
    }

    let result: PaymentIntentResult;
    try {
      const execution = await this.executeUSDC({
        to: intent.vendorAddress,
        amount: BigInt(receipt.receipt.amountBaseUnits),
        reason: intent.purpose,
        metadata: {
          reference: intent.reference,
          tokenSymbol: intent.tokenSymbol ?? "USDC",
          receiptId: receipt.receipt.receiptId,
        },
      });
      result = paymentIntentExecutionResult(intent, preflight, execution);
    } catch (error) {
      if (error instanceof TransferRevertedError) {
        // The call reached the chain and reverted: that is evidence too.
        result = createPaymentIntentResult(intent, {
          decision: "deny",
          reason: error.reason ?? error.message,
          amountBaseUnits: preflight.amountBaseUnits,
          policyReference: preflight.policyReference,
          txHash: error.txHash,
          errorCode: error.code,
        });
      } else {
        result = paymentIntentExecutionErrorResult(intent, preflight, error);
      }
    }
    return this.linkExecution(receipt, replayed, result);
  }

  private async linkExecution(
    receipt: PaymentReceiptEnvelope,
    replayed: boolean,
    result: PaymentIntentResult,
  ): Promise<PaymentIntentWithReceiptResult> {
    if (!result.txHash) {
      return { receipt, replayed, result, evidence: null };
    }
    try {
      const attached = await this.attachPaymentReceiptEvidence(
        receipt.receipt.receiptId,
        result.txHash,
      );
      return { receipt, replayed, result, evidence: attached.evidence };
    } catch (error) {
      // The payment already happened; report the linkage failure, never hide the tx.
      return { receipt, replayed, result, evidence: null, evidenceError: asError(error) };
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
      account: this.requireSigner(),
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "executeUSDC",
      args: [input.to, input.amount, reasonBytes(input.reason, input.metadata)],
    });
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    await this.assertReceiptSucceeded(txHash, receipt.status, receipt.blockNumber);
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
      monthlyCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
      freezeOnBlockedVendor: policy[6],
    };
  }

  async getEscalation(escalationId: Hex): Promise<Escalation> {
    const manager = await this.escalationManager();
    const escalation = await this.publicClient.readContract({
      address: manager,
      abi: EscalationManagerAbi,
      functionName: "getEscalation",
      args: [escalationId],
    });

    return {
      wallet: escalation[0],
      to: escalation[1],
      amount: escalation[2],
      reason: escalation[3],
      createdAt: escalation[4],
      expiresAt: escalation[5],
      threshold: escalation[6],
      signaturesCount: escalation[7],
      status: escalationStatus(escalation[8]),
      policyVersion: escalation[9],
      heldCouncilVersion: escalation[10],
    };
  }

  /**
   * Confirms a submitted hash. After a receipt timeout, confirm the original hash:
   * submitting the same reference again can execute the transfer twice.
   */
  async confirm(txHash: Hash) {
    const receipt = await this.publicClient.waitForTransactionReceipt({ hash: txHash });
    await this.assertReceiptSucceeded(txHash, receipt.status, receipt.blockNumber);
    return receipt;
  }

  async getDailySpent(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "dailySpent",
    });
  }

  async getMonthlySpent(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.walletAddress,
      abi: GuardedWalletAbi,
      functionName: "monthlySpent",
    });
  }

  async simulate(input: SimulateInput): Promise<SimulationResult> {
    const [policy, dailySpent, monthlySpent, policyEngine, vendorRegistry] = await Promise.all([
      this.getPolicy(),
      this.getDailySpent(),
      this.getMonthlySpent(),
      this.policyEngine(),
      this.vendorRegistry(),
    ]);
    const result = await this.publicClient.readContract({
      account: this.walletAddress,
      address: policyEngine,
      abi: PolicyEngineAbi,
      functionName: "evaluate",
      args: [policy, input.to, input.amount, dailySpent, monthlySpent, vendorRegistry],
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
      const status = escalationStatus(statusIndex);

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
    const signer = this.requireSigner();
    const [isSigner, frozen] = await Promise.all([
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "agentSigners",
        args: [signer.address],
      }),
      this.publicClient.readContract({
        address: this.walletAddress,
        abi: GuardedWalletAbi,
        functionName: "frozen",
      }),
    ]);

    if (!isSigner) {
      throw new AgentNotAuthorizedError(signer.address);
    }

    if (frozen) {
      throw new WalletFrozenError();
    }
  }

  private async assertSufficientBalance(amount: bigint) {
    const balance = await this.publicClient.readContract({
      address: ARC_USDC_ADDRESS,
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

  private async assertReceiptSucceeded(
    txHash: Hash,
    status: "success" | "reverted",
    blockNumber: bigint,
  ) {
    if (status === "success") {
      return;
    }
    throw new TransferRevertedError(txHash, await this.recoverRevertName(txHash, blockNumber));
  }

  private async recoverRevertName(txHash: Hash, blockNumber: bigint) {
    try {
      const transaction = await this.publicClient.getTransaction({ hash: txHash });
      await this.publicClient.call({
        account: transaction.from,
        to: transaction.to ?? undefined,
        data: transaction.input,
        value: transaction.value,
        blockNumber,
      });
      return undefined;
    } catch (error) {
      const data = findHexData(error);
      if (data === undefined) {
        return undefined;
      }
      try {
        return decodeErrorResult({ abi: GuardedWalletAbi, data }).errorName;
      } catch (decodeError) {
        if (decodeError instanceof Error && decodeError.name === "AbiErrorSignatureNotFoundError") {
          return undefined;
        }
        throw decodeError;
      }
    }
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

const TRANSFER_ESCALATED_TOPIC = encodeEventTopics({
  abi: GuardedWalletAbi,
  eventName: "TransferEscalated",
})[0];

function findEscalationId(logs: ReadonlyArray<{ data: Hex; topics: readonly Hex[] }>) {
  for (const log of logs) {
    if (log.topics[0]?.toLowerCase() !== TRANSFER_ESCALATED_TOPIC?.toLowerCase()) {
      continue;
    }

    const decoded = decodeEventLog({
      abi: GuardedWalletAbi,
      data: log.data,
      topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]],
    });
    if (decoded.eventName === "TransferEscalated") {
      return decoded.args.escalationId as Hex;
    }
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

/** One line naming the checks that failed, for the error a caller sees. */
function describeVerification(verification: PaymentReceiptVerification): string {
  const failed = [
    verification.format.status !== "valid" ? `format ${verification.format.status}` : null,
    verification.receiptDigest.status !== "verified"
      ? `digest ${verification.receiptDigest.status}`
      : null,
    verification.issuer.status !== "verified" ? `issuer ${verification.issuer.status}` : null,
    verification.request.status !== "verified" ? `request ${verification.request.status}` : null,
  ].filter((item): item is string => item !== null);
  return failed.join(", ");
}

function parsePaymentIntentAmount(amount: string) {
  try {
    const parsed = parseUnits(amount, 6);
    return parsed > 0n ? parsed : null;
  } catch {
    // Invalid decimal input is an expected validation outcome for this public API.
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
  if (error instanceof TransferRevertedError) {
    throw error;
  }
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

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function sameAddress(a: Address | string, b: Address | string) {
  return a.toLowerCase() === b.toLowerCase();
}

function escalationStatus(index: number): EscalationResolved["status"] {
  const status = ESCALATION_STATUSES[index];
  if (status === undefined) {
    throw new Error(`Unknown escalation status: ${index}`);
  }
  return status;
}

function findHexData(value: unknown, seen = new Set<object>()): Hex | undefined {
  if (typeof value === "string" && /^0x[0-9a-fA-F]{8,}$/.test(value)) {
    return value as Hex;
  }
  if (typeof value !== "object" || value === null || seen.has(value)) {
    return undefined;
  }
  seen.add(value);
  for (const nested of Object.values(value)) {
    const data = findHexData(nested, seen);
    if (data !== undefined) {
      return data;
    }
  }
  return undefined;
}
