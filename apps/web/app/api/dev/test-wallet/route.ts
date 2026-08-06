import { readFile } from "node:fs/promises";
import path from "node:path";

import { ARC_TESTNET_RPC_URL, arcTestnet } from "@arcanum/shared";
import { NextResponse } from "next/server";
import { http, createWalletClient, isHex } from "viem";
import type { Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Development-only headless wallet used by automated browser tests.
 *
 * Signing happens here on the server so no private key is ever shipped to the
 * browser bundle. The route refuses to run in production, and refuses to run at
 * all unless ARCANUM_ENABLE_TEST_WALLET is explicitly set.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES = ["operator", "agent", "vendorA", "vendorB"] as const;
type Role = (typeof ROLES)[number];

type WalletFile = Record<string, { pk?: string; address?: string } | undefined>;

function testWalletEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.ARCANUM_ENABLE_TEST_WALLET === "1";
}

function disabledResponse() {
  return NextResponse.json({ error: "Test wallet is disabled." }, { status: 404 });
}

function resolveRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "operator";
}

async function loadAccount(role: Role) {
  const file =
    process.env.ARCANUM_TEST_WALLET_FILE ??
    path.resolve(process.cwd(), "..", "..", ".env.wallets.local");
  const parsed = JSON.parse(await readFile(file, "utf8")) as WalletFile;
  const key = parsed[role]?.pk;

  if (!key || !isHex(key)) {
    throw new Error(`No usable private key for role "${role}" in ${path.basename(file)}.`);
  }

  return privateKeyToAccount(key as Hex);
}

function toBigInt(value: unknown) {
  if (typeof value === "string" && value.length > 0) {
    return BigInt(value);
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  return undefined;
}

export async function GET(request: Request) {
  if (!testWalletEnabled()) {
    return disabledResponse();
  }

  const role = resolveRole(new URL(request.url).searchParams.get("role"));

  try {
    const account = await loadAccount(role);
    return NextResponse.json({ role, address: account.address, chainId: arcTestnet.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test wallet unavailable." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!testWalletEnabled()) {
    return disabledResponse();
  }

  let body: { method?: string; params?: unknown[]; role?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const role = resolveRole(body.role);
  const params = Array.isArray(body.params) ? body.params : [];

  try {
    const account = await loadAccount(role);

    switch (body.method) {
      case "eth_accounts":
      case "eth_requestAccounts": {
        return NextResponse.json({ result: [account.address] });
      }

      case "personal_sign":
      case "eth_sign": {
        // personal_sign passes [data, address]; eth_sign passes [address, data].
        const candidate = body.method === "personal_sign" ? params[0] : params[1];
        const message = isHex(candidate) ? { raw: candidate as Hex } : String(candidate ?? "");
        return NextResponse.json({ result: await account.signMessage({ message }) });
      }

      case "eth_signTypedData":
      case "eth_signTypedData_v3":
      case "eth_signTypedData_v4": {
        const payload = params[1];
        const typedData = typeof payload === "string" ? JSON.parse(payload) : payload;
        return NextResponse.json({ result: await account.signTypedData(typedData) });
      }

      case "eth_sendTransaction": {
        const tx = (params[0] ?? {}) as Record<string, unknown>;
        const client = createWalletClient({
          account,
          chain: arcTestnet,
          transport: http(ARC_TESTNET_RPC_URL),
        });
        const hash = await client.sendTransaction({
          to: (tx.to as Hex | undefined) ?? undefined,
          data: (tx.data as Hex | undefined) ?? undefined,
          value: toBigInt(tx.value),
          gas: toBigInt(tx.gas),
        });
        return NextResponse.json({ result: hash });
      }

      default:
        return NextResponse.json(
          { error: `Test wallet does not handle ${body.method ?? "unknown method"}.` },
          { status: 400 },
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Test wallet request failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
