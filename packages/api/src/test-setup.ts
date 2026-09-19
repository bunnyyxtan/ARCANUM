import { afterEach, beforeEach, vi } from "vitest";

// Business-router fixtures exercise the real limiter without external stores.
// Reapply this explicit test-only opt-in before EACH test: several suites call
// unstubAllEnvs(), so a module-level stub would disappear after their first case.
// Do not override NODE_ENV or mock the limiter here; production/fail-closed tests
// must still reject local fallback and can override these defaults themselves.
beforeEach(() => {
  for (const name of [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "ARCANUM_REQUIRE_RATE_LIMIT_BACKEND",
  ]) {
    vi.stubEnv(name, undefined);
  }
  vi.stubEnv("ARCANUM_ALLOW_IN_MEMORY_RATE_LIMIT", "true");
  globalThis.__arcanumApiRateLimitBuckets?.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// Read-model/router unit tests fabricate identities to isolate authorization
// logic from session storage. auth-guard.test.ts explicitly un-mocks this and
// exercises the real tracked-session boundary, including revocation/outages.
vi.mock("@arcanum/auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("@arcanum/auth")>();
  return {
    ...original,
    validateSession: async ({ user }: import("@arcanum/auth").AuthSessionData) =>
      original.isCurrentSession(user) ? user : null,
  };
});

vi.mock("@arcanum/shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@arcanum/shared")>();
  const address = "0x4444444444444444444444444444444444444444";
  const hash = `0x${"11".repeat(32)}` as `0x${string}`;

  return {
    ...original,
    deploymentManifestFor: () => ({
      chainId: original.ARC_CHAIN_ID,
      network: "arc-testnet",
      startBlock: 1,
      deployer: address,
      protocolAdmin: address,
      oracleSigner: address,
      create2Salt: hash,
      usdc: address,
      policyEngine: address,
      escalationManager: address,
      anomalyOracle: address,
      vendorRegistry: address,
      walletFactory: address,
      codeHashes: {
        policyEngine: hash,
        escalationManager: hash,
        anomalyOracle: hash,
        vendorRegistry: hash,
        walletFactory: hash,
      },
    }),
  };
});
