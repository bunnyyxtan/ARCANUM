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
