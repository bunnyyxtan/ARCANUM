import { syncSupabaseAuthSession } from "@arcanum/api/server";
import {
  type AuthSessionData,
  getSessionOptions,
  verifyBodySchema,
  verifySiweLogin,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { enforceAuthRouteRateLimit } from "../rate-limit";

export async function POST(request: Request) {
  const limited = enforceAuthRouteRateLimit(request, "verify");
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
    });

    await syncSupabaseAuthSession(user);

    session.user = user;
    session.nonce = undefined;
    await session.save();

    return NextResponse.json({ user });
  } catch (error) {
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
