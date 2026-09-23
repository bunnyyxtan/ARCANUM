import {
  type AuthSessionData,
  createNonce,
  getSessionOptions,
  isSameOriginAuthRequest,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { enforceAuthRouteRateLimit } from "../rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginAuthRequest(request)) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  }
  const limited = await enforceAuthRouteRateLimit(request, "nonce");
  if (limited) {
    return limited;
  }

  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  session.nonce = createNonce();
  await session.save();
  return NextResponse.json({ nonce: session.nonce }, { headers: { "Cache-Control": "no-store" } });
}
