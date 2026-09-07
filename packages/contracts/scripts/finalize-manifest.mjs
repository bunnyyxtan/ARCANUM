import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const [network, rpcUrl] = process.argv.slice(2);
if (!network || !rpcUrl) {
  console.error("usage: node scripts/finalize-manifest.mjs <arc-testnet|arc-mainnet> <rpc-url>");
  process.exit(1);
}

const scriptName = network === "arc-testnet" ? "DeployArcTestnet" : "DeployArcMainnet";
const manifestPath = join(root, "deployments", `${network}.json`);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const broadcastPath = join(
  root,
  "broadcast",
  `${scriptName}.s.sol`,
  String(manifest.chainId),
  "run-latest.json",
);
if (!existsSync(broadcastPath)) {
  console.error(
    `no broadcast record at ${broadcastPath}; run the deploy script with --broadcast first`,
  );
  process.exit(1);
}
const broadcast = JSON.parse(readFileSync(broadcastPath, "utf8"));

const contracts = {
  PolicyEngine: "policyEngine",
  EscalationManager: "escalationManager",
  AnomalyOracle: "anomalyOracle",
  VendorRegistry: "vendorRegistry",
  WalletFactory: "walletFactory",
};

const txHashes = {};
for (const tx of broadcast.transactions) {
  const key = contracts[tx.contractName];
  if (!key) {
    continue;
  }
  if (tx.contractAddress.toLowerCase() !== manifest[key].toLowerCase()) {
    console.error(
      `${tx.contractName}: broadcast address ${tx.contractAddress} differs from manifest ${manifest[key]}`,
    );
    process.exit(1);
  }
  txHashes[key] = tx.hash;
}
for (const key of Object.values(contracts)) {
  if (!txHashes[key]) {
    console.error(`no broadcast transaction found for ${key}`);
    process.exit(1);
  }
}

const artifact = JSON.parse(
  readFileSync(join(root, "out", "WalletFactory.sol", "WalletFactory.json"), "utf8"),
);
const compiler = artifact.metadata.compiler.version;
const evmVersion = artifact.metadata.settings.evmVersion;

async function codeHashAt(address) {
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
  const { result, error } = await response.json();
  if (error) {
    throw new Error(`eth_getCode ${address}: ${error.message}`);
  }
  return execFileSync("cast", ["keccak", result], { encoding: "utf8" }).trim();
}

for (const [name, key] of Object.entries(contracts)) {
  const onChain = await codeHashAt(manifest[key]);
  if (onChain !== manifest.codeHashes[key]) {
    console.error(
      `${name}: on-chain code hash ${onChain} differs from manifest ${manifest.codeHashes[key]}`,
    );
    process.exit(1);
  }
}

if (manifest.network !== network) {
  console.error(`${manifestPath} identifies network ${manifest.network}, expected ${network}`);
  process.exit(1);
}

const finalized = {
  ...manifest,
  deployedAt: new Date(broadcast.timestamp * 1000).toISOString(),
  compiler,
  evmVersion,
  txHashes,
};
const body = `${JSON.stringify(finalized, null, 2)}\n`;
writeFileSync(manifestPath, body);
console.log(`${manifestPath} finalized; sha256 ${createHash("sha256").update(body).digest("hex")}`);
