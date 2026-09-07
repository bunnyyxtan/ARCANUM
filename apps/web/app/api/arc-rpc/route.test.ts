import { afterEach, describe, expect, it, vi } from "vitest";

import { POST } from "./route";

function rpcRequest(body: string) {
  return new Request("http://localhost/api/arc-rpc", {
    body,
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `test-${Math.random()}`,
    },
    method: "POST",
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Arc RPC proxy", () => {
  it("rejects methods outside the read allowlist", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(
      rpcRequest(JSON.stringify({ id: 1, jsonrpc: "2.0", method: "eth_sendRawTransaction" })),
    );

    expect(response.status).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("passes allowed methods to an upstream", async () => {
    const upstream = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 1, jsonrpc: "2.0", result: "0x1" }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", upstream);
    const body = JSON.stringify({ id: 1, jsonrpc: "2.0", method: "eth_blockNumber" });

    const response = await POST(rpcRequest(body));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ result: "0x1" });
    expect(upstream).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body, method: "POST" }),
    );
  });

  it("rejects malformed JSON", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(rpcRequest("{"));

    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects oversized request bodies", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await POST(rpcRequest("x".repeat(20_001)));

    expect(response.status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
});
