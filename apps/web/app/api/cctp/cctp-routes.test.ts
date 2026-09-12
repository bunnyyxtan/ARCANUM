import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@arcanum/shared", () => ({ IS_ARC_MAINNET: false }));
vi.mock("@/lib/cctp", () => ({
  getCctpQuote: vi.fn(),
  getCctpStatus: vi.fn(),
}));

import { getCctpQuote, getCctpStatus } from "@/lib/cctp";
import { GET as quote } from "./quote/route";
import { GET as status } from "./status/route";

let identity = 0;
function request(path: string, ip = `test-${++identity}`) {
  return new Request(`http://localhost/api/cctp/${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}
const recipient = "0x1111111111111111111111111111111111111111";
const hash = `0x${"ab".repeat(32)}`;

beforeEach(() => vi.clearAllMocks());

describe("CCTP read-only routes", () => {
  it.each(["0", "-1", "1e6", "1.0000001", "NaN", "01", ""])(
    "rejects invalid amount %s before contacting a provider",
    async (amount) => {
      expect((await quote(request(`quote?amount=${amount}`))).status).toBe(400);
      expect(getCctpQuote).not.toHaveBeenCalled();
    },
  );

  it("returns a non-cacheable live quote", async () => {
    const value = {
      amountBaseUnits: "5000000",
      maxFeeBaseUnits: "20000",
      minimumReceivedBaseUnits: "4980000",
      expiresAt: Date.now() + 120_000,
    };
    vi.mocked(getCctpQuote).mockResolvedValue(value);
    const response = await quote(request("quote?amount=5"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ quote: value });
    expect(getCctpQuote).toHaveBeenCalledWith("5");
  });

  it("rejects malformed resume identifiers", async () => {
    expect((await status(request(`status?burnTxHash=0x12&recipient=${recipient}`))).status).toBe(
      400,
    );
    expect((await status(request(`status?burnTxHash=${hash}&recipient=not-a-wallet`))).status).toBe(
      400,
    );
    expect(getCctpStatus).not.toHaveBeenCalled();
  });

  it("binds a resumed burn to the expected recipient", async () => {
    const transfer = { stage: "attestation_pending" as const, burnTxHash: hash as `0x${string}` };
    vi.mocked(getCctpStatus).mockResolvedValue(transfer);
    const response = await status(request(`status?burnTxHash=${hash}&recipient=${recipient}`));
    expect(await response.json()).toEqual({ transfer });
    expect(getCctpStatus).toHaveBeenCalledWith({ burnTxHash: hash, recipient });
  });

  it("reports upstream errors instead of inventing a pending or completed transfer", async () => {
    vi.mocked(getCctpStatus).mockRejectedValue(new Error("Recipient mismatch"));
    const response = await status(request(`status?burnTxHash=${hash}&recipient=${recipient}`));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Recipient mismatch No transaction was submitted by this check.",
    });
  });

  it("rate limits repeated polling without contacting the provider again", async () => {
    const ip = `rate-limit-${++identity}`;
    for (let i = 0; i < 30; i++) await quote(request("quote?amount=0", ip));
    const response = await quote(request("quote?amount=5", ip));
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(getCctpQuote).not.toHaveBeenCalled();
  });
});
