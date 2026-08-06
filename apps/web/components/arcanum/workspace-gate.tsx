"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { useWorkspaceMode } from "@/lib/auth-session";
import { trpc } from "@/lib/trpc";

const DISMISS_PREFIX = "arcanum-workspace-named:";

/**
 * First run, in two shapes.
 *
 * Signing in provisions a workspace automatically, so the common first run is
 * not an empty account -- it is a workspace still carrying the placeholder name
 * every new workspace shares. Its owner is asked for a real one once, and can
 * decline.
 *
 * The rarer shape is a signed-in wallet with no workspace at all, which happens
 * when provisioning could not reach the database at sign-in. That used to be a
 * dead end: a dashboard of zeros with nothing to click. Now it offers to create
 * the workspace.
 *
 * Only a definite answer from the server opens either panel. A read-model
 * outage renders the page underneath instead, because offering to create a
 * second workspace over one that merely failed to load would be the worst
 * possible misreading of the situation.
 */
export function WorkspaceGate({ children }: Readonly<{ children: ReactNode }>) {
  const { address } = useAccount();
  const { isAuthenticated } = useWorkspaceMode();
  const utils = trpc.useUtils();
  const org = trpc.org.getCurrent.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const [name, setName] = useState("");
  const [dismissedOrgId, setDismissedOrgId] = useState<string | null>(null);

  const data = org.data;
  const orgId = data?.hasWorkspace ? data.id : null;

  useEffect(() => {
    if (!orgId) {
      return;
    }

    try {
      if (window.localStorage.getItem(`${DISMISS_PREFIX}${orgId}`) === "1") {
        setDismissedOrgId(orgId);
      }
    } catch {
      // localStorage unavailable (privacy mode) -- the prompt simply returns.
    }
  }, [orgId]);

  const refreshOrg = () =>
    Promise.all([utils.org.getCurrent.invalidate(), utils.org.currentOrg.invalidate()]);

  const createWorkspace = trpc.org.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        refreshOrg(),
        utils.org.listMembers.invalidate(),
        utils.org.members.invalidate(),
      ]);
    },
  });

  const renameWorkspace = trpc.org.update.useMutation({ onSuccess: () => refreshOrg() });

  const needsWorkspace = data?.isSignedIn === true && data.hasWorkspace === false;
  const needsName =
    data?.hasWorkspace === true &&
    data.hasCustomName === false &&
    data.callerRole === "owner" &&
    dismissedOrgId !== data.id;

  // First-run setup is for the signed-in owner only. A read-only visitor (or
  // a stale session after the wallet disconnected) browses straight through;
  // asking them to name a workspace they cannot own is the wrong first step.
  if (!isAuthenticated || (!needsWorkspace && !needsName)) {
    return <>{children}</>;
  }

  const owner = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "your wallet";
  const trimmed = name.trim();
  const pending = createWorkspace.isPending || renameWorkspace.isPending;
  const error = createWorkspace.error ?? renameWorkspace.error;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed.length < 2 || pending) {
      return;
    }

    if (needsWorkspace) {
      createWorkspace.mutate({ name: trimmed });
      return;
    }

    renameWorkspace.mutate({ name: trimmed });
  };

  const notNow = () => {
    if (!orgId) {
      return;
    }

    try {
      window.localStorage.setItem(`${DISMISS_PREFIX}${orgId}`, "1");
    } catch {
      // Nothing to persist to -- dismissing for this render is still honoured.
    }
    setDismissedOrgId(orgId);
  };

  return (
    <div className="mx-auto flex min-h-[76vh] max-w-[1400px] items-center px-5 py-16 md:px-8">
      <section className="warm-reveal is-visible w-full max-w-[640px]">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          WORKSPACE / FIRST RUN
        </p>
        <h1 className="font-display mt-5 text-[clamp(2.6rem,5.4vw,4.4rem)] font-semibold leading-[.88] tracking-[-.015em]">
          Name your workspace.
        </h1>
        <p className="mt-6 max-w-[520px] text-[15px] leading-[1.6] text-[var(--wl-secondary2)]">
          {needsWorkspace ? (
            <>
              A workspace is the ledger your governed wallets, policies and reviewers live in. It
              starts empty. This only gives it a name and puts{" "}
              <span className="font-mono text-[13px] text-[var(--wl-ink)]">{owner}</span> in charge
              of it.
            </>
          ) : (
            <>
              Yours is ready, but it is still called{" "}
              <span className="text-[var(--wl-ink)]">{data?.name}</span>, the placeholder every new
              workspace starts with. Give it a name your teammates will recognise on invitations and
              in the ledger.
            </>
          )}
        </p>

        <form onSubmit={submit} className="mt-11">
          <label className="block">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
              WORKSPACE NAME
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
              placeholder="Helix Research Collective"
              className="mt-3 w-full border-b border-[var(--wl-line)] bg-transparent py-3 text-[18px] outline-none transition-colors placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
            />
          </label>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={trimmed.length < 2 || pending}
              className="warm-pill group rounded-full bg-[var(--wl-signal)] px-6 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? "Saving…" : needsWorkspace ? "Create workspace" : "Save name"}
              <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
                ↗
              </span>
            </button>
            {needsName ? (
              <button
                type="button"
                onClick={notNow}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
              >
                Not now
              </button>
            ) : (
              <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                NO GAS · NOTHING IS DEPLOYED YET
              </span>
            )}
          </div>
        </form>

        {error && (
          <p
            role="alert"
            className="mt-6 border-l-2 border-[var(--wl-signal)] pl-4 text-[13px] leading-[1.5] text-[var(--wl-signal)]"
          >
            {error.message}
          </p>
        )}

        <ul className="mt-14 border-t border-[var(--wl-line)]">
          {[
            ["01", "Deploy a governed wallet", "Your agent spends from it, under caps you set."],
            ["02", "Write the policy", "Per-transfer and daily limits, enforced on chain."],
            [
              "03",
              "Invite your reviewers",
              "Escalations need a human; settings is where you add them.",
            ],
          ].map(([step, title, detail]) => (
            <li
              key={step}
              className="grid grid-cols-[auto_1fr] gap-5 border-b border-[var(--wl-line-soft)] py-5"
            >
              <span className="font-mono text-[10px] tabular-nums tracking-[.12em] text-[var(--wl-mute)]">
                {step}
              </span>
              <span>
                <strong className="block text-[14px] font-medium tracking-[-.01em]">{title}</strong>
                <span className="mt-1 block text-[13px] text-[var(--wl-secondary)]">{detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
