import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAuthSession, workspaceIdentityKey } from "./auth-session";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAuthSession", () => {
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
