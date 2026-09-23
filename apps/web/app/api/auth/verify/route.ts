import { syncSupabaseAuthSession } from "@arcanum/api/server";
import {
  type AuthSessionData,
  SESSION_TTL_MS,
  SessionStoreUnavailableError,
  createTrackedSession,
  getSessionOptions,
  isSameOriginAuthRequest,
  revokeSession,
  verifyBodySchema,
  verifySiweLogin,
} from "@arcanum/auth";
import { ARC_CHAIN_ID } from "@arcanum/shared";
import { getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { enforceAuthRouteRateLimit } from "../rate-limit";
import { identitySyncOptional } from "./identity-sync-policy";

export async function POST(request: Request) {
  // Captured before async verification/provisioning so logout-all can reject
  // a login already in flight when its wallet+tenant revocation completed.
  const loginStartedAt = Date.now();
  if (!isSameOriginAuthRequest(request)) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  }
  const limited = await enforceAuthRouteRateLimit(request, "verify");
  if (limited) {
    return limited;
  }

  try {
    const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
    if (!session.nonce) {
      return NextResponse.json({ error: "Missing nonce" }, { status: 400 });
    }

    const body = verifyBodySchema.parse(await request.json());
    const requestHeaders = await headers();
    const user = await verifySiweLogin({
      message: body.message,
      signature: body.signature,
      expectedNonce: session.nonce,
      host: requestHeaders.get("host"),
      expectedChainId: ARC_CHAIN_ID,
      expectedDomain: resolveExpectedSiweDomain(requestHeaders),
    });
    user.expiresAt = loginStartedAt + SESSION_TTL_MS;

    // Supabase holds the profile and workspace this session will be read
    // against. Issuing a cookie without one hands out an authenticated session
    // backed by nothing.
    const sync = await syncSupabaseAuthSession(user);
    if (!sync.synced && !identitySyncOptional(sync.reason)) {
      console.error(`[arcanum-auth] refusing to issue a session: identity store is ${sync.reason}`);
      return NextResponse.json(
        {
          error: "Authentication unavailable",
          message: "Sign-in is temporarily unavailable. Please retry shortly.",
        },
        { status: 503 },
      );
    }

    // Rotate the existing server record, not just the cookie. Never put the
    // opaque identifier in the JSON response or any client-side cache.
    await revokeSession(session);
    session.sessionId = await createTrackedSession(user);
    session.user = user;
    session.nonce = undefined;
    await session.save();

    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      return NextResponse.json(
        { error: "Authentication unavailable", message: error.message },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "SIWE verification failed";
    console.warn(`[arcanum-auth] SIWE verify failed: ${message}`);
    return NextResponse.json(
      {
        error: "Authentication failed",
        message: safeAuthMessage(message),
      },
      { status: 401 },
    );
  }
}

/**
 * The domain a SIWE message must be bound to, or undefined to skip the check.
 *
 * SIWE messages carry the domain the wallet was asked to sign for; verifying it
 * is what stops a signature gathered on another site from being replayed here.
 * The expected value is the host the request actually arrived on, read from the
 * proxy header first because deployments sit behind one. Local development
 * skips the check, where hosts vary between localhost, tunnels and preview
 * domains and a mismatch would only block sign-in.
 */
function resolveExpectedSiweDomain(requestHeaders: Headers) {
  const override = process.env.ARCANUM_SIWE_DOMAIN?.trim();
  if (override) {
    return override;
  }

  if (
    process.env.ARCANUM_ENFORCE_SIWE_DOMAIN === "false" ||
    (process.env.NODE_ENV !== "production" && process.env.ARCANUM_ENFORCE_SIWE_DOMAIN !== "true")
  ) {
    return undefined;
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  return forwardedHost || requestHeaders.get("host")?.trim() || undefined;
}

function safeAuthMessage(message: string) {
  if (message.includes("registered")) {
    return "Wallet is not registered for this tenant.";
  }

  if (message.includes("nonce")) {
    return "The sign-in challenge expired. Please retry signature.";
  }

  if (message.includes("SIWE") || message.includes("signature")) {
    return "Signature verification failed. Please retry signature.";
  }

  return "Signed session could not be established. Please retry signature.";
}
