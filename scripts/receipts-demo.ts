/**
 * Arc Testnet demo runner for payment decision receipts.
 *
 * Drives the SDK the way an agent runtime would, against a deployed Arcanum
 * API, and prints what to open in the dashboard afterwards. It is the
 * "agent runtime" step of the walkthrough in docs/PAYMENT-RECEIPTS.md.
 *
 *   npx tsx scripts/receipts-demo.ts allow              receipt only, nothing onchain
 *   npx tsx scripts/receipts-demo.ts allow --execute --reference invoice-123
 *   npx tsx scripts/receipts-demo.ts deny               receipt only (--execute is refused)
 *   npx tsx scripts/receipts-demo.ts escalate --execute --reference invoice-456
 *   npx tsx scripts/receipts-demo.ts all               receipt-only scenarios
 *   npx tsx scripts/receipts-demo.ts recover --reference invoice-123
 *                                                        read-only same-hash reconciliation
 *   npx tsx scripts/receipts-demo.ts link <receiptId> <txHash>
 *                                                        re-post a hold's tx after the council
 *                                                        decided, to record escalation/<status>
 *
 * With --execute the receipt is requested and shown first, and the payment is
 * sent only when that receipt is newly issued and its verdict is the one the
 * scenario expects. A different verdict stops the run with exit code 1, so a
 * deny scenario never submits. Policy can change before mining; the mined
 * outcome, not the receipt's preflight, is reported. The transaction acts on
 * that inspected receipt, not on a second
 * request: its recipient and amount come from the receipt body and its id
 * travels in the executeUSDC reason bytes, the same way the SDK's
 * executePaymentIntentWithReceipt sends it.
 *
 * Environment:
 *   AGENT_PRIVATE_KEY   agent signer authorized on the governed wallet (never commit it)
 *   CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET, CIRCLE_WALLET_ID, CIRCLE_WALLET_ADDRESS
 *                       set all four to sign with a Circle developer-controlled wallet
 *                       instead of AGENT_PRIVATE_KEY (see docs/CIRCLE-WALLETS.md);
 *                       a partial set is an error, never a silent fallback
 *   GUARDED_WALLET      the governed wallet address
 *   VENDOR_ALLOWED      a vendor the policy permits
 *   VENDOR_DENIED       a vendor the policy refuses (default: a fresh random address)
 *   AMOUNT_ALLOW        USDC amount inside the per-transaction cap (default "1")
 *   AMOUNT_ESCALATE     USDC amount above the escalation threshold (default "50")
 *   AMOUNT_DENY         USDC amount for the denied request (default "1")
 *   ARCANUM_API_URL     default https://thearcanum.in
 *   ARC_NETWORK         testnet (default) or mainnet; must match the API the
 *                       script talks to, and on mainnet the amounts are real USDC
 *   ARC_RPC_URL         optional RPC override (ARC_TESTNET_RPC is honoured on testnet only)
 *
 * Every receipt envelope is written to demo-output/<receiptId>.json so it can
 * be pasted into /verify, and altered for the tamper test.
 * Keep demo-output on durable shared storage for every process using this CLI.
 * An unresolved execution blocks new references for the same chain/wallet.
 * Do not delete journals/markers to retry. A crash before hash persistence (or
 * during a filesystem critical section) requires operator investigation.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type LocalAccount, getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  ARC_RPC_URL,
  ARC_USDC_ADDRESS,
  IS_ARC_MAINNET,
  arcChain,
} from "../packages/sdk/src/chains";
import { circleWalletAccount } from "../packages/sdk/src/circle";
import {
  ArcanumClient,
  type PaymentIntentInput,
  type PaymentReceiptEnvelope,
  TransactionRecoveryError,
  TransferRevertedError,
  verifyPaymentReceipt,
} from "../packages/sdk/src/index";
import {
  assertReceiptExecutionAvailable,
  executeReceiptJournaled,
  readReceiptExecution,
  recoverReceiptExecution,
  requestedReceiptReference,
} from "./lib/receipt-execution";

type Scenario = "allow" | "deny" | "escalate";

const SCENARIOS: readonly Scenario[] = ["allow", "deny", "escalate"];
const OUTPUT_DIR = "demo-output";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Set ${name} before running the demo.`);
  }
  return value;
}

function hexEnv(name: string): `0x${string}` {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed hex value.`);
  }
  return value as `0x${string}`;
}

function isScenario(value: string | undefined): value is Scenario {
  return SCENARIOS.includes(value as Scenario);
}

const CIRCLE_ENV = [
  "CIRCLE_API_KEY",
  "CIRCLE_ENTITY_SECRET",
  "CIRCLE_WALLET_ID",
  "CIRCLE_WALLET_ADDRESS",
] as const;

/**
 * The agent signer: a Circle developer-controlled wallet when all four
 * CIRCLE_* variables are set, otherwise the AGENT_PRIVATE_KEY account. Half a
 * Circle configuration is a mistake, so it stops the run instead of quietly
 * signing with the private key.
 */
