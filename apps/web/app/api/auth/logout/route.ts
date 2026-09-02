import { type AuthSessionData, getSessionOptions } from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  // Awaited so the cleared cookie is written before the response is returned;
  // a floating destroy could lose the race and leave the session usable.
  await session.destroy();
  return NextResponse.json({ ok: true });
}
