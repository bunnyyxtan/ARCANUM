"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import type { Address } from "viem";

import { useAgentSignerController } from "../_hooks/use-agent-signer-controller";

export function AgentSignerPanel({
  governedWalletAddress,
}: { governedWalletAddress: Address | null }) {
  const {
    address,
    chainId,
    isConnected,
    signerInput,
    setSignerInput,
    usableSignerAddress,
    signerAuthorized,
    managementDisabledReason,
    txStatusLabel,
    txArcscanUrl,
    txError,
    canAuthorize,
    canRevoke,
    switchToArcTestnet,
    submitSignerWrite,
  } = useAgentSignerController(governedWalletAddress);

  return (
    <div className="border-t border-[var(--wl-line)] py-6">
      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
        AGENT SIGNER
      </p>
      <p className="mt-3 text-[12px] leading-[1.5] text-[var(--wl-body)]">
        The agent signer is the public wallet address controlled by your agent backend. Never paste
        a private key. The signer can request payments, but policy rules still control spend.
      </p>
      <label className="mt-4 block">
        <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
          SIGNER ADDRESS
        </span>
        <input
          value={signerInput}
          onChange={(event) => setSignerInput(event.target.value)}
          placeholder={address ?? "0x..."}
          className="mt-2 w-full border-b border-[var(--wl-faint)] bg-transparent py-2 font-mono text-[12px] outline-none focus:border-[var(--wl-signal)]"
        />
      </label>
      {usableSignerAddress ? (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
          {signerAuthorized === true
            ? "AUTHORIZED ON CONTRACT"
            : signerAuthorized === false
              ? "NOT AUTHORIZED ON CONTRACT"
              : "VERIFYING"}
        </p>
      ) : null}
      {managementDisabledReason ? (
        <p className="mt-2 font-mono text-[9px] leading-[1.5] text-[var(--wl-amber)]">
          {managementDisabledReason}
        </p>
      ) : null}
      {txStatusLabel ? (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
          {txStatusLabel}
          {txArcscanUrl ? (
            <a
              href={txArcscanUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-[var(--wl-signal)] underline underline-offset-2"
            >
              tx ↗
            </a>
          ) : null}
        </p>
      ) : null}
      {txError ? (
        <p className="mt-2 font-mono text-[9px] leading-[1.5] text-[var(--wl-signal)]">{txError}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {isConnected && chainId !== arcChain.id ? (
          <button
            type="button"
            onClick={switchToArcTestnet}
            className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
          >
            Switch to {ARC_NETWORK_NAME}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!canAuthorize}
              onClick={(event) => void submitSignerWrite("authorize", event)}
              className="warm-pill rounded-full bg-[var(--wl-signal)] px-3.5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              Authorize signer
            </button>
            <button
              type="button"
              disabled={!canRevoke}
              onClick={(event) => void submitSignerWrite("revoke", event)}
              className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold disabled:opacity-40"
            >
              Revoke signer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
