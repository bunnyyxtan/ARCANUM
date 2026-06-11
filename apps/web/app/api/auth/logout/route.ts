import { type AuthSessionData, getSessionOptions } from "@arcanum/auth";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
  session.destroy();
  return NextResponse.json({ ok: true });
}
