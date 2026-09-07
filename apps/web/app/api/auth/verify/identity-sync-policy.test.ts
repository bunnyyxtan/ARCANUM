import { afterEach, describe, expect, it, vi } from "vitest";

import { identitySyncOptional } from "./identity-sync-policy";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("identitySyncOptional", () => {
  it("does not allow unbacked production sessions when the flag is unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_ALLOW_UNBACKED_SESSIONS", undefined);

    expect(identitySyncOptional("unconfigured")).toBe(false);
  });

  it("allows unbacked production sessions when the flag is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_ALLOW_UNBACKED_SESSIONS", "true");

    expect(identitySyncOptional("unconfigured")).toBe(true);
  });

  it("does not allow unbacked production sessions when the flag is false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_ALLOW_UNBACKED_SESSIONS", "false");

    expect(identitySyncOptional("unconfigured")).toBe(false);
  });
});
