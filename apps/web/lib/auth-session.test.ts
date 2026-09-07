import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchAuthSession } from "./auth-session";

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
