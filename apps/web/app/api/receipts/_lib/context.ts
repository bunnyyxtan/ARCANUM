import { createContext } from "@arcanum/api/server";

/**
 * REST receipt routes are public: the agent's signature over its payment
 * intent is the credential, so no session is loaded. The client fingerprint
 * still feeds the rate limiter.
 */
export function receiptRequestContext(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  return createContext({
    session: null,
    requestFingerprint: forwardedFor || realIp || "unknown-client",
  });
}
