import { describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => ({
  selectRows: vi.fn(),
}));

vi.mock("@arcanum/api/server", () => ({
  createSupabaseServiceRoleClient: () => supabase,
}));

import { GET } from "./route";

const VALID_WALLET = "0x2222222222222222222222222222222222222222";

describe("public badge image", () => {
  it("validates malformed addresses before touching the service-role reader", async () => {
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ wallet: "not-an-address" }),
    });

    expect(response.status).toBe(400);
    expect(supabase.selectRows).not.toHaveBeenCalled();
  });

  it("does not endorse an unknown or opted-out valid address", async () => {
    supabase.selectRows.mockResolvedValueOnce([]);
    const unknown = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ wallet: VALID_WALLET }),
    });
    expect(unknown.status).toBe(404);

    supabase.selectRows.mockResolvedValueOnce([{ show_public_badge: false }]);
    const optedOut = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ wallet: VALID_WALLET }),
    });
    expect(optedOut.status).toBe(404);
  });

  it("renders SVG only after explicit public opt-in", async () => {
    supabase.selectRows.mockResolvedValueOnce([{ show_public_badge: true }]);
    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ wallet: VALID_WALLET }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toContain("GOVERNED BY ARCANUM");
  });
});
