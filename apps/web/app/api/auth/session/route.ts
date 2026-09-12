import { type AuthSessionData, getSessionOptions, isCurrentSession } from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  if (session.user && !isCurrentSession(session.user)) {
    // Do not let a valid iron-session seal turn an expired application session
    // into an authenticated client state. Destroying here also clears old
    // longer-lived seals instead of replaying them on every request.
    await session.destroy();
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({ user: session.user ?? null });
}