function agentSigner(): LocalAccount {
  const configured = CIRCLE_ENV.filter((name) => process.env[name]?.trim());
  if (configured.length === 0) {
    return privateKeyToAccount(hexEnv("AGENT_PRIVATE_KEY"));
  }
  if (configured.length !== CIRCLE_ENV.length) {
    const missing = CIRCLE_ENV.filter((name) => !configured.includes(name));
    throw new Error(`Circle signer is half configured; also set ${missing.join(", ")}.`);
  }
  return circleWalletAccount({
    apiKey: requireEnv("CIRCLE_API_KEY"),
    entitySecret: requireEnv("CIRCLE_ENTITY_SECRET"),
    walletId: requireEnv("CIRCLE_WALLET_ID"),
    address: hexEnv("CIRCLE_WALLET_ADDRESS"),
  });
}

// The network switch (ARC_NETWORK) picks the chain, the default RPC and the
// USDC address together, so the receipt the API pins and the transaction that
// acts on it can never be on different chains. A testnet-only RPC override is
// ignored on mainnet rather than pointing a mainnet run at testnet reads.
function rpcUrl(): string {
  const override = process.env.ARC_RPC_URL?.trim();
  if (override) return override;
  if (!IS_ARC_MAINNET) {
    const legacy = process.env.ARC_TESTNET_RPC?.trim();
    if (legacy) return legacy;
  }
  return ARC_RPC_URL;
}

function client(signer?: LocalAccount): ArcanumClient {
  return new ArcanumClient({
    walletAddress: hexEnv("GUARDED_WALLET"),
    agentSigner: signer,
    chain: arcChain,
    rpcUrl: rpcUrl(),
    apiUrl: process.env.ARCANUM_API_URL?.trim() || "https://thearcanum.in",
  });
}

function intentFor(
  scenario: Scenario,
  agentSignerAddress: `0x${string}`,
  reference?: string,
): PaymentIntentInput {
  const vendor = {
    allow: () => hexEnv("VENDOR_ALLOWED"),
    escalate: () => hexEnv("VENDOR_ALLOWED"),
    deny: () =>
      process.env.VENDOR_DENIED?.trim()
        ? hexEnv("VENDOR_DENIED")
        : privateKeyToAccount(generatePrivateKey()).address,
  }[scenario]();
  const amount = {
    allow: process.env.AMOUNT_ALLOW?.trim() || "1",
    escalate: process.env.AMOUNT_ESCALATE?.trim() || "50",
    deny: process.env.AMOUNT_DENY?.trim() || "1",
  }[scenario];
  const purpose = {
    allow: "Monthly API quota (demo, expected allow)",
    escalate: "Annual data licence (demo, expected escalate)",
    deny: "Unlisted vendor invoice (demo, expected deny)",
  }[scenario];

  return {
    governedWalletAddress: hexEnv("GUARDED_WALLET"),
    agentSignerAddress,
    vendorAddress: vendor,
    tokenAddress: ARC_USDC_ADDRESS,
    tokenSymbol: "USDC",
    amount,
    purpose,
    // Stable receipt reference, NOT onchain payment idempotency.
    // --execute requires an explicit operator-supplied business reference.
    reference: reference ?? `ethonline-demo-${scenario}`,
  };
}

