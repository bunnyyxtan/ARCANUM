#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
const ARC_TESTNET_USDC = "0x3600000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(scriptDir, "..");
const manifestPath = path.join(contractsDir, "deployments", "arc-testnet.json");
const requiredEnv = [
  "ARC_TESTNET_RPC",
  "DEPLOYER_PRIVATE_KEY",
  "ARC_PROTOCOL_ADMIN",
  "ANOMALY_ORACLE_SIGNER_ADDRESS",
];

const args = process.argv.slice(2);
const unknownArgs = args.filter((argument) => argument !== "--allow-redeploy");
if (unknownArgs.length > 0) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  console.error("Usage: node scripts/check-arc-deploy-readiness.mjs [--allow-redeploy]");
  process.exit(1);
}
const allowRedeploy = args.includes("--allow-redeploy");

function isValidNonZeroAddress(value) {
  return ADDRESS_PATTERN.test(value ?? "") && value?.toLowerCase() !== ZERO_ADDRESS;
}

function readManifest() {
  if (!existsSync(manifestPath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot parse ${manifestPath}`, { cause: error });
  }
}

async function codeAt(rpcUrl, address) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getCode",
      params: [address, "latest"],
    }),
  });
  if (!response.ok) {
    throw new Error(`eth_getCode ${address}: RPC returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`eth_getCode ${address}: ${payload.error.message ?? "unknown RPC error"}`);
  }
  if (typeof payload.result !== "string") {
    throw new Error(`eth_getCode ${address}: RPC response did not contain bytecode`);
  }
  return payload.result;
}

function requireCode(label, code) {
  if (code === "0x" || code === "0x0" || /^0x0+$/.test(code)) {
    throw new Error(`${label} has no code on the target RPC`);
  }
}

const localIssues = [];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    localIssues.push(`${key} is required`);
  }
}

for (const key of ["ARC_PROTOCOL_ADMIN", "ANOMALY_ORACLE_SIGNER_ADDRESS"]) {
  const value = process.env[key];
  if (value && !isValidNonZeroAddress(value)) {
    localIssues.push(`${key} must be a valid non-zero address`);
  }
}

const maxScoreAge = process.env.ANOMALY_MAX_SCORE_AGE_SECONDS;
if (maxScoreAge && (!/^[1-9]\d*$/.test(maxScoreAge) || BigInt(maxScoreAge) === 0n)) {
  localIssues.push("ANOMALY_MAX_SCORE_AGE_SECONDS must be a positive integer when set");
}

let manifest;
try {
  manifest = readManifest();
} catch (error) {
  localIssues.push(error instanceof Error ? error.message : String(error));
}
if (manifest?.codeHashes && !allowRedeploy) {
  localIssues.push(
    "arc-testnet manifest already contains v2 codeHashes; pass --allow-redeploy only for an intentional replacement",
  );
}

if (localIssues.length > 0) {
  console.error("Arc Testnet deploy readiness failed:");
  for (const issue of localIssues) {
    console.error(`- ${issue}`);
  }
  process.exit(1);
}

let deployer;
try {
  deployer = execFileSync(
    "cast",
    ["wallet", "address", "--private-key", process.env.DEPLOYER_PRIVATE_KEY],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
} catch (error) {
  const detail =
    error instanceof Error && "stderr" in error && error.stderr
      ? String(error.stderr).trim()
      : "cast could not derive the deployer address";
  console.error(`Arc Testnet deploy readiness failed: invalid DEPLOYER_PRIVATE_KEY (${detail})`);
  process.exit(1);
}

for (const key of ["ARC_PROTOCOL_ADMIN", "ANOMALY_ORACLE_SIGNER_ADDRESS"]) {
  if (process.env[key].toLowerCase() === deployer.toLowerCase()) {
    console.error(`Arc Testnet deploy readiness failed: ${key} must differ from the deployer`);
    process.exit(1);
  }
}

try {
  const [create2Code, usdcCode] = await Promise.all([
    codeAt(process.env.ARC_TESTNET_RPC, CREATE2_DEPLOYER),
    codeAt(process.env.ARC_TESTNET_RPC, ARC_TESTNET_USDC),
  ]);
  requireCode(`deterministic CREATE2 deployer ${CREATE2_DEPLOYER}`, create2Code);
  requireCode(`Arc Testnet USDC ${ARC_TESTNET_USDC}`, usdcCode);
} catch (error) {
  console.error(
    `Arc Testnet deploy readiness failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

console.log("Arc Testnet deploy readiness passed:");
console.log(`- deployer: ${deployer}`);
console.log(`- protocol admin: ${process.env.ARC_PROTOCOL_ADMIN}`);
console.log(`- anomaly oracle signer: ${process.env.ANOMALY_ORACLE_SIGNER_ADDRESS}`);
console.log(`- deterministic CREATE2 deployer: ${CREATE2_DEPLOYER}`);
console.log(`- USDC: ${ARC_TESTNET_USDC}`);
