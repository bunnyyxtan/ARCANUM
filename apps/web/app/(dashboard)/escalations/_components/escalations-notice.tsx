export function EscalationsNotice({ notice }: Readonly<{ notice: string }>) {
  return (
    <div role="status" aria-live="polite">
      {notice && (
        <div className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-20 max-w-[calc(100vw-32px)] -translate-x-1/2 border border-[var(--wl-ink)] bg-[var(--wl-ink)] px-4 py-3 font-mono text-[10px] text-[var(--wl-bg)] shadow-[0_12px_28px_rgba(var(--wl-ink-rgb),.18)] md:bottom-5">
          {notice}
        </div>
      )}
    </div>
  );
}
