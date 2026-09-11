"use client";

import { ARC_NETWORK_NAME, IS_ARC_MAINNET, arcChain } from "@arcanum/shared";
import { useState } from "react";
import { type Address, formatUnits } from "viem";
import { useAccount, useSwitchChain } from "wagmi";

import { CCTP_ROUTE } from "@/lib/cctp";
import { useAgentFundingController } from "../_hooks/use-agent-funding-controller";

export function AgentFundingPanel({
  governedWalletAddress,
}: { governedWalletAddress: Address | null }) {
  const { chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const {
    state,
    amount,
    setAmount,
    quote,
    status,
    burnTxHash,
    error,
    fetchQuote,
    isConnected,
    submitFunding,
    reset,
    resumeWithHash,
    canResume,
  } = useAgentFundingController(governedWalletAddress);

  const [resumeHashInput, setResumeHashInput] = useState("");

  const formatAmount = (baseUnits: string | undefined) => {
    if (!baseUnits) return "—";
    try {
      return formatUnits(BigInt(baseUnits), 6);
    } catch {
      return "invalid";
    }
  };

  if (IS_ARC_MAINNET) return null;

  return (
    <div className="border-t border-[var(--wl-line)] py-6">
      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
        INBOUND FUNDING
      </p>
      <p className="mt-3 text-[12px] leading-[1.5] text-[var(--wl-body)]">
        Forward USDC from Ethereum Sepolia to {ARC_NETWORK_NAME}. Circle forwarding is asynchronous;
        the quoted forwarding fee is deducted, so the received amount can be lower than the source
        burn.
      </p>
      {!isConnected ? (
        <p className="mt-3 font-mono text-[9px] leading-[1.5] text-[var(--wl-secondary)]">
          CONNECT THE SOURCE WALLET THAT WILL APPROVE AND BURN SEPOLIA USDC.
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 font-mono text-[9px] leading-[1.5] text-[var(--wl-signal)]">
          ERROR: {error}
        </p>
      ) : null}

      {state === "IDLE" ||
      state === "QUOTING" ||
      state === "QUOTED" ||
      state === "APPROVING" ||
      state === "BURNING" ? (
        <>
          <label className="mt-4 block">
            <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
              AMOUNT (USDC)
            </span>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value);
                }}
                disabled={state === "APPROVING" || state === "BURNING"}
                placeholder="100.00"
                className="mt-2 w-full border-b border-[var(--wl-faint)] bg-transparent py-2 font-mono text-[12px] outline-none focus:border-[var(--wl-signal)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => fetchQuote(amount)}
                disabled={
                  !isConnected ||
                  state === "QUOTING" ||
                  !amount ||
                  state === "APPROVING" ||
                  state === "BURNING"
                }
                className="warm-pill rounded-full bg-[var(--wl-signal)] px-3.5 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
              >
                {state === "QUOTING" ? "Quoting..." : "Quote"}
              </button>
            </div>
          </label>

          {quote && state !== "QUOTING" && (
            <div className="mt-4 font-mono text-[10px] text-[var(--wl-body)] bg-[var(--wl-bg-subtle)] p-3 rounded">
              <div className="flex justify-between mb-1">
                <span className="text-[var(--wl-mute)]">Source deduction:</span>
                <span>{formatAmount(quote.amountBaseUnits)} USDC</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-[var(--wl-mute)]">Circle forwarding fee:</span>
                <span>{formatAmount(quote.maxFeeBaseUnits)} USDC</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-[var(--wl-mute)]">Minimum received:</span>
                <span>{formatAmount(quote.minimumReceivedBaseUnits)} USDC</span>
              </div>
              <p className="mt-2 text-[9px] text-[var(--wl-secondary)]">
                Gas requirement: You must have Sepolia ETH to cover approve & burn transactions.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submitFunding}
                  disabled={!isConnected || state === "APPROVING" || state === "BURNING"}
                  className="warm-pill rounded-full bg-[var(--wl-signal)] px-3.5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40 w-full"
                >
                  {state === "APPROVING"
                    ? "Approving..."
                    : state === "BURNING"
                      ? "Burning..."
                      : "Approve & Burn"}
                </button>
              </div>
            </div>
          )}

          {!quote && state === "IDLE" && (
            <div className="mt-6 border-t border-[var(--wl-line)] pt-4">
              <p className="font-mono text-[9px] text-[var(--wl-mute)] mb-2">
                Resume an existing funding
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={resumeHashInput}
                  onChange={(e) => setResumeHashInput(e.target.value)}
                  placeholder="0x..."
                  className="flex-1 border-b border-[var(--wl-faint)] bg-transparent py-1 font-mono text-[10px] outline-none focus:border-[var(--wl-signal)]"
                />
                <button
                  type="button"
                  onClick={() => void resumeWithHash(resumeHashInput)}
                  disabled={!isConnected || !resumeHashInput}
                  className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-[9px] font-semibold disabled:opacity-40"
                >
                  Resume
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="mt-4 font-mono text-[10px] text-[var(--wl-body)] bg-[var(--wl-bg-subtle)] p-3 rounded">
          <div className="flex justify-between mb-2">
            <span className="text-[var(--wl-mute)]">Status:</span>
            <span className="font-bold uppercase text-[var(--wl-signal)]">
              {status?.stage || state}
            </span>
          </div>

          {burnTxHash && (
            <div className="flex justify-between mb-1">
              <span className="text-[var(--wl-mute)]">Burn Tx:</span>
              <a
                href={`${CCTP_ROUTE.sourceExplorerUrl}/tx/${burnTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {burnTxHash.slice(0, 10)}... ↗
              </a>
            </div>
          )}

          {status?.mintTxHash && (
            <div className="flex justify-between mb-1">
              <span className="text-[var(--wl-mute)]">Mint Tx:</span>
              <a
                href={`${CCTP_ROUTE.destinationExplorerUrl}/tx/${status.mintTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {status.mintTxHash.slice(0, 10)}... ↗
              </a>
            </div>
          )}

          {status?.amountBaseUnits && (
            <div className="flex justify-between mb-1">
              <span className="text-[var(--wl-mute)]">Amount:</span>
              <span>{formatAmount(status.amountBaseUnits)} USDC</span>
            </div>
          )}

          {status?.receivedBaseUnits && (
            <div className="flex justify-between mb-1">
              <span className="text-[var(--wl-mute)]">Received:</span>
              <span>{formatAmount(status.receivedBaseUnits)} USDC</span>
            </div>
          )}

          {status?.balanceBaseUnits && (
            <div className="flex justify-between mb-1 mt-2 pt-2 border-t border-[var(--wl-line)]">
              <span className="text-[var(--wl-mute)]">Current Balance:</span>
              <span>{formatAmount(status.balanceBaseUnits)} USDC</span>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            {state === "COMPLETED" || state === "SOURCE_FAILED" ? (
              <button
                type="button"
                onClick={reset}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-1.5 text-[10px] font-semibold"
              >
                Start New Funding
              </button>
            ) : state === "RECOVERY_REQUIRED" ? (
              <div className="w-full">
                <p className="mb-2 text-[9px] text-[var(--wl-mute)]">
                  Import the burn hash only after confirming it in your wallet. This validates the
                  recipient before saving recovery data.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={resumeHashInput}
                    onChange={(event) => setResumeHashInput(event.target.value)}
                    placeholder="0x..."
                    className="flex-1 border-b border-[var(--wl-faint)] bg-transparent py-1 font-mono text-[10px] outline-none focus:border-[var(--wl-signal)]"
                  />
                  <button
                    type="button"
                    onClick={() => void resumeWithHash(resumeHashInput)}
                    disabled={!isConnected || !resumeHashInput || !canResume}
                    className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-[9px] font-semibold disabled:opacity-40"
                  >
                    Import
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-[9px] text-[var(--wl-mute)] animate-pulse">
                {error ? "Status retry scheduled..." : "Polling status..."}
              </div>
            )}
            {chainId !== arcChain.id && (
              <button
                type="button"
                onClick={() => switchChain({ chainId: arcChain.id })}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-1.5 text-[10px] font-semibold"
              >
                Switch back to {ARC_NETWORK_NAME}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