function saveEnvelope(envelope: PaymentReceiptEnvelope): string {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const file = join(OUTPUT_DIR, `${envelope.receipt.receiptId}.json`);
  writeFileSync(file, `${JSON.stringify(envelope, null, 2)}\n`);
  return file;
}

async function describe(envelope: PaymentReceiptEnvelope, replayed: boolean): Promise<void> {
  const { receipt } = envelope;
  const verification = await verifyPaymentReceipt(envelope);
  const apiUrl = process.env.ARCANUM_API_URL?.trim() || "https://thearcanum.in";
  console.log(`receipt     ${receipt.receiptId}${replayed ? " (replayed)" : ""}`);
  console.log(`verdict     ${receipt.decision.verdict} / ${receipt.decision.reasonCode}`);
  console.log(`explanation ${receipt.decision.explanation}`);
  console.log(`block       ${receipt.evaluation.blockNumber} ${receipt.evaluation.blockHash}`);
  console.log(`digest      ${envelope.receiptDigest}`);
  console.log(
    `offline     ok=${verification.ok} issuer=${verification.issuer.status} request=${verification.request.status}`,
  );
  console.log(`saved       ${saveEnvelope(envelope)}`);
  console.log(`dashboard   ${apiUrl}/receipts/${receipt.receiptId}`);
}

class ScenarioMismatch extends Error {}

