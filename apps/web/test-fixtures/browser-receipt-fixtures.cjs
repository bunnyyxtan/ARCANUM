/*
 * Receipt cases for the browser audit.
 *
 * The valid envelope is signed test material from the installed SDK fixtures.
 * It is intentionally not a production credential, issuer, payment, or
 * settlement proof. The unknownIssuer envelope keeps the request material but
 * changes the issuer key id and recomputes the body digest, so the browser
 * verifier must report unknown_issuer without trusting embedded data. The
 * tampered envelope keeps the original digest/signature while changing
 * amountBaseUnits, so the browser verifier must reject it.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .filter((key) => value[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function receiptDigest(body) {
  return `0x${crypto.createHash("sha256").update(canonicalJson(body), "utf8").digest("hex")}`;
}

function loadBrowserReceiptFixtures(workspaceDirectory) {
  const auditDirectory = path.resolve(workspaceDirectory, ".local/audits/arcanum-2026-09-12");
  const validPath = path.join(auditDirectory, "fixtures/pdr-valid.json");
  const tamperedPath = path.join(auditDirectory, "fixtures/pdr-tampered-amount.json");
  const valid = JSON.parse(fs.readFileSync(validPath, "utf8"));
  const tampered = JSON.parse(fs.readFileSync(tamperedPath, "utf8"));
  if (valid.receipt?.issuer?.keyId !== "test-2026") {
    throw new Error("Expected the signed browser receipt to use the test-2026 issuer.");
  }
  if (
    tampered.receipt?.amountBaseUnits !== "12500001" ||
    tampered.receiptDigest !== valid.receiptDigest ||
    tampered.signature !== valid.signature
  ) {
    throw new Error("Tampered receipt fixture no longer has the intended stale signature.");
  }
  const unknownIssuer = JSON.parse(JSON.stringify(valid));
  unknownIssuer.receipt.issuer = {
    ...unknownIssuer.receipt.issuer,
    keyId: "unknown-browser-upload",
  };
  unknownIssuer.receiptDigest = receiptDigest(unknownIssuer.receipt);
  return {
    valid,
    tampered,
    unknownIssuer,
    trust: {
      issuerKeyId: valid.receipt.issuer.keyId,
      cryptographicallySigned: true,
      trustedInProduction: false,
      publishedIssuerKeyId: "arc-testnet-2026-09",
      note: "Synthetic audit issuer only; no production credential or payment proof.",
    },
  };
}

module.exports = { loadBrowserReceiptFixtures };
