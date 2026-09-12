import {
  type AuthSessionData,
  createNonce,
  getSessionOptions,
  isCurrentSession,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { enforceAuthRouteRateLimit } from "../rate-limit";

export async function GET(request: Request) {
  const limited = enforceAuthRouteRateLimit(request, "nonce");
  if (limited) {
    return limited;
  }

  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  if (session.user && !isCurrentSession(session.user)) {
    await session.destroy();
  }
  session.nonce = createNonce();
  await session.save();
  return NextResponse.json({ nonce: session.nonce });
}
