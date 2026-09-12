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
 * transfer. The transaction acts on that inspected receipt, not on a second
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
 *   ARC_TESTNET_RPC     optional RPC override
 *
 * Every receipt envelope is written to demo-output/<receiptId>.json so it can
 * be pasted into /verify, and altered for the tamper test.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type LocalAccount, getAddress } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

import {
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  arcTestnet,
} from "../packages/sdk/src/chains";
import { circleWalletAccount } from "../packages/sdk/src/circle";
import {
  ArcanumClient,
  type PaymentIntentInput,
  type PaymentReceiptEnvelope,
  TransferRevertedError,
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

function client(signer: LocalAccount): ArcanumClient {
  return new ArcanumClient({
    walletAddress: hexEnv("GUARDED_WALLET"),
    agentSigner: signer,
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
  const signer = agentSigner();
  const arcanum = client(signer);
  const intent = intentFor(scenario, signer.address);
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
    throw new ScenarioMismatch("this reference already had a receipt; nothing was sent onchain");
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
    const execution = await arcanum.executeUSDC({
      to: getAddress(request.vendorAddress),
      amount: BigInt(amountBaseUnits),
      reason: request.purpose,
      metadata: {
        reference: request.reference,
        tokenSymbol: request.tokenSymbol ?? "USDC",
        receiptId,
      },
    });
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
