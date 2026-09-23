import { clientRateLimitIdentity, consumeRateLimit, rateLimitFailure } from "@arcanum/api/server";
import { NextResponse } from "next/server";

type AuthRoute = "nonce" | "verify" | "logout" | "logout-all";

const AUTH_RATE_LIMITS = {
  nonce: 30,
  verify: 10,
  logout: 30,
  "logout-all": 10,
} as const;

export async function enforceAuthRouteRateLimit(
  request: Request,
  route: AuthRoute,
): Promise<NextResponse | null> {
  try {
    await consumeRateLimit({
      scope: `auth:${route}`,
      identity: clientRateLimitIdentity(request),
      limit: AUTH_RATE_LIMITS[route],
      windowMs: 60_000,
    });
    return null;
  } catch (error) {
    const failure = rateLimitFailure(error);
    return NextResponse.json(
      {
        error:
          failure?.status === 429
            ? "Too many sign-in attempts. Try again shortly."
            : "Sign-in protection is temporarily unavailable.",
      },
      {
        status: failure?.status ?? 503,
        headers: { "Retry-After": String(failure?.retryAfter ?? 5), "cache-control": "no-store" },
      },
    );
  }
}
