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

  it("rejects unbacked production sessions even when the legacy flag is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_ALLOW_UNBACKED_SESSIONS", "true");

    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    expect(identitySyncOptional("unconfigured")).toBe(false);
  });

  it("does not allow unbacked production sessions when the flag is false", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ARCANUM_ALLOW_UNBACKED_SESSIONS", "false");

    expect(identitySyncOptional("unconfigured")).toBe(false);
  });

  it("only permits explicitly selected local-test mode, never an outage", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", undefined);
    expect(identitySyncOptional("unconfigured")).toBe(false);
    vi.stubEnv("ARCANUM_SESSION_STORE_MODE", "local-test");
    expect(identitySyncOptional("unconfigured")).toBe(true);
    expect(identitySyncOptional("unavailable")).toBe(false);
  });
});
