import { createHash } from "node:crypto";
import { defaultTenantId } from "@arcanum/db";
import type { Agent, Wallet } from "@arcanum/db/schema";
import type { ApiContext } from "../context";
import { forgetCallerMembership } from "./auth";
import {
  type SupabaseRow,
  type SupabaseServiceRoleClient,
  type SupabaseWriteResult,
  createSupabaseServiceRoleClient,
  unavailableWrite,
  unconfiguredWrite,
  warnSupabase,
} from "./client";
import { arrayField, booleanField, numberField, stringField } from "./fields";
import { requiredStringField } from "./internal";
import {
  DEFAULT_WORKSPACE_NAME,
  agentFromSigner,
  postureFromDoctrineRow,
  shortAddress,
  walletFromGovernedWalletRow,
  workspaceSlugForWallet,
} from "./mappers";
import { readSupabaseWalletByAddressUnscoped } from "./wallets";

export type SupabaseCreatedWalletInput = {
  walletAddress: `0x${string}`;
  ownerAddress: `0x${string}`;
  label: string;
  deployTxHash: `0x${string}`;
  chainId: number;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  requireAllowlist: boolean;
  signers: `0x${string}`[];
  council: `0x${string}`[];
  quorum: number;
};

export type SupabaseDeployedPolicyInput = {
  walletAddress: `0x${string}`;
  txHash: `0x${string}`;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  allowedCategories: string[];
  requireAllowlist: boolean;
};

export type SupabaseEscalationDecisionInput = {
  escalationKey: `0x${string}`;
  status: "released" | "denied" | "expired";
  txHash: `0x${string}`;
  approvalsCount: number;
};

export async function recordSupabaseDeployedPolicy(
  ctx: ApiContext,
  wallet: Wallet,
  input: SupabaseDeployedPolicyInput,
): Promise<SupabaseWriteResult<{ version: number }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("policy deployment");
  }

  try {
    const [current] = await client.selectRows("doctrines", {
      filters: { governed_wallet_id: wallet.id },
      order: "version.desc",
      limit: 1,
    });

    // Mirroring the same onchain policy twice must not inflate the doctrine
    // version: a retry after a network blip should be a no-op.
    const currentCategories = arrayField(current, ["allowed_categories"])
      .map((category) => String(category).toLowerCase())
      .sort();
    const nextCategories = [...input.allowedCategories]
      .map((category) => category.toLowerCase())
      .sort();
    const unchanged =
      Boolean(current) &&
      numberField(current, ["daily_cap_usdc"], -1) === input.dailyCap &&
      numberField(current, ["per_tx_cap_usdc"], -1) === input.perTxCap &&
      numberField(current, ["monthly_cap_usdc"], -1) === input.monthlyCap &&
      numberField(current, ["escalate_above_usdc"], -1) === input.escalationThreshold &&
      booleanField(current, ["require_vendor_allowlist"], false) === input.requireAllowlist &&
      currentCategories.join(",") === nextCategories.join(",");

    if (unchanged) {
      return {
        ok: true,
        data: { version: numberField(current, ["version"], 1) },
      };
    }

    const version = numberField(current, ["version"], 0) + 1;
    const now = new Date().toISOString();

    await writeDoctrineRow(
      client,
      {
        governed_wallet_id: wallet.id,
        organization_id: current
          ? stringField(current, ["organization_id"], wallet.orgId)
          : wallet.orgId,
        name: stringField(current, ["name"], `${wallet.label} Doctrine`),
        version,
        daily_cap_usdc: input.dailyCap,
        per_tx_cap_usdc: input.perTxCap,
        per_vendor_daily_cap_usdc: input.perTxCap,
        monthly_cap_usdc: input.monthlyCap,
        escalate_above_usdc: input.escalationThreshold,
        allowed_categories: input.allowedCategories,
        require_vendor_allowlist: input.requireAllowlist,
        // Signers, council and quorum are governed by their own onchain
        // transactions, so a policy deployment must carry them over untouched.
        signers: arrayField(current, ["signers"]),
        escalation_council: arrayField(current, ["escalation_council"]),
        quorum: numberField(current, ["quorum"], 1),
        status: "active",
        source: "on_chain",
        updated_at: now,
      },
      wallet.id,
    );

    return { ok: true, data: { version } };
  } catch (error) {
    warnSupabase("policy-deployment.write", error);
    return unavailableWrite("policy deployment", error);
  }
}

