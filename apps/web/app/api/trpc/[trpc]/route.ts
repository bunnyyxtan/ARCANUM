import { appRouter, createContext, rateLimitFailure } from "@arcanum/api/server";
import { type AuthSessionData, getSessionOptions, resolveTenantId } from "@arcanum/auth";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

function handler(request: Request) {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: request,
    router: appRouter,
    responseMeta({ errors }) {
      const retryAfter = errors
        .map(rateLimitFailure)
        .reduce((maximum, failure) => Math.max(maximum, failure?.retryAfter ?? 0), 0);
      return {
        headers: {
          "Cache-Control": "no-store",
          ...(retryAfter > 0 ? { "Retry-After": String(retryAfter) } : {}),
        },
      };
    },
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
        // Every public/protected procedure validates this against the store.
        // Keep invalid cookies as invalid credentials, not anonymous fallbacks.
        sessionId: session.sessionId,
        expectedTenantId: resolveTenantId(request.headers.get("host")),
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
