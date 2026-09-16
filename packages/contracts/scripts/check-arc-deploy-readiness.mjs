#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CREATE2_DEPLOYER = "0x4e59b44847b379578588920cA78FbF26c0B4956C";
// USDC is the native asset on both Arc networks; this precompile is its ERC-20 view.
const ARC_USDC = "0x3600000000000000000000000000000000000000";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

// Per-network inputs. The mainnet deploy script additionally requires
// ARC_MAINNET_CHAIN_ID and ARC_MAINNET_USDC_ADDRESS so the operator confirms
// the target chain twice; the readiness check verifies them against the RPC.
const NETWORKS = {
  testnet: {
    label: "Arc Testnet",
    manifest: "arc-testnet.json",
    rpcEnv: "ARC_TESTNET_RPC",
    chainId: 5042002n,
    extraEnv: [],
  },
  mainnet: {
    label: "Arc Mainnet",
    manifest: "arc-mainnet.json",
    rpcEnv: "ARC_MAINNET_RPC_URL",
    chainId: 5042n,
    extraEnv: ["ARC_MAINNET_CHAIN_ID", "ARC_MAINNET_USDC_ADDRESS"],
  },
};

const args = process.argv.slice(2);
const usage =
  "Usage: node scripts/check-arc-deploy-readiness.mjs [--network testnet|mainnet] [--allow-redeploy]";
let networkName = "testnet";
let allowRedeploy = false;
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--allow-redeploy") {
    allowRedeploy = true;
  } else if (argument === "--network" && index + 1 < args.length) {
    networkName = args[index + 1];
    index += 1;
  } else if (argument.startsWith("--network=")) {
    networkName = argument.slice("--network=".length);
  } else {
    console.error(`Unknown argument: ${argument}`);
    console.error(usage);
    process.exit(1);
  }
}
const network = NETWORKS[networkName];
if (!network) {
  console.error(`Unknown network "${networkName}" (expected testnet or mainnet)`);
  console.error(usage);
  process.exit(1);
}
const { label } = network;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(scriptDir, "..");
const manifestPath = path.join(contractsDir, "deployments", network.manifest);
const requiredEnv = [
  network.rpcEnv,
  "DEPLOYER_PRIVATE_KEY",
  "ARC_PROTOCOL_ADMIN",
  "ANOMALY_ORACLE_SIGNER_ADDRESS",
  ...network.extraEnv,
];

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

async function rpcCall(rpcUrl, method, params) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) {
    throw new Error(`${method}: RPC returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method}: ${payload.error.message ?? "unknown RPC error"}`);
  }
  return payload.result;
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
    `${network.manifest} already contains v2 codeHashes; pass --allow-redeploy only for an intentional replacement`,
  );
}

if (networkName === "mainnet") {
  if (
    process.env.ARC_MAINNET_CHAIN_ID &&
    process.env.ARC_MAINNET_CHAIN_ID !== String(network.chainId)
  ) {
    localIssues.push(`ARC_MAINNET_CHAIN_ID must be ${network.chainId}`);
  }
  if (
    process.env.ARC_MAINNET_USDC_ADDRESS &&
    process.env.ARC_MAINNET_USDC_ADDRESS.toLowerCase() !== ARC_USDC.toLowerCase()
  ) {
    localIssues.push(`ARC_MAINNET_USDC_ADDRESS must be ${ARC_USDC}`);
  }
}

if (localIssues.length > 0) {
  console.error(`${label} deploy readiness failed:`);
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
  console.error(`${label} deploy readiness failed: invalid DEPLOYER_PRIVATE_KEY (${detail})`);
  process.exit(1);
}

for (const key of ["ARC_PROTOCOL_ADMIN", "ANOMALY_ORACLE_SIGNER_ADDRESS"]) {
  if (process.env[key].toLowerCase() === deployer.toLowerCase()) {
    console.error(`${label} deploy readiness failed: ${key} must differ from the deployer`);
    process.exit(1);
  }
}

const rpcUrl = process.env[network.rpcEnv];
let deployerBalance;
try {
  const [chainIdHex, create2Code, usdcCode, balanceHex] = await Promise.all([
    rpcCall(rpcUrl, "eth_chainId", []),
    codeAt(rpcUrl, CREATE2_DEPLOYER),
    codeAt(rpcUrl, ARC_USDC),
    rpcCall(rpcUrl, "eth_getBalance", [deployer, "latest"]),
  ]);
  if (BigInt(chainIdHex) !== network.chainId) {
    throw new Error(
      `${network.rpcEnv} serves chain ${BigInt(chainIdHex)}, expected ${network.chainId} (${label})`,
    );
  }
  requireCode(`deterministic CREATE2 deployer ${CREATE2_DEPLOYER}`, create2Code);
  requireCode(`${label} USDC ${ARC_USDC}`, usdcCode);
  deployerBalance = BigInt(balanceHex);
  if (deployerBalance === 0n) {
    throw new Error(`deployer ${deployer} holds no USDC on ${label}; fund it before broadcasting`);
  }
} catch (error) {
  console.error(
    `${label} deploy readiness failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
}

// Gas on Arc is paid in USDC with 18 decimals at the RPC level.
const balanceUsdc = Number(deployerBalance / 10n ** 12n) / 1e6;

console.log(`${label} deploy readiness passed:`);
console.log(`- chain id: ${network.chainId}`);
console.log(`- deployer: ${deployer} (${balanceUsdc.toFixed(6)} USDC)`);
console.log(`- protocol admin: ${process.env.ARC_PROTOCOL_ADMIN}`);
console.log(`- anomaly oracle signer: ${process.env.ANOMALY_ORACLE_SIGNER_ADDRESS}`);
console.log(`- deterministic CREATE2 deployer: ${CREATE2_DEPLOYER}`);
console.log(`- USDC: ${ARC_USDC}`);