/**
 * Mirror an escalation decision that is already settled onchain. Callers must
 * verify the onchain status first; this only writes what the chain reports.
 */
export async function recordSupabaseEscalationDecision(
  ctx: ApiContext,
  wallet: Wallet,
  input: SupabaseEscalationDecisionInput,
): Promise<SupabaseWriteResult<{ status: string }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("escalation decision");
  }

  try {
    const patch: SupabaseRow = {
      status: input.status,
      approvals_count: input.approvalsCount,
      updated_at: new Date().toISOString(),
    };

    if (input.status === "released") {
      patch.release_tx_hash = input.txHash;
    }
    if (input.status === "denied") {
      patch.deny_tx_hash = input.txHash;
    }

    const updated = await client.patchRows("escalations", patch, {
      escalation_key: input.escalationKey,
      governed_wallet_id: wallet.id,
    });

    // Reporting success for a patch that matched nothing would leave the queue
    // showing a decision that was never mirrored.
    if (!updated || updated.length === 0) {
      return {
        ok: false,
        reason: "unavailable",
        message:
          "The escalation is settled onchain but no matching row exists in the read model yet.",
      };
    }

    return { ok: true, data: { status: input.status } };
  } catch (error) {
    return unavailableWrite("escalation decision", error);
  }
}

export async function recordSupabaseCreatedWallet(
  ctx: ApiContext,
  input: SupabaseCreatedWalletInput,
): Promise<SupabaseWriteResult<{ wallet: Wallet; agent: Agent | null }>> {
  const client = ctx.supabase;
  if (!client) {
    return unconfiguredWrite("created wallet");
  }

  const walletAddress = input.walletAddress.toLowerCase();
  const ownerAddress = input.ownerAddress.toLowerCase();

  try {
    const workspace = await ensureOwnerWorkspaceForWallet(client, ownerAddress);
    const now = new Date().toISOString();
    const walletRow = {
      organization_id: workspace.organizationId,
      wallet_address: walletAddress,
      owner_address: ownerAddress,
      label: input.label,
      deploy_tx_hash: input.deployTxHash.toLowerCase(),
      chain_id: input.chainId,
      status: "pending_indexer",
      indexer_status: "pending",
      data_source: "live",
      created_at: now,
      updated_at: now,
      wallet_factory_address: process.env.NEXT_PUBLIC_WALLET_FACTORY,
      policy_engine_address: process.env.NEXT_PUBLIC_POLICY_ENGINE,
      vendor_registry_address: process.env.NEXT_PUBLIC_VENDOR_REGISTRY,
      escalation_manager_address: process.env.NEXT_PUBLIC_ESCALATION_MANAGER,
      anomaly_oracle_address: process.env.NEXT_PUBLIC_ANOMALY_ORACLE,
      created_by: workspace.profileId,
    };
    const [writtenWallet] = await client.upsertRows(
      "governed_wallets",
      [walletRow],
      "wallet_address,chain_id",
    );
    const walletId = requiredStringField(writtenWallet ?? walletRow, ["id"], "governed_wallets.id");

    const doctrineRow = {
      governed_wallet_id: walletId,
      organization_id: workspace.organizationId,
      name: `${input.label} Doctrine`,
      version: 1,
      daily_cap_usdc: input.dailyCap,
      per_tx_cap_usdc: input.perTxCap,
      per_vendor_daily_cap_usdc: input.perTxCap,
      monthly_cap_usdc: input.monthlyCap,
      escalate_above_usdc: input.escalationThreshold,
      allowed_categories: ["api", "compute", "data", "other"],
      require_vendor_allowlist: input.requireAllowlist,
      signers: input.signers.map((address) => address.toLowerCase()),
      escalation_council: input.council.map((address) => address.toLowerCase()),
      quorum: input.quorum,
      status: "active",
      source: "supabase",
      updated_at: now,
    };
    const publicProfileRow = {
      governed_wallet_id: walletId,
      wallet_address: walletAddress,
      show_public_badge: false,
      posture_score: postureFromDoctrineRow(doctrineRow as SupabaseRow, false),
      health_grade: "PENDING INDEXER",
      summary: `${input.label} is synced in Supabase. Onchain event history may lag.`,
      updated_at: now,
    };

    await writeDoctrineRow(client, doctrineRow, walletId);
    await writePublicWalletProfileRow(client, publicProfileRow, walletAddress);

    const wallet = walletFromGovernedWalletRow(writtenWallet ?? walletRow);
    const [primarySigner] = doctrineRow.signers;
    return {
      ok: true,
      data: {
        wallet,
        agent: primarySigner
          ? agentFromSigner(wallet, primarySigner, doctrineRow, publicProfileRow.posture_score)
          : null,
      },
    };
  } catch (error) {
    warnSupabase("created-wallet.write", error);
    return unavailableWrite("created wallet", error);
  }
}

