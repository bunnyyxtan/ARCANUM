"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

import type { TeamMember } from "@/lib/types";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import type { SettingsController } from "../_hooks/use-settings-controller";
import { canRemoveTeamMember, roleClass } from "../_lib/settings";

export function TeamTab({ settings }: { settings: SettingsController }) {
  const { address, isOwner, liveMembers, memberCaption, members, orgName, removeMember } = settings;
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const teamHeadingRef = useRef<HTMLHeadingElement>(null);
  const restoreAfterRemovalRef = useRef(false);
  const removingOwner = memberToRemove?.rawRole.toLowerCase() === "owner";
  const canRemoveMember = (member: TeamMember) => canRemoveTeamMember(member, isOwner, address);
  const closeRemoval = () => {
    if (!removeMember.isPending) {
      restoreAfterRemovalRef.current = false;
      setMemberToRemove(null);
    }
  };
  const removalDialogRef = useDialogFocus(Boolean(memberToRemove), closeRemoval);

  useEffect(() => {
    if (!memberToRemove && restoreAfterRemovalRef.current) {
      restoreAfterRemovalRef.current = false;
      teamHeadingRef.current?.focus({ preventScroll: true });
    }
  }, [memberToRemove]);

  const requestRemoval = (member: TeamMember) => {
    if (!canRemoveMember(member) || removeMember.isPending) return;
    removeMember.reset();
    setMemberToRemove(member);
  };

  const confirmRemoval = () => {
    const member = memberToRemove;
    if (!member || !canRemoveMember(member) || removeMember.isPending) return;
    restoreAfterRemovalRef.current = true;
    removeMember.mutate(
      { walletAddress: member.wallet },
      {
        onSuccess: () => setMemberToRemove(null),
        onError: () => {
          restoreAfterRemovalRef.current = false;
        },
      },
    );
  };

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
            <h2
              ref={teamHeadingRef}
              id="team-members-heading"
              tabIndex={-1}
              className="font-display mt-4 text-[26px] font-semibold tracking-[-.015em] outline-none focus-visible:ring-2 focus-visible:ring-[var(--wl-signal)]"
            >
              The people with a say.
            </h2>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
            {members.length.toString().padStart(2, "0")} MEMBERS · {memberCaption}
          </span>
        </div>
        <div className="grid grid-cols-[1.8fr_.8fr_.8fr_auto] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] max-md:grid-cols-[minmax(0,1fr)_auto_auto] max-md:gap-2">
          <span>MEMBER</span>
          <span>ROLE</span>
          <span className="max-md:hidden">LAST ACTIVE</span>
          <span className="text-right">ACTION</span>
        </div>
        <div>
          {liveMembers.isLoading ? (
            ["member-skeleton-1", "member-skeleton-2", "member-skeleton-3"].map((key) => (
              <div key={key} className="border-b border-[var(--wl-line-soft)] px-4 py-4">
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
                className="member-row warm-reveal is-visible grid grid-cols-[1.8fr_.8fr_.8fr_auto] items-center gap-4 border-b border-[var(--wl-line-soft)] px-4 py-4 max-md:grid-cols-[minmax(0,1fr)_auto_auto] max-md:gap-3 max-md:px-0"
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
                <span className="flex justify-end">
                  {canRemoveMember(member) && (
                    <button
                      type="button"
                      disabled={removeMember.isPending}
                      onClick={() => requestRemoval(member)}
                      aria-label={`Remove ${member.name} from workspace`}
                      className="min-h-11 px-1 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-40 md:min-h-0"
                    >
                      {removeMember.isPending && memberToRemove?.id === member.id
                        ? "REMOVING…"
                        : "REMOVE"}
                    </button>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
      {memberToRemove ? (
        <div
          ref={removalDialogRef}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.28)] p-5"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="remove-member-title"
          aria-describedby={
            removingOwner
              ? "remove-member-description remove-member-owner-warning"
              : "remove-member-description"
          }
        >
          <button
            type="button"
            aria-label="Cancel member removal"
            aria-hidden="true"
            data-dialog-backdrop
            tabIndex={-1}
            className="absolute inset-0"
            onClick={closeRemoval}
          />
          <section className="relative w-full max-w-[460px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg)] p-6 shadow-[0_24px_60px_-16px_rgba(var(--wl-ink-rgb),.45)]">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              ACCESS / CONFIRM REMOVAL
            </p>
            <h2
              id="remove-member-title"
              className="font-display mt-3 text-[24px] font-semibold tracking-[-.02em]"
            >
              Remove {memberToRemove.name}?
            </h2>
            <p
              id="remove-member-description"
              className="mt-4 text-[13px] leading-[1.55] text-[var(--wl-secondary2)]"
            >
              This removes the {memberToRemove.rawRole.toLowerCase()} wallet{" "}
              <span className="font-mono">{memberToRemove.wallet}</span> from this workspace. They
              will lose access to its ledger, policies, and escalations.
            </p>
            {removingOwner ? (
              <p
                id="remove-member-owner-warning"
                role="note"
                className="mt-4 border border-[var(--wl-amber)] bg-[var(--wl-bg-soft)] p-3 text-[12px] leading-[1.5] text-[var(--wl-amber)]"
              >
                <strong>Owner removal:</strong> this member&rsquo;s owner access will be revoked.
                The workspace must retain at least one owner; the server&rsquo;s atomic last-owner
                check will reject this request if it would leave none.
              </p>
            ) : null}
            {removeMember.error ? (
              <p
                role="alert"
                aria-live="assertive"
                className="mt-4 border-l-2 border-[var(--wl-signal)] pl-3 text-[12px] leading-[1.5] text-[var(--wl-signal)]"
              >
                Unable to remove this member: {removeMember.error.message}
              </p>
            ) : null}
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                data-dialog-autofocus
                onClick={closeRemoval}
                disabled={removeMember.isPending}
                className="warm-pill warm-pill-ghost min-h-11 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRemoval}
                disabled={removeMember.isPending}
                aria-busy={removeMember.isPending}
                className="warm-pill min-h-11 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {removeMember.isPending
                  ? "Removing…"
                  : removingOwner
                    ? "Remove owner"
                    : "Remove member"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
