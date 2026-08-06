"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { useLiveMembers, useLiveOrg } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { TeamMember } from "@/lib/types";

const tabs = ["TEAM", "ORGANIZATION", "INTEGRATIONS", "WEBHOOKS"] as const;

// Ownership is not offered here. Handing the workspace to someone else is a
// different decision from letting them in, and it deserves its own deliberate
// act rather than a dropdown entry next to "viewer".
const inviteRoles = [
  ["viewer", "Reads the ledger and policies."],
  ["approver", "Can decide escalations."],
  ["admin", "Manages the workspace day to day."],
] as const;

const walletPattern = /^0x[0-9a-fA-F]{40}$/;

function roleClass(role: TeamMember["role"]) {
  if (role === "admin") return "bg-[var(--wl-ink)] text-[var(--wl-bg)]";
  if (role === "approver") return "border border-[var(--wl-signal)] text-[var(--wl-signal)]";
  return "border border-[var(--wl-line)] text-[var(--wl-body)]";
}

export default function SettingsPage() {
  const { address, isConnected } = useAccount();
  const utils = trpc.useUtils();
  const liveMembers = useLiveMembers();
  const org = useLiveOrg();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("TEAM");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteWallet, setInviteWallet] = useState("");
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<(typeof inviteRoles)[number][0]>("viewer");

  const members = liveMembers.data;
  // The database decides who may change access, and the server reports the
  // caller's role directly. The page mirrors that decision instead of offering
  // controls that would be refused on submit.
  const isOwner = org.data?.callerRole === "owner";
  // Before the wallet signs in there is no organisation query to answer this,
  // so the header says what is actually true rather than naming a workspace.
  const orgName = org.data?.name ?? (org.isLoading ? "Loading…" : "Connect Wallet");
  const memberCaption = members.length > 0 ? "LIVE MEMBERS INDEXED" : "ADD YOUR FIRST REVIEWER";

  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2800);
  };
  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

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

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .member-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}
        .member-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        .settings-tab{transition:color 220ms ease,background-color 220ms ease}
        .settings-tab:hover{background:var(--wl-bg-soft)}
        @media (prefers-reduced-motion:reduce){.member-row{transition:none!important;transform:none!important}}
        @media (max-width:900px){.settings-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
          <div className="warm-reveal is-visible">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
              WORKSPACE / GOVERNANCE
            </p>
            <h1 className="font-display mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.015em]">
              Settings
            </h1>
            <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-secondary2)]">
              Keep the people, permissions, and integrations around governed spend legible.
            </p>
          </div>
          <div className="flex flex-col items-start gap-1.5 max-md:w-full md:items-end">
            <button
              type="button"
              disabled={!isConnected || !isOwner}
              title={
                !isConnected
                  ? "Connect wallet first."
                  : !isOwner
                    ? "Only the workspace owner can change who has access."
                    : undefined
              }
              onClick={() => {
                if (!isConnected || !isOwner) return;
                setInviteOpen(true);
              }}
              className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Invite member{" "}
              <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
                ↗
              </span>
            </button>
            {!isConnected ? (
              <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                CONNECT WALLET FIRST
              </span>
            ) : isOwner ? null : (
              <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                OWNER ONLY
              </span>
            )}
          </div>
        </div>

        <div className="settings-grid mt-16 grid grid-cols-[210px_1fr] gap-12">
          <aside className="border-t border-[var(--wl-line)]">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`settings-tab relative flex w-full items-center border-b border-[var(--wl-line)] px-4 py-4 text-left font-mono text-[10px] tracking-[.16em] ${
                  activeTab === tab
                    ? "bg-[var(--wl-bg-soft)] text-[var(--wl-ink)]"
                    : "text-[var(--wl-secondary)]"
                }`}
              >
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 top-0 w-[2px] bg-[var(--wl-signal)]" />
                )}
                {tab}
              </button>
            ))}
            <p className="mt-7 px-4 font-mono text-[9px] uppercase leading-[1.6] tracking-[.12em] text-[var(--wl-mute)]">
              Changes are reviewed by the workspace owner before they affect a wallet.
            </p>
          </aside>

          <div className="min-w-0">
            {activeTab === "TEAM" ? (
              <>
                <section className="grid border-y border-[var(--wl-line)] md:grid-cols-3">
                  {[
                    ["ORGANIZATION", orgName],
                    ["DEPLOYMENT", "ARC TESTNET"],
                    ["MEMBERS", String(members.length).padStart(2, "0")],
                  ].map(([label, value], index) => (
                    <div
                      key={label}
                      className="warm-reveal is-visible border-r border-[var(--wl-line)] px-6 py-6 first:pl-0 last:border-r-0 max-md:border-b max-md:border-r-0 max-md:px-0"
                      style={{ "--i": index + 1 } as CSSProperties}
                    >
                      <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
                        {label}
                      </p>
                      <p className="mt-5 text-[15px] font-medium tracking-[-.02em]">{value}</p>
                    </div>
                  ))}
                </section>

                <section className="mt-16">
                  <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                        ACCESS / TEAM MEMBERS
                      </p>
                      <h2 className="font-display mt-4 text-[26px] font-semibold tracking-[-.015em]">
                        The people with a say.
                      </h2>
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                      {members.length.toString().padStart(2, "0")} MEMBERS · {memberCaption}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1.8fr_.8fr_.8fr_auto] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] max-md:grid-cols-[1fr_.7fr] max-md:gap-2">
                    <span>MEMBER</span>
                    <span>ROLE</span>
                    <span className="max-md:hidden">LAST ACTIVE</span>
                    <span className="max-md:hidden" />
                  </div>
                  <div>
                    {liveMembers.isLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="border-b border-[var(--wl-line-soft)] px-4 py-4">
                          <div className="h-8 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
                        </div>
                      ))
                    ) : liveMembers.isError ? (
                      <div className="px-4 py-16 text-center">
                        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                          UNABLE TO LOAD MEMBERS
                        </p>
                        <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                          The workspace member list could not be read.
                        </p>
                      </div>
                    ) : members.length === 0 ? (
                      <div className="px-4 py-16 text-center">
                        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                          NO TEAM MEMBERS YET
                        </p>
                        <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                          Add a teammate by wallet address to share this workspace&rsquo;s ledger,
                          policies and escalations.
                        </p>
                      </div>
                    ) : (
                      members.map((member, index) => (
                        <div
                          key={member.id}
                          className="member-row warm-reveal is-visible grid grid-cols-[1.8fr_.8fr_.8fr_auto] items-center gap-4 border-b border-[var(--wl-line-soft)] px-4 py-4 max-md:grid-cols-[1fr_.7fr] max-md:gap-2"
                          style={{ "--i": index + 2 } as CSSProperties}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--wl-ink)] font-mono text-[9px] text-[var(--wl-bg)]">
                              {member.initials}
                            </span>
                            <span className="min-w-0">
                              <strong className="block truncate text-[13px] font-medium">
                                {member.name}
                              </strong>
                              <span className="mt-0.5 block truncate font-mono text-[10px] text-[var(--wl-secondary)]">
                                {member.wallet}
                              </span>
                            </span>
                          </div>
                          <span
                            className={`w-fit rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${roleClass(member.role)}`}
                          >
                            {member.role}
                          </span>
                          <span
                            className={`font-mono text-[10px] tabular-nums ${
                              member.status === "active"
                                ? "text-[var(--wl-ink)]"
                                : "text-[var(--wl-secondary)]"
                            } max-md:hidden`}
                          >
                            {member.status === "active" ? "active now" : member.lastActive}
                          </span>
                          <span className="flex justify-end max-md:hidden">
                            {isOwner && member.wallet.toLowerCase() !== address?.toLowerCase() && (
                              <button
                                type="button"
                                disabled={removeMember.isPending}
                                onClick={() =>
                                  removeMember.mutate({ walletAddress: member.wallet })
                                }
                                className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                REMOVE
                              </button>
                            )}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : activeTab === "ORGANIZATION" ? (
              <section className="warm-reveal is-visible">
                <div className="border-b border-[var(--wl-line)] pb-4">
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                    WORKSPACE / ORGANIZATION
                  </p>
                  <h2 className="font-display mt-4 text-[26px] font-semibold tracking-[-.015em]">
                    What this workspace is called.
                  </h2>
                </div>

                <div className="mt-8 max-w-[560px]">
                  <label className="block">
                    <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                      WORKSPACE NAME
                    </span>
                    <input
                      value={nameValue}
                      disabled={!isOwner || org.isLoading}
                      onChange={(event) => setNameDraft(event.target.value)}
                      maxLength={120}
                      className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 text-[16px] outline-none transition-colors focus:border-[var(--wl-signal)] disabled:cursor-not-allowed disabled:text-[var(--wl-secondary)]"
                    />
                  </label>
                  <p className="mt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                    {isOwner
                      ? "EVERY MEMBER SEES THIS NAME"
                      : "ONLY THE WORKSPACE OWNER CAN RENAME THIS"}
                  </p>

                  {isOwner && (
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        type="button"
                        disabled={!renameReady || renameWorkspace.isPending}
                        onClick={() => {
                          if (!renameReady || renameWorkspace.isPending) return;
                          renameWorkspace.mutate({ name: nameValue.trim() });
                        }}
                        className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {renameWorkspace.isPending ? "Saving…" : "Save name"}
                      </button>
                      {nameDraft !== null && (
                        <button
                          type="button"
                          onClick={() => setNameDraft(null)}
                          className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
                        >
                          RESET
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <dl className="mt-14 border-t border-[var(--wl-line)]">
                  {[
                    ["NETWORK", "Arc Testnet · chain 5042002"],
                    ["MEMBERS", `${members.length} with access`],
                    ["YOUR ROLE", (org.data?.callerRole ?? "-").toUpperCase()],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="grid grid-cols-[140px_1fr] gap-6 border-b border-[var(--wl-line-soft)] py-4"
                    >
                      <dt className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
                        {label}
                      </dt>
                      <dd className="text-[13px] text-[var(--wl-body)]">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : (
              <section className="warm-reveal is-visible border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:p-10">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                  WORKSPACE / {activeTab}
                </p>
                <h2 className="font-display mt-7 text-[34px] font-semibold tracking-[-.015em]">
                  {activeTab[0] + activeTab.slice(1).toLowerCase()}
                </h2>
                <p className="mt-5 max-w-[560px] text-[15px] leading-[1.5] text-[var(--wl-secondary2)]">
                  This workspace surface is owner-managed. Review and approval controls for{" "}
                  {activeTab.toLowerCase()} will appear here when configured for {orgName}.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab("TEAM")}
                  className="warm-pill warm-pill-ghost mt-8 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
                >
                  Back to team
                </button>
              </section>
            )}
          </div>
        </div>
      </div>

      {inviteOpen && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.18)] p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
        >
          <div className="w-full max-w-[450px] border border-[var(--wl-line)] bg-[var(--wl-bg)] p-7 shadow-[0_24px_50px_-28px_rgba(var(--wl-ink-rgb),.6)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                  TEAM / INVITATION
                </p>
                <h2 className="font-display mt-4 text-[28px] font-semibold tracking-[-.015em]">
                  Invite a member.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="font-mono text-[11px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
              >
                CLOSE
              </button>
            </div>
            <label className="mt-8 block">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                WALLET ADDRESS
              </span>
              <input
                value={inviteWallet}
                onChange={(event) => setInviteWallet(event.target.value)}
                spellCheck={false}
                autoFocus
                className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 font-mono text-[13px] outline-none transition-colors placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
                placeholder="0x…"
              />
              <span className="mt-2 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                THEY SIGN IN WITH THIS WALLET · NO EMAIL, NO PASSWORD
              </span>
            </label>
            <fieldset className="mt-7">
              <legend className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                ROLE
              </legend>
              <div className="mt-3 space-y-1">
                {inviteRoles.map(([value, detail]) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-3 border-b border-[var(--wl-line-soft)] py-3 ${
                      inviteRole === value ? "text-[var(--wl-ink)]" : "text-[var(--wl-secondary)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={value}
                      checked={inviteRole === value}
                      onChange={() => setInviteRole(value)}
                      className="mt-1 accent-[var(--wl-signal)]"
                    />
                    <span>
                      <strong className="block font-mono text-[10px] uppercase tracking-[.14em]">
                        {value}
                      </strong>
                      <span className="mt-1 block text-[12px] text-[var(--wl-secondary)]">
                        {detail}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {addMember.error && (
              <p
                role="alert"
                className="mt-5 border-l-2 border-[var(--wl-signal)] pl-3 text-[12px] leading-[1.5] text-[var(--wl-signal)]"
              >
                {addMember.error.message}
              </p>
            )}
            <div className="mt-8 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={invite}
                disabled={!inviteReady || addMember.isPending}
                className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {addMember.isPending ? "Adding…" : "Add member ↗"}
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="fixed bottom-6 right-6 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-5 py-4 text-[12px] text-[var(--wl-ink)] shadow-[0_10px_30px_-20px_rgba(var(--wl-ink-rgb),.7)]"
        >
          {notice}
        </div>
      )}
    </main>
  );
}
