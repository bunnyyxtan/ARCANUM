"use client";

import { useState, type CSSProperties } from "react";
import { toast } from "sonner";

import { useLiveMembers, useLiveOrg } from "@/lib/live-data";
import type { TeamMember } from "@/lib/types";

const tabs = ["TEAM", "ORGANIZATION", "INTEGRATIONS", "WEBHOOKS"] as const;

function roleClass(role: TeamMember["role"]) {
  if (role === "admin") return "bg-[var(--wl-ink)] text-[var(--wl-bg)]";
  if (role === "approver") return "border border-[var(--wl-signal)] text-[var(--wl-signal)]";
  return "border border-[var(--wl-line)] text-[var(--wl-body)]";
}

export default function SettingsPage() {
  const liveMembers = useLiveMembers();
  const org = useLiveOrg();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("TEAM");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  const members = liveMembers.data;
  const orgName = org.data?.name ?? (org.isLoading ? "Loading…" : "Live Workspace");
  const memberCaption =
    members.length > 0 ? "LIVE MEMBERS INDEXED" : "INVITE APPROVERS AFTER WALLET SETUP";

  const invite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviteName("");
    setInviteEmail("");
    setInviteOpen(false);
    toast.info(
      "Invite member / approver invitations are not enabled in this Arc Testnet deployment yet.",
    );
  };

  return (
    <main
      className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]"

    >
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
            <h1 className="mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.045em]">
              Settings
            </h1>
            <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-secondary2)]">
              Keep the people, permissions, and integrations around governed spend legible.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white"
          >
            Invite member{" "}
            <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
              ↗
            </span>
          </button>
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
                      <h2 className="mt-4 text-[26px] font-semibold tracking-[-.05em]">
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
                        <div
                          key={i}
                          className="border-b border-[var(--wl-line-soft)] px-4 py-4"
                        >
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
                          Invite approvers after creating a governed wallet and defining the human
                          review path.
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
                              <span className="mt-0.5 block truncate text-[11px] text-[var(--wl-secondary)]">
                                {member.email}
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
                          <span className="max-md:hidden" />
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <section className="warm-reveal is-visible border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:p-10">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                  WORKSPACE / {activeTab}
                </p>
                <h2 className="mt-7 text-[34px] font-semibold tracking-[-.05em]">
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
          className="warm-modal-backdrop fixed inset-0 z-30 flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.18)] p-5"
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
        >
          <div className="warm-modal-panel w-full max-w-[450px] border border-[var(--wl-line)] bg-[var(--wl-bg)] p-7 shadow-[0_24px_50px_-28px_rgba(var(--wl-ink-rgb),.6)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                  TEAM / INVITATION
                </p>
                <h2 className="mt-4 text-[28px] font-semibold tracking-[-.05em]">
                  Invite a member.
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
              >
                CLOSE
              </button>
            </div>
            <label className="mt-8 block">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                NAME
              </span>
              <input
                value={inviteName}
                onChange={(event) => setInviteName(event.target.value)}
                className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 text-[14px] outline-none transition-colors focus:border-[var(--wl-signal)]"
                placeholder="New approver"
              />
            </label>
            <label className="mt-5 block">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                EMAIL
              </span>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                type="email"
                className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 text-[14px] outline-none transition-colors focus:border-[var(--wl-signal)]"
                placeholder="name@workspace.eth"
              />
            </label>
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
                className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white"
              >
                Stage invite ↗
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
