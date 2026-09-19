import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../rate-limit", () => ({ enforceRateLimit: vi.fn() }));

import { createContext } from "../context";
import { enforceRateLimit } from "../rate-limit";
import { RateLimitError } from "../rate-limit-store";
import { handleVerifyReceipt } from "./http";

beforeEach(() => vi.resetAllMocks());

describe("receipt HTTP rate-limit responses", () => {
  it.each([429, 503] as const)(
    "preserves status %s and Retry-After without leaking errors",
    async (status) => {
      const cause = new RateLimitError(status, 17);
      vi.mocked(enforceRateLimit).mockRejectedValueOnce(
        new TRPCError({
          code: status === 429 ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE",
          message: cause.message,
          cause,
        }),
      );
      const response = await handleVerifyReceipt(
        new Request("http://localhost/api/receipts/verify", { method: "POST", body: "{}" }),
        createContext(),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("retry-after")).toBe("17");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: {
          code: status === 429 ? "RATE_LIMITED" : "SERVICE_UNAVAILABLE",
          message: cause.message,
        },
      });
    },
  );
});
