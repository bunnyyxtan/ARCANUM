#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(contractsDir, "..", "..");
const deploymentPath = path.join(contractsDir, "deployments", "arc-testnet.json");
const webEnvPath = path.join(repoRoot, "apps", "web", ".env.local");

const requiredEnv = ["ARC_TESTNET_RPC", "DEPLOYER_PRIVATE_KEY", "ANOMALY_ORACLE_PRIVATE_KEY"];
const frontendKeys = [
  "NEXT_PUBLIC_WALLET_FACTORY",
  "NEXT_PUBLIC_POLICY_ENGINE",
  "NEXT_PUBLIC_ESCALATION_MANAGER",
  "NEXT_PUBLIC_ANOMALY_ORACLE",
  "NEXT_PUBLIC_VENDOR_REGISTRY",
];
const zeroAddress = "0x0000000000000000000000000000000000000000";
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

function readEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function classifyAddress(value) {
  if (!value) {
    return "missing";
  }
  if (value === zeroAddress) {
    return "zero-placeholder";
  }
  if (addressPattern.test(value)) {
    return "address-shaped";
  }
  return "placeholder-or-invalid";
}

let hasBlockingIssue = false;

console.log("Arc Testnet deploy readiness");
console.log("");
console.log("Required deployment env:");
for (const key of requiredEnv) {
  const present = Boolean(process.env[key]);
  hasBlockingIssue = hasBlockingIssue || !present;
  console.log(`- ${key}: ${present ? "set" : "missing"}`);
}

console.log("");
console.log("Frontend contract env in apps/web/.env.local:");
const webEnv = readEnvFile(webEnvPath);
for (const key of frontendKeys) {
  console.log(`- ${key}: ${classifyAddress(webEnv[key])}`);
}

console.log("");
console.log(`Deployment artifact: ${existsSync(deploymentPath) ? "found" : "missing"}`);
if (existsSync(deploymentPath)) {
  const deployment = JSON.parse(readFileSync(deploymentPath, "utf8"));
  for (const key of [
    "walletFactory",
    "policyEngine",
    "escalationManager",
    "anomalyOracle",
    "vendorRegistry",
    "usdc",
  ]) {
    console.log(`- ${key}: ${classifyAddress(deployment[key])}`);
  }
}

console.log("");
if (hasBlockingIssue) {
  console.log(
    "Next step: set the missing env vars in PowerShell, then run the dry-run command from MANUAL_ARC_TESTNET_DEPLOY.md.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Next step: run forge build, forge test, then the dry-run command from MANUAL_ARC_TESTNET_DEPLOY.md.",
  );
}
