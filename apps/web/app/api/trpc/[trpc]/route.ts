import { appRouter, createContext } from "@arcanum/api/server";
import { type AuthSessionData, getSessionOptions } from "@arcanum/auth";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    createContext: async () => {
      const secret = process.env.SIWE_SECRET;
      if (!secret || secret.length < 32) {
        console.warn("WARNING: SIWE_SECRET is missing or < 32 characters. Auth is disabled.");
        return createContext({
          session: null,
          env: { authConfigured: false },
          requestFingerprint: clientFingerprint(request),
        });
      }
      const session = await getIronSession<AuthSessionData>(await cookies(), getSessionOptions());
      return createContext({
        session: session.user ?? null,
        env: { authConfigured: true },
        requestFingerprint: clientFingerprint(request),
      });
    },
  });
}

export { handler as GET, handler as POST };

function clientFingerprint(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return forwardedFor || realIp || "unknown-client";
}
