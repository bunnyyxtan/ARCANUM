import {
  type AuthSessionData,
  SessionStoreUnavailableError,
  getSessionOptions,
  resolveTenantId,
  validateSession,
} from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
    const user = await validateSession(session, resolveTenantId(request.headers.get("host")));
    if (session.user && !user) await session.destroy();
    return NextResponse.json({ user }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (!(error instanceof SessionStoreUnavailableError)) throw error;
    return NextResponse.json(
      { error: error.message },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
