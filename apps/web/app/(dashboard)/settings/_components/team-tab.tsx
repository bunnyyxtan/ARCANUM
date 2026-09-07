import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import type { CSSProperties } from "react";

import type { SettingsController } from "../_hooks/use-settings-controller";
import { roleClass } from "../_lib/settings";

export function TeamTab({ settings }: { settings: SettingsController }) {
  const { address, isOwner, liveMembers, memberCaption, members, orgName, removeMember } = settings;
  return (
    <>
      <section className="grid border-y border-[var(--wl-line)] md:grid-cols-3">
        {[
          ["ORGANIZATION", orgName],
          ["DEPLOYMENT", ARC_NETWORK_BADGE],
          ["MEMBERS", String(members.length).padStart(2, "0")],
        ].map(([label, value], index) => (
          <div
            key={label}
            className="warm-reveal is-visible border-r border-[var(--wl-line)] px-6 py-6 first:pl-0 last:border-r-0 max-md:border-b max-md:border-r-0 max-md:px-0 max-md:py-5"
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
                Add a teammate by wallet address to share this workspace&rsquo;s ledger, policies
                and escalations.
              </p>
            </div>
          ) : (
            members.map((member, index) => (
              <div
                key={member.id}
                className="member-row warm-reveal is-visible grid grid-cols-[1.8fr_.8fr_.8fr_auto] items-center gap-4 border-b border-[var(--wl-line-soft)] px-4 py-4 max-md:grid-cols-[minmax(0,1fr)_auto] max-md:gap-3 max-md:px-0"
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
                      onClick={() => removeMember.mutate({ walletAddress: member.wallet })}
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
  );
}
