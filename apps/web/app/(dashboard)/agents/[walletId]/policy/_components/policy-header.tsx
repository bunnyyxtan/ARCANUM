import { ARC_NETWORK_BADGE, ARC_NETWORK_NAME } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties, MouseEvent } from "react";
import type { Hash } from "viem";

import { isEvmAddress, shortAddress } from "@/lib/format/address";

interface PolicyHeaderProps {
  policyBusy: boolean;
  policyPendingIndexer: boolean;
  policyReadStatus: "idle" | "checking" | "ready" | "error";
  policyTxHash: Hash | null;
  policyWalletOptions: readonly { address: string; id: string; label: string }[];
  policyWriteDisabledReason: string | null;
  resetDraft: () => void;
  routeWalletId: string;
  savePolicyOnChain: (event: MouseEvent<HTMLButtonElement>) => Promise<void>;
  selectedPolicyWalletAddress: string;
  selectedPolicyWalletLabel: string;
  setSelectedPolicyWalletAddress: (address: string) => void;
  unsavedCount: number;
}

export function PolicyHeader({
  routeWalletId,
  policyBusy,
  policyPendingIndexer,
  policyReadStatus,
  policyTxHash,
  policyWalletOptions,
  policyWriteDisabledReason,
  resetDraft,
  savePolicyOnChain,
  selectedPolicyWalletAddress,
  selectedPolicyWalletLabel,
  setSelectedPolicyWalletAddress,
  unsavedCount,
}: PolicyHeaderProps) {
  return (
    <>
      <div
        className="policy-in flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
        style={{ "--i": 0 } as CSSProperties}
      >
        <div>
          <Link
            href={isEvmAddress(routeWalletId) ? `/agents/${routeWalletId}` : "/agents"}
            className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-secondary)] hover:text-[var(--wl-signal)]"
          >
            ← {selectedPolicyWalletLabel} dossier
          </Link>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            GOVERNANCE / POLICY INSTRUMENT
          </p>
          <h1 className="font-display mt-4 text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[.86] tracking-[-.015em]">
            Policy editor
          </h1>
          <p className="mt-5 max-w-[520px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            Revise the governing document. Changes remain inert until a wallet owner signs and
            deploys them on {ARC_NETWORK_NAME}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-md:w-full">
          <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-secondary)]">
            {policyReadStatus === "checking"
              ? "READING ONCHAIN POLICY"
              : policyPendingIndexer
                ? "FINALIZING"
                : `${ARC_NETWORK_BADGE} POLICY`}
          </span>
          <button
            type="button"
            onClick={resetDraft}
            disabled={unsavedCount === 0 || policyBusy}
            className="warm-pill warm-pill-ghost min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[11px] font-semibold disabled:opacity-40"
          >
            Reset draft
          </button>
          <button
            type="button"
            onClick={savePolicyOnChain}
            disabled={Boolean(policyWriteDisabledReason) || policyBusy}
            title={policyWriteDisabledReason ?? "Sign and deploy this policy revision."}
            className="warm-pill min-h-11 md:min-h-0 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            {policyBusy
              ? policyTxHash
                ? "Waiting for receipt"
                : "Confirm in wallet"
              : "Sign & deploy"}
          </button>
        </div>
      </div>

      {policyWalletOptions.length > 0 ? (
        <div
          className="policy-in flex flex-wrap items-center gap-3 border-b border-[var(--wl-line)] py-5"
          style={{ "--i": 1 } as CSSProperties}
        >
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            GOVERNED WALLET
          </span>
          <select
            value={selectedPolicyWalletAddress}
            onChange={(event) => setSelectedPolicyWalletAddress(event.target.value)}
            className="border-b border-[var(--wl-faint)] bg-transparent py-2 font-mono text-[12px] outline-none focus:border-[var(--wl-signal)]"
          >
            {policyWalletOptions.map((wallet) => (
              <option key={wallet.id} value={wallet.address}>
                {wallet.label} · {shortAddress(wallet.address)}
              </option>
            ))}
          </select>
        </div>
      ) : null}
    </>
  );
}
