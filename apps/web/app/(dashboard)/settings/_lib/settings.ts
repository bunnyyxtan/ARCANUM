import type { TeamMember } from "@/lib/types";

export const settingsTabs = ["TEAM", "ORGANIZATION", "INTEGRATIONS", "WEBHOOKS"] as const;

export type SettingsTab = (typeof settingsTabs)[number];

// Ownership is not offered here. Handing the workspace to someone else is a
// different decision from letting them in, and it deserves its own deliberate
// act rather than a dropdown entry next to "viewer".
export const inviteRoles = [
  ["viewer", "Reads the ledger and policies."],
  ["approver", "Can decide escalations."],
  ["admin", "Manages the workspace day to day."],
] as const;

export type InviteRole = (typeof inviteRoles)[number][0];

export const walletPattern = /^0x[0-9a-fA-F]{40}$/;

export function roleClass(role: TeamMember["role"]): string {
  if (role === "admin") return "bg-[var(--wl-ink)] text-[var(--wl-bg)]";
  if (role === "approver") {
    return "border border-[var(--wl-signal)] text-[var(--wl-signal)]";
  }
  return "border border-[var(--wl-line)] text-[var(--wl-body)]";
}
