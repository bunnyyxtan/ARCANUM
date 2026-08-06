import { z } from "zod";

/** The roles a workspace can hand out, mirroring the org_role enum in Postgres. */
export const workspaceRoleSchema = z.enum(["owner", "admin", "approver", "viewer"]);

export const orgCreateInputSchema = z.object({
  name: z.string().trim().min(2, "Give your workspace a name").max(120),
});

export const orgMemberAddInputSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid wallet address"),
  // A teammate arrives read-only unless the owner says otherwise.
  role: workspaceRoleSchema.default("viewer"),
});

export const orgMemberRemoveInputSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Enter a valid wallet address"),
});

export const orgUpdateInputSchema = z.object({
  name: z.string().min(2).max(120),
  defaultPolicyTemplate: z.string().min(2).max(120).default("std-research-v3"),
  notifications: z
    .object({
      email: z.boolean().default(true),
      slack: z.boolean().default(false),
      discord: z.boolean().default(false),
    })
    .default({ email: true, slack: false, discord: false }),
});
