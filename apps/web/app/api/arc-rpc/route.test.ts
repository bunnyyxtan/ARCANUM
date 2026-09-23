import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  for (const name of [
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ARCANUM_REQUIRE_RATE_LIMIT_BACKEND",
  ]) {
    vi.stubEnv(name, "");
  }
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT", "true");
  globalThis.__arcanumApiRateLimitBuckets?.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Arc RPC proxy", () => {
  it("shares a quota for an anonymous caller and rejects before body/upstream work", async () => {
    const upstream = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response('{"result":"0x1"}')));
    vi.stubGlobal("fetch", upstream);
    const request = () =>
      new Request("http://localhost/api/arc-rpc", {
        method: "POST",
        body: '{"method":"eth_blockNumber"}',
      });
    for (let i = 0; i < 80; i++) expect((await POST(request())).status).toBe(200);
    const denied = await POST(request());
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(upstream).toHaveBeenCalledTimes(80);
  });

  it("returns sanitized 503 without touching upstream or request body when no production store exists", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const response = await POST(rpcRequest("{"));
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.json()).toMatchObject({
      error: { message: "Rate limit service unavailable." },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("does not leak upstream exception details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("https://rpc.example/secret-token")),
    );
    const response = await POST(rpcRequest('{"method":"eth_blockNumber"}'));
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret-token");
  });

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

  it("counts UTF-8 bytes, not characters, before parsing or forwarding", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const body = JSON.stringify({ method: "eth_blockNumber", padding: "é".repeat(11_000) });
    expect(body.length).toBeLessThan(20_000);
    expect(new TextEncoder().encode(body).length).toBeGreaterThan(20_000);

    expect((await POST(rpcRequest(body))).status).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("accepts a multibyte body exactly at the byte limit", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('{"result":"0x1"}'));
    vi.stubGlobal("fetch", upstream);
    const base = { method: "eth_blockNumber", padding: "" };
    const remaining = 20_000 - new TextEncoder().encode(JSON.stringify(base)).length;
    const body = JSON.stringify({
      ...base,
      padding: "é".repeat(Math.floor(remaining / 2)) + "x".repeat(remaining % 2),
    });
    expect(new TextEncoder().encode(body)).toHaveLength(20_000);
    expect((await POST(rpcRequest(body))).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body }));
  });

  it("decodes UTF-8 correctly across stream chunk boundaries", async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('{"result":"0x1"}'));
    vi.stubGlobal("fetch", upstream);
    const body = JSON.stringify({ method: "eth_blockNumber", padding: "é😀" });
    const bytes = new TextEncoder().encode(body);
    let offset = 0;
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      duplex: "half",
      body: new ReadableStream({
        pull(controller) {
          if (offset < bytes.length) controller.enqueue(bytes.slice(offset, ++offset));
          else controller.close();
        },
      }),
    };
    expect((await POST(new Request("http://localhost/api/arc-rpc", init))).status).toBe(200);
    expect(upstream).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ body }));
  });

  it("cancels an over-limit request stream without reading its remaining chunks", async () => {
    const upstream = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal("fetch", upstream);
    let reads = 0;
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      duplex: "half",
      body: new ReadableStream(
        {
          pull(controller) {
            reads += 1;
            controller.enqueue(new Uint8Array(10_001));
          },
          cancel,
        },
        { highWaterMark: 0 },
      ),
    };
    expect((await POST(new Request("http://localhost/api/arc-rpc", init))).status).toBe(413);
    expect(reads).toBe(2);
    expect(cancel).toHaveBeenCalledOnce();
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects oversized upstream UTF-8 responses by bytes", async () => {
    const body = JSON.stringify({ result: "é".repeat(500_000) });
    expect(body.length).toBeLessThan(1_000_000);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    const response = await POST(rpcRequest('{"method":"eth_blockNumber"}'));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { message: "Upstream response too large for this proxy." },
    });
  });

  it("returns a bounded error if the incoming stream fails", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const init: RequestInit & { duplex: "half" } = {
      method: "POST",
      duplex: "half",
      body: new ReadableStream({
        start(controller) {
          controller.error(new Error("test read failure"));
        },
      }),
    };
    const response = await POST(new Request("http://localhost/api/arc-rpc", init));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
