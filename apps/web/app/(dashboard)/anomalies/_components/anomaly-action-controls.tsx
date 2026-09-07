import type { MouseEvent as ReactMouseEvent } from "react";

export function AnomalyActionControls({
  frozen,
  investigated,
  isConnected,
  acknowledgePending,
  dismissPending,
  onInvestigate,
  onSettle,
}: {
  frozen: boolean;
  investigated: boolean;
  isConnected: boolean;
  acknowledgePending: boolean;
  dismissPending: boolean;
  onInvestigate: () => void;
  onSettle: (next: "restrained" | "dismissed", event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <div className="flex flex-col items-start gap-1.5 md:items-end">
      <span className="font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
        Action
      </span>
      <div className="flex items-center justify-start gap-3 md:justify-end">
        {frozen ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--wl-ink)] px-3 py-1.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-bg)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--wl-signal)]" />
            RESTRAINED
          </span>
        ) : (
          <button
            type="button"
            disabled={acknowledgePending || !isConnected}
            title={!isConnected ? "Connect wallet first." : undefined}
            onClick={(event) => onSettle("restrained", event)}
            className="min-h-11 md:min-h-0 rounded-full border border-[var(--wl-signal)] px-4 py-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--wl-signal)] hover:text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Restrain
          </button>
        )}
        <button
          type="button"
          onClick={onInvestigate}
          className="warm-pill warm-pill-ghost min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-4 py-2 font-mono text-[9px] tracking-[.1em]"
        >
          {investigated ? "Close trace" : "Investigate"}
        </button>
        <button
          type="button"
          disabled={dismissPending || !isConnected}
          title={!isConnected ? "Connect wallet first." : undefined}
          onClick={(event) => onSettle("dismissed", event)}
          className="min-h-11 md:min-h-0 px-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dismiss
        </button>
      </div>
      {!isConnected && !frozen && (
        <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
          CONNECT WALLET FIRST
        </span>
      )}
    </div>
  );
}
