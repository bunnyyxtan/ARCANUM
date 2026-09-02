import { randomBytes } from "node:crypto";

import { db, defaultTenantId, isDatabaseConfigured } from "@arcanum/db";
import { users } from "@arcanum/db/schema";
import { and, eq } from "drizzle-orm";
import type { SessionOptions } from "iron-session";
import { SiweMessage } from "siwe";
import { z } from "zod";

export type ArcanumSession = {
  walletAddress: string;
  tenantId: string;
  role: "owner" | "council" | "signer" | "viewer";
  expiresAt: number;
};

export type AuthSessionData = {
  nonce?: string;
  user?: ArcanumSession;
};

export const verifyBodySchema = z.object({
  message: z.string().min(1),
  signature: z.string().min(1),
});

export function createNonce() {
  return randomBytes(16).toString("hex");
}

export function resolveTenantId(host?: string | null) {
  if (process.env.ARCANUM_DEPLOYMENT_MODE !== "multi-tenant") {
    return defaultTenantId();
  }

  const normalizedHost = host?.split(":")[0]?.toLowerCase();
  if (!normalizedHost) {
    throw new Error("Tenant host is missing");
  }

  const tenantId =
    process.env[`ARCANUM_TENANT_${normalizedHost.replaceAll(".", "_").toUpperCase()}`];

  // In multi-tenant mode the Host header IS the tenant selector, so an
  // unrecognised host has no safe interpretation. Quietly falling back to the
  // default tenant meant a request arriving through a misconfigured proxy - or
  // carrying a forged Host - signed in against somebody else's data.
  if (!tenantId) {
    throw new Error("Unknown tenant host");
  }

  return tenantId;
}

export function getSessionOptions() {
  const password = process.env.SIWE_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SIWE_SECRET must be at least 32 characters");
  }

  return {
    password,
    cookieName: "arcanum_session",
    cookieOptions: {
      httpOnly: true,
      path: "/",
      // Anything that is not local development is assumed to be served over
      // TLS, so staging and preview deployments stop shipping the session
      // cookie in the clear. ARCANUM_INSECURE_COOKIES is the deliberate escape
      // hatch for running a production build against plain http locally.
      secure:
        process.env.ARCANUM_INSECURE_COOKIES === "true"
          ? false
          : process.env.NODE_ENV !== "development",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    },
  } satisfies SessionOptions;
}

export async function verifySiweLogin(input: {
  message: string;
  signature: string;
  expectedNonce: string;
  host?: string | null;
  /** When set, the SIWE message must be signed for exactly this chain. */
  expectedChainId?: number;
  /**
   * When set, the SIWE message must be signed for exactly this domain. Without
   * it, a signature the wallet produced for any other site can be replayed
   * here to open a session.
   */
  expectedDomain?: string;
}) {
  const siwe = new SiweMessage(input.message);
  const result = await siwe.verify({
    signature: input.signature,
    nonce: input.expectedNonce,
    ...(input.expectedDomain ? { domain: input.expectedDomain } : {}),
  });

  if (!result.success) {
    throw new Error("SIWE verification failed");
  }

  if (input.expectedChainId !== undefined && siwe.chainId !== input.expectedChainId) {
    throw new Error("SIWE verification failed: message signed for the wrong chain");
  }

  const walletAddress = siwe.address.toLowerCase();
  const tenantId = resolveTenantId(input.host);

  // Deployed environments deliberately run without a direct Postgres user
  // directory - identity lives in Supabase and is provisioned by the caller
  // immediately after verification. That mode is a configuration decision, so
  // it is detected as one.
  //
  // It used to be detected by catching whatever the unavailable-database proxy
  // threw, which meant a real outage looked identical to a supported
  // deployment: any query failure fell through to a signed session. An error
  // must never widen access, so a configured directory now fails closed.
  if (!isDatabaseConfigured()) {
    if (!openRegistrationEnabled()) {
      throw new Error("Wallet is not registered for this tenant");
    }

    warnDirectorylessSessionOnce();
    return toSession(walletAddress, tenantId, "viewer");
  }

  const existingUser = await db.query.users.findFirst({
    where: and(eq(users.walletAddress, walletAddress), eq(users.tenantId, tenantId)),
  });

  if (existingUser) {
    return toSession(existingUser.walletAddress, existingUser.tenantId, existingUser.role);
  }

  if (!openRegistrationEnabled()) {
    throw new Error("Wallet is not registered for this tenant");
  }

  const created = await db
    .insert(users)
    .values({
      tenantId,
      walletAddress,
      displayName: `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`,
      role: "viewer",
    })
    .returning();
  const user = created[0];

  if (!user) {
    throw new Error("User creation failed");
  }

  return toSession(user.walletAddress, user.tenantId, user.role);
}

function openRegistrationEnabled() {
  return process.env.ARCANUM_OPEN_REGISTRATION === "true";
}

let warnedDirectorylessSession = false;

function warnDirectorylessSessionOnce() {
  if (warnedDirectorylessSession) {
    return;
  }

  warnedDirectorylessSession = true;
  console.warn(
    "[arcanum-auth] no user directory is configured; open registration is issuing viewer sessions for any wallet that completes SIWE.",
  );
}

function toSession(
  walletAddress: string,
  tenantId: string,
  role: ArcanumSession["role"],
): ArcanumSession {
  return {
    walletAddress,
    tenantId,
    role,
    expiresAt: Date.now() + 60 * 60 * 24 * 7 * 1000,
  };
}
