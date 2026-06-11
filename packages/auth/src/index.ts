import { randomBytes } from "node:crypto";

import { db, defaultTenantId } from "@arcanum/db";
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
    return defaultTenantId();
  }

  return (
    process.env[`ARCANUM_TENANT_${normalizedHost.replaceAll(".", "_").toUpperCase()}`] ??
    defaultTenantId()
  );
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
      secure: process.env.NODE_ENV === "production",
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
}) {
  const siwe = new SiweMessage(input.message);
  const result = await siwe.verify({
    signature: input.signature,
    nonce: input.expectedNonce,
  });

  if (!result.success) {
    throw new Error("SIWE verification failed");
  }

  const walletAddress = siwe.address.toLowerCase();
  const tenantId = resolveTenantId(input.host);
  try {
    const existingUser = await db.query.users.findFirst({
      where: and(eq(users.walletAddress, walletAddress), eq(users.tenantId, tenantId)),
    });

    if (!existingUser) {
      if (process.env.ARCANUM_OPEN_REGISTRATION !== "true") {
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

    return toSession(existingUser.walletAddress, existingUser.tenantId, existingUser.role);
  } catch (error) {
    if (canUseSignedOpenRegistrationSession()) {
      warnSignedOpenRegistrationFallback(error);
      return toSession(walletAddress, tenantId, "viewer");
    }

    throw error;
  }
}

function canUseSignedOpenRegistrationSession() {
  return process.env.ARCANUM_OPEN_REGISTRATION === "true";
}

let warnedSignedOpenRegistrationFallback = false;

function warnSignedOpenRegistrationFallback(error: unknown) {
  if (warnedSignedOpenRegistrationFallback) {
    return;
  }

  warnedSignedOpenRegistrationFallback = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `[arcanum-auth] using signed open-registration session because the user database is unavailable: ${message}`,
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
