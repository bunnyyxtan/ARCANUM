import { GuardedWalletAbi, PolicyEngineAbi, VendorRegistryAbi } from "@arcanum/contracts";
import {
  ARC_CHAIN_ID,
  ARC_NETWORK_NAME,
  ARC_USDC_ADDRESS,
  ESCALATION_REASONS,
  type NormalizedPaymentIntentInput,
  type NormalizedSignedPaymentIntentInput,
  type PaymentReceiptVerdict,
  createPaymentIntentMessage,
} from "@arcanum/shared";
import {
  type Address,
  type Hex,
  type PublicClient,
  erc20Abi,
  parseUnits,
  verifyMessage,
} from "viem";

import { ReceiptError } from "./errors";

// Mirrors GuardedWallet.DAY_WINDOW / MONTH_WINDOW.
const DAY_WINDOW = 86_400n;
const MONTH_WINDOW = 30n * DAY_WINDOW;

const VERDICTS = [
  "allow",
  "escalate",
  "deny",
  "freeze",
] as const satisfies readonly PaymentReceiptVerdict[];

export type PinnedBlock = Readonly<{ number: bigint; hash: Hex; timestamp: bigint }>;

export type WalletPolicyTuple = Readonly<{
  perTxCap: bigint;
  daily24hCap: bigint;
  monthlyCap: bigint;
  allowedCategories: bigint;
  escalationThreshold: bigint;
  requireAllowlist: boolean;
  freezeOnBlockedVendor: boolean;
}>;

export type SpendWindowState = Readonly<{
  spendDay: bigint;
  spendMonth: bigint;
  dailySpent: bigint;
  monthlySpent: bigint;
  blockDay: bigint;
  blockMonth: bigint;
  effectiveDailySpent: bigint;
  effectiveMonthlySpent: bigint;
}>;

/** Everything the wallet would consult in `executeUSDC`, read at one block. */
export type PinnedWalletState = Readonly<{
  block: PinnedBlock;
  walletToken: Address;
  signerAuthorized: boolean;
  frozen: boolean;
  policy: WalletPolicyTuple;
  policyVersion: bigint;
  policyEngine: Address;
  vendorRegistry: Address;
  escalationManager: Address;
  vendor: Readonly<{ allowed: boolean; blocked: boolean; category: number; perVendorCap: bigint }>;
  spend: SpendWindowState;
  usdcBalance: bigint;
}>;

export type PinnedDecision = Readonly<{
  verdict: PaymentReceiptVerdict;
  reasonCode: string;
  explanation: string;
}>;

export type PinnedEvaluation = Readonly<{
  amount: bigint;
  state: PinnedWalletState;
  decision: PinnedDecision;
  evaluatedAt: Date;
}>;

/**
 * Validate the parts of an intent the chain cannot judge. Throws the same
 * codes the read-only preflight reports, so both paths agree on what is
 * unsupported before a single RPC call is made.
 */
export function requireSupportedIntent(intent: NormalizedPaymentIntentInput): bigint {
  if (intent.chainId !== ARC_CHAIN_ID) {
    throw new ReceiptError(
      "UNSUPPORTED_CHAIN",
      `Only ${ARC_NETWORK_NAME} payment intents are supported.`,
    );
  }
  if (!sameAddress(intent.tokenAddress, ARC_USDC_ADDRESS)) {
    throw new ReceiptError(
      "UNSUPPORTED_TOKEN",
      `Only ${ARC_NETWORK_NAME} USDC payment intents are supported.`,
    );
  }
  if (/^0x0{40}$/i.test(intent.vendorAddress)) {
    // executeUSDC reverts on a zero recipient before the policy is consulted.
    throw new ReceiptError("INVALID_RECIPIENT", "Vendor address must not be the zero address.");
  }

  const amount = parsePaymentIntentAmount(intent.amount);
  if (amount === null) {
    throw new ReceiptError(
      "INVALID_AMOUNT",
      "Amount must be greater than zero with up to 6 decimals.",
    );
  }
  return amount;
}

/**
 * Read the wallet exactly as `executeUSDC` would see it at one block. The
 * block is fixed first and every read is pinned to it, so the snapshot cannot
 * straddle a policy update or a spend that lands between two calls.
 */