async function runScenario(
  scenario: Scenario,
  execute: boolean,
  reference?: string,
): Promise<void> {
  if (execute && scenario === "deny") {
    throw new Error("The deny scenario is receipt-only; run it without --execute.");
  }
  if (execute) {
    if (!reference) throw new Error("--execute requires --reference.");
    assertReceiptExecutionAvailable(
      {
        chainId: arcChain.id,
        walletAddress: hexEnv("GUARDED_WALLET"),
        reference,
      },
      OUTPUT_DIR,
    );
  }
  const signer = agentSigner();
  const arcanum = client(signer);
  const intent = intentFor(scenario, signer.address, reference);
  console.log(`\n== ${scenario}${execute ? " (execute)" : ""}`);
  console.log(
    `signer      ${signer.address}${signer.source === "custom" ? " (Circle wallet)" : ""}`,
  );
  console.log(`vendor      ${intent.vendorAddress}`);
  console.log(`amount      ${intent.amount} USDC`);
  console.log(`reference   ${intent.reference}`);

  const { receipt, replayed } = await arcanum.requestPaymentReceipt(intent);
  await describe(receipt, replayed);
  const verdict = receipt.receipt.decision.verdict;
  if (verdict !== scenario) {
    const advice = execute ? "nothing was sent onchain" : "adjust the vendor or amount";
    const message = `the policy answered ${verdict}, not ${scenario}; ${advice}`;
    if (execute) {
      throw new ScenarioMismatch(message);
    }
    console.log(`note        ${message}`);
    return;
  }
  if (!execute) {
    return;
  }
  if (replayed) {
    throw new ScenarioMismatch(
      "This reference already had a receipt; this invocation did not submit. Investigate the earlier attempt; do not change the reference to retry.",
    );
  }

  const txHash = await executeInspected(arcanum, receipt);
  if (!txHash) {
    console.log("tx          none; nothing reached the chain");
    return;
  }
  console.log(`tx          ${txHash}`);
  try {
    const attached = await arcanum.attachPaymentReceiptEvidence(receipt.receipt.receiptId, txHash);
    for (const row of attached.evidence) {
      console.log(`evidence    ${row.kind}/${row.outcome} ${row.txHash ?? ""}`);
    }
  } catch (error) {
    console.log(
      `evidence    NOT LINKED: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.log("            rerun as: link <receiptId> <txHash>");
  }
}

/**
 * Sends the payment the inspected receipt describes. Requesting again through
 * executePaymentIntentWithReceipt would act on whatever the second response
 * says, so the checks above would no longer cover the transaction.
 */
async function executeInspected(
  arcanum: ArcanumClient,
  envelope: PaymentReceiptEnvelope,
): Promise<`0x${string}` | undefined> {
  const { receiptId, request, amountBaseUnits } = envelope.receipt;
  try {
    const execution = await executeReceiptJournaled(
      arcanum,
      {
        chainId: arcChain.id,
        walletAddress: arcanum.walletAddress,
        reference: request.reference,
      },
      receiptId,
      {
        to: getAddress(request.vendorAddress),
        amount: BigInt(amountBaseUnits),
        reason: request.purpose,
        metadata: {
          reference: request.reference,
          tokenSymbol: request.tokenSymbol ?? "USDC",
          receiptId,
        },
      },
      OUTPUT_DIR,
    );
    const detail = execution.error ? ` ${execution.error.message}` : "";
    console.log(`execution   ${execution.verdict.toLowerCase()}${detail}`);
    if (execution.escalationId) {
      console.log(`escalation  ${execution.escalationId}`);
    }
    return execution.txHash;
  } catch (error) {
    if (error instanceof TransferRevertedError) {
      // The call reached the chain and reverted; the revert is evidence too.
      console.log(`execution   reverted ${error.reason ?? error.message}`);
      return error.txHash;
    }
    throw error;
  }
}

async function link(receiptId: string, txHash: string): Promise<void> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("txHash must be a 32-byte hex hash.");
  }
  const attached = await client(agentSigner()).attachPaymentReceiptEvidence(
    receiptId,
    txHash as `0x${string}`,
  );
  console.log(`receipt     ${attached.receiptId}`);
  for (const row of attached.evidence) {
    console.log(`evidence    ${row.kind}/${row.outcome} ${row.txHash ?? ""} ${row.observedAt}`);
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const execute = rest.includes("--execute");
  if (command === "recover") {
    if (execute) throw new Error("recover is read-only; --execute is forbidden.");
    const reference = requestedReceiptReference(rest, true);
    if (!reference) throw new Error("recover requires --reference.");
    const identity = {
      chainId: arcChain.id,
      walletAddress: hexEnv("GUARDED_WALLET"),
      reference,
    };
    const saved = readReceiptExecution(identity, OUTPUT_DIR);
    try {
      // No agentSigner() call: recovery does not need private keys or Circle credentials.
      const result = await recoverReceiptExecution(client(), identity, OUTPUT_DIR);
      console.log(`recovered   ${result.verdict.toLowerCase()} ${result.txHash}`);
      if (result.escalationId) console.log(`escalation  ${result.escalationId}`);
    } catch (error) {
      if (!(error instanceof TransferRevertedError)) throw error;
      console.log(`recovered   reverted ${error.txHash}`);
    }
    console.log(`evidence    attach separately: link ${saved.receiptId} ${saved.txHash}`);
    return;
  }

  if (command === "link") {
    if (execute) throw new Error("link only attaches evidence; --execute is forbidden.");
    const [receiptId, txHash] = rest.filter((arg) => !arg.startsWith("--"));
    if (!receiptId || !txHash) {
      throw new Error("Usage: link <receiptId> <txHash>");
    }
    await link(receiptId, txHash);
    return;
  }
  if (command === "all") {
    if (execute) {
      throw new Error("Execute one scenario at a time with --reference; all is read-only.");
    }
    for (const scenario of SCENARIOS) {
      await runScenario(scenario, false);
    }
    return;
  }
  if (!isScenario(command)) {
    throw new Error(
      "Usage: receipts-demo.ts <allow|deny|escalate> [--execute --reference <stable-ref>] | all | recover --reference <stable-ref> | link <receiptId> <txHash>",
    );
  }
  await runScenario(command, execute, requestedReceiptReference(rest, execute));
}

main().catch((error: unknown) => {
  if (error instanceof TransactionRecoveryError) {
    console.error(`\nexecution unresolved: ${error.code}; tx ${error.txHash}`);
    console.error(error.message);
    console.error(
      "Keep demo-output intact. Run recover --reference <original-reference> on the same wallet/network. Never rerun --execute or change the reference to recover.",
    );
    process.exitCode = 1;
    return;
  }
  if (error instanceof ScenarioMismatch) {
    console.error(`\nstopped: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? `${error.code}: `
      : "";
  console.error(`\ndemo failed: ${code}${message}`);
  process.exitCode = 1;
});
