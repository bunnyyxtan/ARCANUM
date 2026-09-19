import {
  type AuthSessionData,
  SessionStoreUnavailableError,
  getSessionOptions,
  isSameOriginAuthRequest,
  revokeSession,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { enforceAuthRouteRateLimit } from "../rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginAuthRequest(request)) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  }
  const limited = await enforceAuthRouteRateLimit(request, "logout");
  if (limited) return limited;
  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  try {
    // Keep the cookie on outage so the caller can retry; never claim revocation
    // merely because one browser discarded its copy.
    await revokeSession(session);
  } catch (error) {
    if (!(error instanceof SessionStoreUnavailableError)) throw error;
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  await session.destroy();
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
