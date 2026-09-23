import { describe, expect, it } from "vitest";
import { isSameOriginAuthRequest } from "./origin";

describe("same-origin auth mutation guard", () => {
  it("permits a browser POST from the exact request origin", () => {
    expect(
      isSameOriginAuthRequest(
        new Request("https://app.example/api/auth/nonce", {
          method: "POST",
          headers: { origin: "https://app.example", "sec-fetch-site": "same-origin" },
        }),
      ),
    ).toBe(true);
  });
  it.each([
    {},
    { origin: "null" },
    { origin: "https://attacker.example" },
    { origin: "https://sub.app.example" },
    { origin: "http://app.example" },
    { origin: "https://app.example:444" },
    { origin: "https://app.example", "sec-fetch-site": "cross-site" },
    { origin: "https://app.example", "sec-fetch-site": "same-site" },
  ])("rejects missing/cross-site origin %j", (headers) => {
    expect(
      isSameOriginAuthRequest(
        new Request("https://app.example/api/auth/logout", {
          method: "POST",
          headers: headers as Record<string, string>,
        }),
      ),
    ).toBe(false);
  });
});
