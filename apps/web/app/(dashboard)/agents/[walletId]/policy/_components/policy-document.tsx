import { ARC_NETWORK_NAME } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import type { Address } from "viem";

import {
  type DoctrineCategoryValue,
  type PolicyDraftState,
  doctrineCategoryOptions,
} from "@/lib/contracts";

const policyInputClass =
  "mt-1 w-full border-b border-[var(--wl-faint)] bg-transparent py-2.5 font-mono text-[13px] outline-none transition-colors focus:border-[var(--wl-signal)]";

interface PolicyDocumentProps {
  policyBusy: boolean;
  policyDraft: PolicyDraftState;
  policyError: string | null;
  policyNetworkNotice: string | null;
  policyReadStatus: "idle" | "checking" | "ready" | "error";
  policyWriteDisabledReason: string | null;
  resetDraft: () => void;
  savePolicyOnChain: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
  selectedGovernedWalletAddress: Address | null;
  selectedPolicyWalletLabel: string;
  toggleCategory: (category: DoctrineCategoryValue) => void;
  unsavedCount: number;
  updatePolicyDraft: (patch: Partial<PolicyDraftState>) => void;
  walletsLoading: boolean;
}

export function PolicyDocument(controller: PolicyDocumentProps) {
  const {
    policyBusy,
    policyDraft,
    policyError,
    policyNetworkNotice,
    policyReadStatus,
    policyWriteDisabledReason,
    resetDraft,
    savePolicyOnChain,
    selectedGovernedWalletAddress,
    selectedPolicyWalletLabel,
    toggleCategory,
    unsavedCount,
    updatePolicyDraft,
    walletsLoading,
  } = controller;
  return (
    <section
      className="policy-in border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[14px_18px_0_var(--wl-bg-deep2)]"
      style={{ "--i": 2 } as CSSProperties}
    >
      <div className="border-b border-[var(--wl-line)] px-6 py-6 md:px-9">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              ARCANUM / GOVERNING DOCUMENT
            </p>
            <h2 className="font-display mt-3 text-[28px] font-semibold tracking-[-.015em]">
              {selectedPolicyWalletLabel} doctrine
            </h2>
          </div>
          <span className="border border-[var(--wl-line)] px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
            {unsavedCount > 0 ? `${unsavedCount} unsaved` : "active policy"}
          </span>
        </div>
        <p className="mt-4 max-w-[570px] text-[13px] leading-[1.5] text-[var(--wl-body)]">
          This instrument defines where capital may move, how much may move, and when a person must
          take the seat.
        </p>
      </div>

      {policyReadStatus === "checking" && selectedGovernedWalletAddress ? (
        <div className="px-6 py-10 md:px-9">
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-10 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            ))}
          </div>
        </div>
      ) : policyReadStatus === "error" && selectedGovernedWalletAddress ? (
        <div className="px-6 py-14 text-center md:px-9">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
            Policy read failed
          </p>
          <p className="mx-auto mt-3 max-w-[420px] font-mono text-[11px] leading-[1.6] text-[var(--wl-body)]">
            {policyError ?? `Unable to read policy from ${ARC_NETWORK_NAME}.`}
          </p>
        </div>
      ) : !selectedGovernedWalletAddress ? (
        <div className="px-6 py-14 text-center md:px-9">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            {walletsLoading ? "Loading governed wallets" : "No governed wallet selected"}
          </p>
          <Link
            href="/agents"
            className="mt-4 inline-block text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
          >
            Deploy or select a governed wallet
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[var(--wl-line-soft)] px-6 md:px-9">
          <div className="py-7">
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
              01 / LIMITS
            </p>
            <h3 className="mt-2 text-[18px] font-medium">Capital envelope</h3>
            <div className="mt-6 grid gap-7 sm:grid-cols-3">
              {(
                [
                  ["PER TRANSACTION · USDC", "perTxCap"],
                  ["DAILY CAP · USDC", "dailyCap"],
                  ["MONTHLY CAP · USDC", "monthlyCap"],
                ] as const
              ).map(([label, field]) => (
                <label key={field}>
                  <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                    {label}
                  </span>
                  <input
                    className={policyInputClass}
                    value={policyDraft[field]}
                    onChange={(event) => updatePolicyDraft({ [field]: event.target.value })}
                    inputMode="decimal"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="py-7">
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
              02 / COUNTERPARTIES
            </p>
            <h3 className="mt-2 text-[18px] font-medium">Allowed categories</h3>
            <div className="mt-5 flex flex-wrap gap-2">
              {doctrineCategoryOptions.map((category) => {
                const enabled = policyDraft.enabledCategories.has(category.value);
                return (
                  <button
                    type="button"
                    key={category.value}
                    onClick={() => toggleCategory(category.value)}
                    className={`min-h-11 md:min-h-0 rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.1em] transition-colors ${
                      enabled
                        ? "border-[var(--wl-ink)] bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                        : "border-[var(--wl-line)] text-[var(--wl-secondary)] hover:border-[var(--wl-ink)]"
                    }`}
                  >
                    {enabled ? "✓ " : "+ "}
                    {category.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-4 font-mono text-[9px] text-[var(--wl-mute)]">
              {policyDraft.enabledCategories.size} categor
              {policyDraft.enabledCategories.size === 1 ? "y" : "ies"} permitted · all other
              categories are blocked
            </p>
            <label className="mt-5 flex items-center gap-3 text-[12px] text-[var(--wl-body)]">
              <input
                type="checkbox"
                checked={policyDraft.requireAllowlist}
                onChange={(event) => updatePolicyDraft({ requireAllowlist: event.target.checked })}
                className="accent-[var(--wl-signal)]"
              />
              Require vendor allowlist (blocks unlisted counterparties)
            </label>
          </div>

          <div className="py-7">
            <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
              03 / HUMAN CONTROL
            </p>
            <h3 className="mt-2 text-[18px] font-medium">Escalation threshold</h3>
            <div className="mt-6 grid gap-7 sm:grid-cols-2">
              <label>
                <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                  ESCALATE ABOVE · USDC
                </span>
                <input
                  className={policyInputClass}
                  value={policyDraft.escalationThreshold}
                  onChange={(event) =>
                    updatePolicyDraft({ escalationThreshold: event.target.value })
                  }
                  inputMode="decimal"
                />
              </label>
            </div>
            <p className="mt-4 font-mono text-[9px] leading-[1.6] text-[var(--wl-mute)]">
              Payments above this amount route to the escalation council before settling.
            </p>
          </div>

          {policyError ? (
            <div className="py-5">
              <div className="border border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-3 py-2 font-mono text-[11px] leading-[1.5] text-[var(--wl-signal)]">
                {policyError}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className="flex flex-col justify-between gap-3 border-t border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-6 py-5 sm:flex-row sm:items-center md:px-9">
        <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
          {policyNetworkNotice ?? "Unsaved changes are local until signed"}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={resetDraft}
            disabled={unsavedCount === 0}
            className="min-h-11 md:min-h-0 rounded-full px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)] disabled:opacity-40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={savePolicyOnChain}
            disabled={Boolean(policyWriteDisabledReason) || policyBusy}
            title={policyWriteDisabledReason ?? "Sign and deploy this policy revision."}
            className="warm-pill rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Sign & deploy
          </button>
        </div>
      </div>
    </section>
  );
}
