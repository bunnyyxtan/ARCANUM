import {
  type AuthSessionData,
  SessionStoreUnavailableError,
  getSessionOptions,
  isSameOriginAuthRequest,
  resolveTenantId,
  revokeAllSessions,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { enforceAuthRouteRateLimit } from "../rate-limit";

export async function POST(request: Request) {
  if (!isSameOriginAuthRequest(request)) {
    return NextResponse.json({ error: "Same-origin request required" }, { status: 403 });
  }
  const limited = await enforceAuthRouteRateLimit(request, "logout-all");
  if (limited) return limited;
  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  try {
    const revoked = await revokeAllSessions(session, resolveTenantId(request.headers.get("host")));
    if (!revoked) {
      await session.destroy();
      return NextResponse.json({ error: "Sign in again to revoke all sessions" }, { status: 401 });
    }
    await session.destroy();
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof SessionStoreUnavailableError)) throw error;
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
}
