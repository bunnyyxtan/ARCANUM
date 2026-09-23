import { describe, expect, it, vi } from "vitest";

import { copyText } from "./clipboard";

describe("copyText", () => {
  it("resolves true only after a successful clipboard write", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await expect(copyText("receipt")).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith("receipt");
  });

  it("reports rejected or unavailable clipboard writes as failures", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    await expect(copyText("receipt")).resolves.toBe(false);

    vi.stubGlobal("navigator", {});
    await expect(copyText("receipt")).resolves.toBe(false);
  });
});
