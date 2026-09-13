import { ARC_NETWORK, deploymentManifestFor } from "@arcanum/shared";
import { describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../context";
import { readSupabaseWallets } from "../supabase";
import { agentsRouter } from "./agents";
import { requireWalletOwner } from "./helpers";

const OLD_OWNER = "0x1111111111111111111111111111111111111111";
const NEW_OWNER = "0x2222222222222222222222222222222222222222";
const SIGNER = "0x3333333333333333333333333333333333333333";
const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ORG = "11111111-1111-4111-8111-111111111111";
const FACTORY = deploymentManifestFor(ARC_NETWORK).walletFactory.toLowerCase();

function wallet(owner: string) {
  return {
    id: "wallet-1",
    organization_id: ORG,
    wallet_address: WALLET,
    owner_address: owner,
    wallet_factory_address: FACTORY,
    label: "Transferred wallet",
    status: "active",
    created_at: "2026-09-12T00:00:00.000Z",
  };
}

function signerContext(
  actor: string,
  options: { owner: string; signerAuthorized: boolean; readModelOwner?: string },
) {
  const patchRows = vi.fn(async (_table: string, patch: Record<string, unknown>) => [patch]);
  const row = wallet(options.readModelOwner ?? options.owner);
  const supabase = {
    configured: true,
    selectRows: vi.fn(async (table: string, query?: { filters?: Record<string, unknown> }) => {
      if (table === "governed_wallets") {
        const filters = query?.filters ?? {};
        if (
          filters.wallet_address &&
          String(filters.wallet_address).toLowerCase() !== WALLET.toLowerCase()
        ) {
          return [];
        }
        if (
          filters.wallet_factory_address &&
          String(filters.wallet_factory_address).toLowerCase() !== FACTORY
        ) {
          return [];
        }
        if (
          filters.owner_address &&
          String(filters.owner_address).toLowerCase() !== String(row.owner_address).toLowerCase()
        ) {
          return [];
        }
        return [row];
      }
      if (table === "doctrines") {
        return [
          {
            id: "doctrine-1",
            governed_wallet_id: "wallet-1",
            signers: [],
            status: "active",
            updated_at: "2026-09-12T00:00:00.000Z",
          },
        ];
      }
      return [];
    }),
    insertRows: vi.fn(async () => []),
    upsertRows: vi.fn(async () => []),
    patchRows,
    callFunction: vi.fn(async () => null),
  };
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "owner") {
      return options.owner;
    }
    if (functionName === "agentSigners") {
      return options.signerAuthorized;
    }
    throw new Error(`unexpected chain read ${functionName}`);
  });

  const ctx: ApiContext = {
    db: null as never,
    session: {
      walletAddress: actor,
      tenantId: "00000000-0000-0000-0000-000000000001",
      role: "viewer",
      expiresAt: Date.now() + 60_000,
    },
    publicClient: { readContract } as never,
    supabase: supabase as ApiContext["supabase"],
    requestFingerprint: "access-control-test",
    env: { authConfigured: true, allowDevAuth: false },
  };

  return { ctx, patchRows, readContract };
}

describe("F05/F06 current authority regressions", () => {
  it("uses chain ownership through the shared guard across the stale mirror interval", async () => {
    const formerOwner = signerContext(OLD_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: false,
      readModelOwner: OLD_OWNER,
    });
    await expect(requireWalletOwner(formerOwner.ctx, WALLET)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });

    const currentOwner = signerContext(NEW_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: false,
      readModelOwner: OLD_OWNER,
    });
    await expect(requireWalletOwner(currentOwner.ctx, WALLET)).resolves.toMatchObject({
      address: WALLET,
      ownerAddress: OLD_OWNER,
    });
  });

  it("resolves the new owner and not the former owner after the mirror transfer", async () => {
    const staleOwnerModel = signerContext(OLD_OWNER, {
      owner: OLD_OWNER,
      signerAuthorized: false,
      readModelOwner: OLD_OWNER,
    });
    const updatedOwnerModel = signerContext(NEW_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: false,
      readModelOwner: NEW_OWNER,
    });

    expect((await readSupabaseWallets(staleOwnerModel.ctx))[0]?.address).toBe(WALLET);
    expect((await readSupabaseWallets(updatedOwnerModel.ctx))[0]?.address).toBe(WALLET);

    const staleOwnerAfterTransfer = signerContext(OLD_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: false,
      readModelOwner: NEW_OWNER,
    });
    expect(await readSupabaseWallets(staleOwnerAfterTransfer.ctx)).toEqual([]);
  });

  it("rejects the former owner even when the read model still names them", async () => {
    const { ctx, patchRows } = signerContext(OLD_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: true,
      readModelOwner: OLD_OWNER,
    });

    await expect(
      agentsRouter.createCaller(ctx).syncSignerState({
        walletAddress: WALLET,
        signerAddress: SIGNER,
        action: "authorize",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(patchRows).not.toHaveBeenCalled();
  });

  it("persists the chain signer state, not the caller's requested action", async () => {
    const authorized = signerContext(NEW_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: true,
      readModelOwner: OLD_OWNER,
    });
    const authorizedResult = await agentsRouter.createCaller(authorized.ctx).syncSignerState({
      walletAddress: WALLET,
      signerAddress: SIGNER,
      // A caller claim of revoke cannot remove an onchain-authorized signer.
      action: "revoke",
    });
    expect(authorizedResult.signers).toEqual([SIGNER]);
    expect(authorized.patchRows).toHaveBeenCalledWith(
      "doctrines",
      expect.objectContaining({ signers: [SIGNER] }),
      { id: "doctrine-1" },
    );

    const revoked = signerContext(NEW_OWNER, {
      owner: NEW_OWNER,
      signerAuthorized: false,
    });
    const revokedResult = await agentsRouter.createCaller(revoked.ctx).syncSignerState({
      walletAddress: WALLET,
      signerAddress: SIGNER,
      // A caller claim of authorize cannot add a signer absent on chain.
      action: "authorize",
    });
    expect(revokedResult.signers).toEqual([]);
    expect(revoked.patchRows).toHaveBeenCalledWith(
      "doctrines",
      expect.objectContaining({ signers: [] }),
      { id: "doctrine-1" },
    );
  });
});
