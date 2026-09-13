import { sealData, unsealData } from "iron-session";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const directory = vi.hoisted(() => ({
  configured: true,
  defaultTenantId: vi.fn(() => "tenant-default"),
  findFirst: vi.fn(),
  values: vi.fn(),
  returning: vi.fn(),
}));
const verifiedMessage = vi.hoisted(() => ({
  address: "0xABCDEFabcdefABCDEFabcdefABCDEFabcdefABCD",
  chainId: 5042002,
  verify: vi.fn(async () => ({ success: true })),
}));

vi.mock("@arcanum/db", () => ({
  db: {
    query: { users: { findFirst: directory.findFirst } },
    insert: vi.fn(() => ({ values: directory.values })),
  },
  defaultTenantId: directory.defaultTenantId,
  isDatabaseConfigured: () => directory.configured,
}));
vi.mock("siwe", () => ({
  SiweMessage: class {
    address = verifiedMessage.address;
    chainId = verifiedMessage.chainId;
    verify = verifiedMessage.verify;
  },
}));

const originalEnv = { ...process.env };
const authModule = () => import("./index");

async function login() {
  const { verifySiweLogin } = await authModule();
  return verifySiweLogin({
    message: "signed message",
    signature: "signature",
    expectedNonce: "nonce",
  });
}

describe("SIWE login directory policy", () => {
  beforeEach(() => {
    vi.resetModules();
    directory.configured = true;
    directory.defaultTenantId.mockReturnValue("tenant-default");
    directory.findFirst.mockReset();
    directory.values.mockReset();
    directory.returning.mockReset();
    directory.values.mockReturnValue({ returning: directory.returning });
    Reflect.deleteProperty(process.env, "ARCANUM_DEPLOYMENT_MODE");
    Reflect.deleteProperty(process.env, "ARCANUM_OPEN_REGISTRATION");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("uses the stored role for a registered wallet", async () => {
    directory.findFirst.mockResolvedValue({
      walletAddress: verifiedMessage.address.toLowerCase(),
      tenantId: "tenant-default",
      role: "council",
    });
    await expect(login()).resolves.toMatchObject({ role: "council", tenantId: "tenant-default" });
  });

  it("rejects an unknown wallet when open registration is disabled", async () => {
    directory.findFirst.mockResolvedValue(undefined);
    await expect(login()).rejects.toThrow("Wallet is not registered for this tenant");
    expect(directory.values).not.toHaveBeenCalled();
  });

  it("creates a viewer for an unknown wallet when registration is open", async () => {
    process.env.ARCANUM_OPEN_REGISTRATION = "true";
    directory.findFirst.mockResolvedValue(undefined);
    directory.returning.mockResolvedValue([
      {
        walletAddress: verifiedMessage.address.toLowerCase(),
        tenantId: "tenant-default",
        role: "viewer",
      },
    ]);
    await expect(login()).resolves.toMatchObject({ role: "viewer" });
    expect(directory.values).toHaveBeenCalledWith(
      expect.objectContaining({ role: "viewer", tenantId: "tenant-default" }),
    );
  });

  it("fails closed without a configured directory", async () => {
    directory.configured = false;
    await expect(login()).rejects.toThrow("Wallet is not registered for this tenant");
    expect(directory.findFirst).not.toHaveBeenCalled();
  });

  it("issues viewer sessions and warns once in directoryless registration mode", async () => {
    directory.configured = false;
    process.env.ARCANUM_OPEN_REGISTRATION = "true";
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    await expect(login()).resolves.toMatchObject({ role: "viewer" });
    await expect(login()).resolves.toMatchObject({ role: "viewer" });
    expect(warning).toHaveBeenCalledTimes(1);
  });

  it("propagates directory failures without attempting registration", async () => {
    const outage = new Error("directory unavailable");
    directory.findFirst.mockRejectedValue(outage);
    process.env.ARCANUM_OPEN_REGISTRATION = "true";
    await expect(login()).rejects.toBe(outage);
    expect(directory.values).not.toHaveBeenCalled();
  });
});

describe("resolveTenantId", () => {
  beforeEach(() => {
    vi.resetModules();
    directory.defaultTenantId.mockReturnValue("tenant-default");
    Reflect.deleteProperty(process.env, "ARCANUM_DEPLOYMENT_MODE");
    Reflect.deleteProperty(process.env, "ARCANUM_TENANT_APP_EXAMPLE_COM");
  });
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("returns the default tenant in single-tenant mode", async () => {
    expect((await authModule()).resolveTenantId("unknown.example")).toBe("tenant-default");
  });

  it("rejects an unknown host in multi-tenant mode", async () => {
    process.env.ARCANUM_DEPLOYMENT_MODE = "multi-tenant";
    const { resolveTenantId } = await authModule();
    expect(() => resolveTenantId("unknown.example")).toThrow("Unknown tenant host");
  });

  it("resolves a mapped host in multi-tenant mode", async () => {
    process.env.ARCANUM_DEPLOYMENT_MODE = "multi-tenant";
    process.env.ARCANUM_TENANT_APP_EXAMPLE_COM = "tenant-mapped";
    expect((await authModule()).resolveTenantId("APP.EXAMPLE.COM:443")).toBe("tenant-mapped");
  });
});

describe("session lifetime enforcement", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SIWE_SECRET = "s".repeat(32);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("sets the iron-session seal and cookie lifetime to exactly seven days", async () => {
    const { getSessionOptions, SESSION_TTL_SECONDS } = await authModule();
    const options = getSessionOptions();

    expect(options.ttl).toBe(SESSION_TTL_SECONDS);
    expect(options.cookieOptions?.maxAge).toBe(SESSION_TTL_SECONDS);
  });

  it("rejects an expired application session inside an otherwise valid longer-lived seal", async () => {
    const { isCurrentSession, SESSION_TTL_SECONDS } = await authModule();
    const expiredUser = {
      walletAddress: verifiedMessage.address,
      tenantId: "tenant-default",
      role: "viewer" as const,
      expiresAt: Date.now() - 1,
    };
    const seal = await sealData(
      { user: expiredUser },
      { password: process.env.SIWE_SECRET as string, ttl: SESSION_TTL_SECONDS * 2 },
    );
    const recovered = await unsealData<{ user: typeof expiredUser }>(seal, {
      password: process.env.SIWE_SECRET as string,
      ttl: SESSION_TTL_SECONDS * 2,
    });

    expect(recovered.user).toEqual(expiredUser);
    expect(isCurrentSession(recovered.user)).toBe(false);
  });
});