export async function readPinnedWalletState(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
): Promise<PinnedWalletState> {
  try {
    return await readWalletStateAtLatestBlock(publicClient, intent);
  } catch (error) {
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Unable to read governed wallet policy state on ${ARC_NETWORK_NAME}.`,
      { cause: error },
    );
  }
}

/**
 * Reads are pinned by block number, which is all `eth_call` accepts, so once
 * every pinned read is done the block is fetched again by number: if its hash
 * is no longer the one about to be signed, the chain replaced that block
 * underneath the reads and the snapshot is discarded rather than attested.
 */
export async function confirmPinnedBlock(
  publicClient: PublicClient,
  block: PinnedBlock,
): Promise<void> {
  let confirmedHash: Hex;
  try {
    confirmedHash = (await publicClient.getBlock({ blockNumber: block.number })).hash;
  } catch (error) {
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Unable to confirm block ${block.number} on ${ARC_NETWORK_NAME} after evaluating the intent.`,
      { cause: error },
    );
  }
  if (confirmedHash.toLowerCase() !== block.hash.toLowerCase()) {
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Block ${block.number} was replaced on ${ARC_NETWORK_NAME} while the intent was being evaluated. Retry the request.`,
    );
  }
}

async function readWalletStateAtLatestBlock(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
): Promise<PinnedWalletState> {
  const wallet = intent.governedWalletAddress;
  const latest = await publicClient.getBlock({ blockTag: "latest" });
  const block: PinnedBlock = {
    number: latest.number,
    hash: latest.hash,
    timestamp: latest.timestamp,
  };
  const guardedWallet = {
    address: wallet,
    abi: GuardedWalletAbi,
    blockNumber: block.number,
  } as const;

  const [
    walletToken,
    signerAuthorized,
    frozen,
    policy,
    policyVersion,
    dailySpent,
    monthlySpent,
    spendDay,
    spendMonth,
    policyEngine,
    vendorRegistry,
    escalationManager,
  ] = await Promise.all([
    publicClient.readContract({ ...guardedWallet, functionName: "usdc" }),
    publicClient.readContract({
      ...guardedWallet,
      functionName: "agentSigners",
      args: [intent.agentSignerAddress],
    }),
    publicClient.readContract({ ...guardedWallet, functionName: "frozen" }),
    publicClient.readContract({ ...guardedWallet, functionName: "policy" }),
    publicClient.readContract({ ...guardedWallet, functionName: "policyVersion" }),
    publicClient.readContract({ ...guardedWallet, functionName: "dailySpent" }),
    publicClient.readContract({ ...guardedWallet, functionName: "monthlySpent" }),
    publicClient.readContract({ ...guardedWallet, functionName: "spendDay" }),
    publicClient.readContract({ ...guardedWallet, functionName: "spendMonth" }),
    publicClient.readContract({ ...guardedWallet, functionName: "policyEngine" }),
    publicClient.readContract({ ...guardedWallet, functionName: "vendorRegistry" }),
    publicClient.readContract({ ...guardedWallet, functionName: "escalationManager" }),
  ]);

  const [vendor, usdcBalance] = await Promise.all([
    publicClient.readContract({
      address: vendorRegistry,
      abi: VendorRegistryAbi,
      functionName: "getVendorFor",
      args: [wallet, intent.vendorAddress],
      blockNumber: block.number,
    }),
    publicClient.readContract({
      address: walletToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [wallet],
      blockNumber: block.number,
    }),
  ]);

  return {
    block,
    walletToken,
    signerAuthorized,
    frozen,
    policy: {
      perTxCap: policy[0],
      daily24hCap: policy[1],
      monthlyCap: policy[2],
      allowedCategories: policy[3],
      escalationThreshold: policy[4],
      requireAllowlist: policy[5],
      freezeOnBlockedVendor: policy[6],
    },
    policyVersion,
    policyEngine,
    vendorRegistry,
    escalationManager,
    vendor: {
      allowed: vendor.allowed,
      blocked: vendor.blocked,
      category: Number(vendor.category),
      perVendorCap: vendor.perVendorCap,
    },
    spend: rollSpendWindow({ spendDay, spendMonth, dailySpent, monthlySpent }, block.timestamp),
    usdcBalance,
  };
}

/**
 * Apply `GuardedWallet._rollSpendWindow` to the stored counters at the block's
 * timestamp. Counters left over from a previous window would otherwise make a
 * payment look capped when the contract would reset them before evaluating.
 */
export function rollSpendWindow(
  stored: Readonly<{
    spendDay: bigint;
    spendMonth: bigint;
    dailySpent: bigint;
    monthlySpent: bigint;
  }>,
  blockTimestamp: bigint,
): SpendWindowState {
  const blockDay = blockTimestamp / DAY_WINDOW;
  const blockMonth = blockTimestamp / MONTH_WINDOW;
  return {
    ...stored,
    blockDay,
    blockMonth,
    effectiveDailySpent: blockDay === stored.spendDay ? stored.dailySpent : 0n,
    effectiveMonthlySpent: blockMonth === stored.spendMonth ? stored.monthlySpent : 0n,
  };
}

/**
 * Ask the wallet's policy engine for its verdict, at the same pinned block and
 * with the same inputs `executeUSDC` would pass. The wallet's own guards
 * (`onlySigner`, `notFrozen`) come first, exactly as they do onchain.
 */
export async function evaluatePinnedDecision(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
  amount: bigint,
  state: PinnedWalletState,
): Promise<PinnedDecision> {
  if (!state.signerAuthorized) {
    return {
      verdict: "deny",
      reasonCode: "AGENT_NOT_AUTHORIZED",
      explanation: "The agent signer is not authorized for this governed wallet.",
    };
  }
  if (state.frozen) {
    return {
      verdict: "freeze",
      reasonCode: "WALLET_FROZEN",
      explanation: "The governed wallet is frozen; no agent payment can execute.",
    };
  }

  let outcome: readonly [number, number];
  try {
    outcome = await publicClient.readContract({
      account: intent.governedWalletAddress,
      address: state.policyEngine,
      abi: PolicyEngineAbi,
      functionName: "evaluate",
      args: [
        state.policy,
        intent.vendorAddress,
        amount,
        state.spend.effectiveDailySpent,
        state.spend.effectiveMonthlySpent,
        state.vendorRegistry,
      ],
      blockNumber: state.block.number,
    });
  } catch (error) {
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Unable to evaluate the policy engine on ${ARC_NETWORK_NAME}.`,
      { cause: error },
    );
  }

  const [verdictIndex, reasonIndex] = outcome;
  const verdict = VERDICTS[verdictIndex];
  const reasonCode = ESCALATION_REASONS[reasonIndex];
  if (!verdict || !reasonCode) {
    // A verdict this build cannot name must not be attested as something else.
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `The policy engine returned verdict ${verdictIndex} / reason ${reasonIndex}, which this build does not recognise.`,
    );
  }

  return { verdict, reasonCode, explanation: explainDecision(verdict, reasonCode) };
}

