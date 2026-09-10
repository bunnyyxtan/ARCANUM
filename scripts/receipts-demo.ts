/**
 * Arc Testnet demo runner for payment decision receipts.
 *
 * Drives the SDK the way an agent runtime would, against a deployed Arcanum
 * API, and prints what to open in the dashboard afterwards. It is the
 * "agent runtime" step of the walkthrough in docs/PAYMENT-RECEIPTS.md.
 *
 *   npx tsx scripts/receipts-demo.ts allow              receipt only, nothing onchain
 *   npx tsx scripts/receipts-demo.ts allow --execute    receipt, then executeUSDC, evidence link
 *   npx tsx scripts/receipts-demo.ts deny               receipt only (--execute is refused)
 *   npx tsx scripts/receipts-demo.ts escalate --execute receipt, then onchain hold, evidence link
 *   npx tsx scripts/receipts-demo.ts all [--execute]    the three above; deny stays receipt-only
 *   npx tsx scripts/receipts-demo.ts link <receiptId> <txHash>
 *                                                        re-post a hold's tx after the council
 *                                                        decided, to record escalation/<status>
 *
 * With --execute the receipt is requested and shown first, and the payment is
 * sent only when that receipt is newly issued and its verdict is the one the
 * scenario expects. A different verdict stops the run with exit code 1, so a
 * misconfigured policy can never turn the deny or escalate scenario into a
 * transfer.
 *
 * Environment:
 *   AGENT_PRIVATE_KEY   agent signer authorized on the governed wallet (never commit it)
 *   GUARDED_WALLET      the governed wallet address
 *   VENDOR_ALLOWED      a vendor the policy permits
 *   VENDOR_DENIED       a vendor the policy refuses (default: a fresh random address)
 *   AMOUNT_ALLOW        USDC amount inside the per-transaction cap (default "1")
 *   AMOUNT_ESCALATE     USDC amount above the escalation threshold (default "50")
 *   AMOUNT_DENY         USDC amount for the denied request (default "1")
 *   ARCANUM_API_URL     default https://thearcanum.in
 *   ARC_TESTNET_RPC     optional RPC override
 *
 * Every receipt envelope is written to demo-output/<receiptId>.json so it can
 * be pasted into /verify, and altered for the tamper test.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  arcTestnet,
} from "../packages/sdk/src/chains";
import {
  ArcanumClient,
  type PaymentIntentInput,
  type PaymentReceiptEnvelope,
  verifyPaymentReceipt,
} from "../packages/sdk/src/index";

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

function client(): ArcanumClient {
  return new ArcanumClient({
    walletAddress: hexEnv("GUARDED_WALLET"),
    agentSigner: privateKeyToAccount(hexEnv("AGENT_PRIVATE_KEY")),
    chain: arcTestnet,
    rpcUrl: process.env.ARC_TESTNET_RPC?.trim() || ARC_TESTNET_RPC_URL,
    apiUrl: process.env.ARCANUM_API_URL?.trim() || "https://thearcanum.in",
  });
}

function intentFor(scenario: Scenario, agentSignerAddress: `0x${string}`): PaymentIntentInput {
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
    tokenAddress: ARC_TESTNET_USDC_ADDRESS,
    tokenSymbol: "USDC",
    amount,
    purpose,
    // Fresh per run: the reference is the idempotency key, and a reused one
    // returns the earlier receipt instead of a new decision.
    reference: `ethonline-demo-${scenario}-${new Date().toISOString().replace(/[:.]/g, "-")}`,
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

async function runScenario(scenario: Scenario, execute: boolean): Promise<void> {
  if (execute && scenario === "deny") {
    throw new Error("The deny scenario is receipt-only; run it without --execute.");
  }
  const arcanum = client();
  const intent = intentFor(scenario, privateKeyToAccount(hexEnv("AGENT_PRIVATE_KEY")).address);
  console.log(`\n== ${scenario}${execute ? " (execute)" : ""}`);
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
    throw new ScenarioMismatch("this reference already had a receipt; nothing was sent onchain");
  }

  // The receipt above is the one being acted on: same reference, inspected,
  // newly issued and never executed, which is the documented reason to allow
  // the replay.
  const outcome = await arcanum.executePaymentIntentWithReceipt(intent, {
    executeReplayedReceipt: true,
  });
  if (outcome.receipt.receipt.receiptId !== receipt.receipt.receiptId) {
    console.log(`receipt     ${outcome.receipt.receipt.receiptId} (acted on)`);
  }
  console.log(`execution   ${outcome.result.decision} ${outcome.result.reason}`);
  if (outcome.result.txHash) {
    console.log(`tx          ${outcome.result.txHash}`);
  }
  if (outcome.result.escalationId) {
    console.log(`escalation  ${outcome.result.escalationId}`);
  }
  if (outcome.evidence) {
    for (const row of outcome.evidence) {
      console.log(`evidence    ${row.kind}/${row.outcome} ${row.txHash ?? ""}`);
    }
  }
  if (outcome.evidenceError) {
    console.log(`evidence    NOT LINKED: ${outcome.evidenceError.message}`);
    console.log("            rerun as: link <receiptId> <txHash>");
  }
}

async function link(receiptId: string, txHash: string): Promise<void> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    throw new Error("txHash must be a 32-byte hex hash.");
  }
  const attached = await client().attachPaymentReceiptEvidence(receiptId, txHash as `0x${string}`);
  console.log(`receipt     ${attached.receiptId}`);
  for (const row of attached.evidence) {
    console.log(`evidence    ${row.kind}/${row.outcome} ${row.txHash ?? ""} ${row.observedAt}`);
  }
}

async function main(): Promise<void> {
  const [command, ...rest] = process.argv.slice(2);
  const execute = rest.includes("--execute");

  if (command === "link") {
    const [receiptId, txHash] = rest.filter((arg) => !arg.startsWith("--"));
    if (!receiptId || !txHash) {
      throw new Error("Usage: link <receiptId> <txHash>");
    }
    await link(receiptId, txHash);
    return;
  }
  if (command === "all") {
    for (const scenario of SCENARIOS) {
      await runScenario(scenario, execute && scenario !== "deny");
    }
    return;
  }
  if (!isScenario(command)) {
    throw new Error(
      "Usage: receipts-demo.ts <allow|deny|escalate|all> [--execute] | link <receiptId> <txHash>",
    );
  }
  await runScenario(command, execute);
}

main().catch((error: unknown) => {
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
