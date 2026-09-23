import { afterEach, describe, expect, it, vi } from "vitest";

import {
  fetchAuthSession,
  publishAuthSession,
  signOutAuthSession,
  workspaceIdentityKey,
} from "./auth-session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAuthSession", () => {
  it("does not let a pending authenticated read restore identity after signout", async () => {
    vi.stubGlobal("window", { dispatchEvent: vi.fn() });
    let resolveRead!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveRead = resolve;
          }),
      ),
    );
    const pending = fetchAuthSession({ force: true });
    publishAuthSession(null);
    resolveRead(Response.json({ user: { walletAddress: "0xaaa" } }));
    await expect(pending).resolves.toEqual({ status: "anonymous", user: null });
    await expect(fetchAuthSession()).resolves.toEqual({ status: "anonymous", user: null });
  });

  it("reports revocation outages and publishes cache clearing only on success", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    const fetchMock = vi.fn().mockResolvedValue(new Response("outage", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(signOutAuthSession(true)).rejects.toThrow("Sessions may still be active");
    expect(dispatchEvent).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await signOutAuthSession(true);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/auth/logout-all",
      expect.objectContaining({ method: "POST" }),
    );
    expect(dispatchEvent).toHaveBeenCalledOnce();
  });

  it("distinguishes an anonymous session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ user: null }), {
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(fetchAuthSession({ force: true })).resolves.toEqual({
      status: "anonymous",
      user: null,
    });
  });

  it("distinguishes an unavailable session endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const result = await fetchAuthSession({ force: true });

    expect(result.status).toBe("unavailable");
    expect(result.user).toBeNull();
    if (result.status === "unavailable") {
      expect(result.error.message).toBe("network unavailable");
    }
  });
});

describe("workspace query identity", () => {
  it("uses an isolated scope for each connected wallet and signed session", () => {
    const walletA = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const walletB = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    expect(
      workspaceIdentityKey({
        address: walletA,
        isConnected: true,
        signedAddress: walletA,
        tenantId: "tenant-a",
      }),
    ).not.toBe(
      workspaceIdentityKey({
        address: walletB,
        isConnected: true,
        signedAddress: walletB,
        tenantId: "tenant-b",
      }),
    );
    expect(
      workspaceIdentityKey({
        address: walletA,
        isConnected: true,
        signedAddress: null,
        tenantId: null,
      }),
    ).not.toBe(
      workspaceIdentityKey({
        address: walletA,
        isConnected: true,
        signedAddress: walletA,
        tenantId: "tenant-a",
      }),
    );
  });

  it("drops the workspace scope as soon as the wallet disconnects", () => {
    expect(
      workspaceIdentityKey({
        address: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        isConnected: false,
        signedAddress: "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        tenantId: "tenant-a",
      }),
    ).toBe("anonymous");
  });
});
