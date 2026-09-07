"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

import { useLiveMembers, useLiveOrg } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";

import {
  type InviteRole,
  type SettingsTab,
  inviteRoles,
  settingsTabs,
  walletPattern,
} from "../_lib/settings";
import { useNotice } from "./use-notice";

function useSettingsControllerInternal() {
  const { address, isConnected } = useAccount();
  const utils = trpc.useUtils();
  const liveMembers = useLiveMembers();
  const org = useLiveOrg();
  const [activeTab, setActiveTab] = useState<SettingsTab>(settingsTabs[0]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteWallet, setInviteWallet] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<InviteRole>(inviteRoles[0][0]);

  const members = liveMembers.data;
  // The database decides who may change access, and the server reports the
  // caller's role directly. The page mirrors that decision instead of offering
  // controls that would be refused on submit.
  const isOwner = org.data?.callerRole === "owner";
  // Before the wallet signs in there is no organisation query to answer this,
  // so the header says what is actually true rather than naming a workspace.
  const orgName = org.data?.name ?? (org.isLoading ? "Loading…" : "Connect Wallet");
  const memberCaption = members.length > 0 ? "LIVE MEMBERS" : "ADD YOUR FIRST REVIEWER";
  const { notice, showNotice } = useNotice();

  const refreshTeam = () =>
    Promise.all([utils.org.listMembers.invalidate(), utils.org.members.invalidate()]);

  const addMember = trpc.org.addMember.useMutation({
    onSuccess: async () => {
      await refreshTeam();
      setInviteWallet("");
      setInviteOpen(false);
      showNotice("Member added to the workspace.");
    },
    onError: (error) => showNotice(error.message),
  });

  const removeMember = trpc.org.removeMember.useMutation({
    onSuccess: async () => {
      await refreshTeam();
      showNotice("Member removed from the workspace.");
    },
    onError: (error) => showNotice(error.message),
  });

  const renameWorkspace = trpc.org.update.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.org.getCurrent.invalidate(), utils.org.currentOrg.invalidate()]);
      setNameDraft(null);
      showNotice("Workspace name saved.");
    },
    onError: (error) => showNotice(error.message),
  });

  // Until the field is touched it shows whatever the workspace is called now,
  // without an effect to copy server state into local state.
  const nameValue = nameDraft ?? org.data?.name ?? "";
  const renameReady = nameValue.trim().length >= 2 && nameValue.trim() !== org.data?.name;
  const inviteReady = walletPattern.test(inviteWallet.trim());
  const invite = () => {
    if (!isOwner || !inviteReady || addMember.isPending) return;
    addMember.mutate({ walletAddress: inviteWallet.trim(), role: inviteRole });
  };

  return {
    address,
    isConnected,
    liveMembers,
    org,
    members,
    isOwner,
    orgName,
    memberCaption,
    activeTab,
    setActiveTab,
    inviteOpen,
    setInviteOpen,
    inviteWallet,
    setInviteWallet,
    nameDraft,
    setNameDraft,
    inviteRole,
    setInviteRole,
    notice,
    addMember,
    removeMember,
    renameWorkspace,
    nameValue,
    renameReady,
    inviteReady,
    invite,
  };
}

export type SettingsController = ReturnType<typeof useSettingsControllerInternal>;

export function useSettingsController(): SettingsController {
  return useSettingsControllerInternal();
}
