import type { ArcanumSession } from "@arcanum/auth";
import { type ArcanumDb, db } from "@arcanum/db";
import { IS_ARC_MAINNET, arcChain } from "@arcanum/shared";
import { http, type PublicClient, createPublicClient } from "viem";

import { type SupabaseServiceRoleClient, createSupabaseServiceRoleClient } from "./supabase";

export type ApiContext = {
  db: ArcanumDb;
  session: ArcanumSession | null;
  /** Opaque cookie credential; never exposed by a resolver. */
  sessionId?: string;
  expectedTenantId?: string;
  publicClient: PublicClient;
  supabase: SupabaseServiceRoleClient | null;
  requestFingerprint: string | null;
  env: { authConfigured: boolean; allowDevAuth: boolean };
};

export function createContext(input?: {
  session?: ArcanumSession | null;
  sessionId?: string;
  expectedTenantId?: string;
  database?: ArcanumDb;
  publicClient?: PublicClient;
  supabase?: SupabaseServiceRoleClient | null;
  requestFingerprint?: string | null;
  env?: Partial<ApiContext["env"]>;
}): ApiContext {
  return {
    db: input?.database ?? db,
    session: input?.session ?? null,
    sessionId: input?.sessionId,
    expectedTenantId: input?.expectedTenantId,
    supabase: input?.supabase ?? createSupabaseServiceRoleClient(),
    requestFingerprint: input?.requestFingerprint ?? null,
    env: {
      authConfigured: input?.env?.authConfigured ?? true,
      // Fail closed: the local-dev session bypass requires NODE_ENV to be
      // explicitly "development". A deployment that forgets to set NODE_ENV
      // (staging, preview) therefore rejects anonymous callers, and
      // ARCANUM_REQUIRE_AUTH=true (set in production deployment config)
      // disables the bypass unconditionally.
      allowDevAuth:
        input?.env?.allowDevAuth ??
        (process.env.NODE_ENV === "development" &&
          process.env.ARCANUM_SESSION_STORE_MODE === "local-test" &&
          process.env.ARCANUM_REQUIRE_AUTH !== "true"),
    },
    publicClient:
      input?.publicClient ??
      createPublicClient({
        chain: arcChain,
        // ARC_TESTNET_RPC is the legacy testnet-only name; consulting it on
        // mainnet would let a copied env file point a mainnet API at testnet.
        transport: http(
          process.env.ARC_RPC_URL ??
            (IS_ARC_MAINNET ? undefined : process.env.ARC_TESTNET_RPC) ??
            arcChain.rpcUrls.default.http[0],
        ),
      }),
  };
}