export async function ensureOwnerWorkspaceForWallet(
  client: SupabaseServiceRoleClient,
  ownerAddress: string,
) {
  const walletAddress = ownerAddress.toLowerCase();
  const now = new Date().toISOString();
  const [existingProfile] = await client.selectRows("profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });
  const profile =
    existingProfile ??
    (
      await client.upsertRows("profiles", [
        {
          wallet_address: walletAddress,
          display_name: shortAddress(walletAddress),
          updated_at: now,
        },
      ])
    )[0];
  const profileId = requiredStringField(profile, ["id"], "profiles.id");

  // A wallet that already belongs to a workspace must not be handed a second
  // one. Provisioning used to look only for a workspace this profile *created*,
  // so an invited teammate signing in for the first time was given an empty
  // workspace of their own -- and then "which workspace am I in?" had two
  // answers, decided by whichever row the database returned first.
  const [existingMembership] = await client.selectRows("organization_members", {
    filters: { profile_id: profileId },
    limit: 1,
  });
  const memberOrgId = existingMembership
    ? stringField(existingMembership, ["organization_id"], "")
    : "";
  if (memberOrgId) {
    return { profileId, organizationId: memberOrgId };
  }

  const [existingOrganization] = await client.selectRows("organizations", {
    filters: { created_by: profileId },
    limit: 1,
    order: "created_at.asc",
  });
  const organization =
    existingOrganization ??
    (
      await client.upsertRows("organizations", [
        {
          name: DEFAULT_WORKSPACE_NAME,
          slug: workspaceSlugForWallet(walletAddress),
          safe_address: walletAddress,
          created_by: profileId,
          plan: "free",
          updated_at: now,
        },
      ])
    )[0];
  const organizationId = requiredStringField(organization, ["id"], "organizations.id");

  await client.upsertRows(
    "organization_members",
    [
      {
        organization_id: organizationId,
        profile_id: profileId,
        role: "owner",
      },
    ],
    "organization_id,profile_id",
  );

  return { profileId, organizationId };
}

export async function writeDoctrineRow(
  client: SupabaseServiceRoleClient,
  row: SupabaseRow,
  governedWalletId: string,
) {
  const version = numberField(row, ["version"], 1);
  const [existing] = await client.selectRows("doctrines", {
    filters: { governed_wallet_id: governedWalletId, version },
    limit: 1,
  });
  const existingId = stringField(existing, ["id"], "");

  if (existingId) {
    await client.patchRows("doctrines", row, { id: existingId });
    return;
  }

  await client.upsertRows("doctrines", [{ ...row, created_at: new Date().toISOString() }]);
}

export async function writePublicWalletProfileRow(
  client: SupabaseServiceRoleClient,
  row: SupabaseRow,
  walletAddress: string,
) {
  const [existing] = await client.selectRows("public_wallet_profiles", {
    filters: { wallet_address: walletAddress },
    limit: 1,
  });
  const existingId = stringField(existing, ["id"], "");

  if (existingId) {
    // The indexer owns health_grade/summary once it has seen onchain events
    // for this wallet; re-recording a deploy must not knock the profile back
    // into the PENDING INDEXER state.
    const alreadyIndexed = Boolean(stringField(existing, ["last_indexed_at"], ""));
    const patch = alreadyIndexed
      ? Object.fromEntries(
          Object.entries(row).filter(([key]) => key !== "health_grade" && key !== "summary"),
        )
      : row;
    await client.patchRows("public_wallet_profiles", patch, { id: existingId });
    return;
  }

  await client.upsertRows("public_wallet_profiles", [
    { ...row, created_at: new Date().toISOString() },
  ]);
}