export async function evaluatePaymentIntentAtBlock(
  publicClient: PublicClient,
  intent: NormalizedPaymentIntentInput,
): Promise<PinnedEvaluation> {
  const amount = requireSupportedIntent(intent);
  const state = await readPinnedWalletState(publicClient, intent);

  if (!sameAddress(state.walletToken, ARC_USDC_ADDRESS)) {
    throw new ReceiptError(
      "UNSUPPORTED_WALLET_TOKEN",
      `GuardedWallet is not configured for ${ARC_NETWORK_NAME} USDC.`,
    );
  }

  const decision = await evaluatePinnedDecision(publicClient, intent, amount, state);
  // The policy call above is the last pinned read; confirm the block after it.
  await confirmPinnedBlock(publicClient, state.block);
  return { amount, state, decision, evaluatedAt: new Date() };
}

export function explainDecision(verdict: PaymentReceiptVerdict, reasonCode: string): string {
  switch (reasonCode) {
    case "NONE":
      return verdict === "allow"
        ? "Within the per-transaction, daily and monthly caps; the vendor is permitted."
        : `The policy engine returned ${verdict} without a reason code.`;
    case "ALLOWLIST_REQUIRED":
      return "The policy requires an allowlisted vendor and this vendor is not allowlisted.";
    case "PER_TX_CAP":
      return "The amount exceeds the per-transaction cap.";
    case "DAILY_CAP":
      return "The amount would exceed the rolling daily cap.";
    case "MONTHLY_CAP":
      return "The amount would exceed the rolling monthly cap.";
    case "ESCALATION_THRESHOLD":
      return "The amount is above the escalation threshold, so it requires council approval.";
    case "BLOCKED_VENDOR":
      return verdict === "freeze"
        ? "The vendor is blocked and the policy freezes the wallet on blocked-vendor attempts."
        : "The vendor is blocked for this wallet.";
    case "CATEGORY_DISABLED":
      return "The vendor's category is not enabled by the policy.";
    case "PER_VENDOR_CAP":
      return "The amount exceeds the per-payment cap.";
    default:
      return `Policy engine reason ${reasonCode}.`;
  }
}

/** EIP-191 check of the agent signer's signature over the canonical intent message. */
export async function verifyPaymentIntentSignature(
  intent: NormalizedSignedPaymentIntentInput,
): Promise<boolean> {
  try {
    return await verifyMessage({
      address: intent.agentSignerAddress,
      message: createPaymentIntentMessage(intent),
      signature: intent.signature,
    });
  } catch {
    // Malformed signatures are expected user input and verify as invalid.
    return false;
  }
}

export function parsePaymentIntentAmount(amount: string): bigint | null {
  try {
    const parsed = parseUnits(amount, 6);
    return parsed > 0n ? parsed : null;
  } catch {
    // Invalid decimal input is reported as INVALID_AMOUNT by the caller.
    return null;
  }
}

export function sameAddress(a: Address | string, b: Address | string) {
  return a.toLowerCase() === b.toLowerCase();
}
