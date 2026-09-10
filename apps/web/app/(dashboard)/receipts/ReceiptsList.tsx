"use client";

import { Arrow } from "@/components/arcanum/arrow";
import { StatusPill } from "@/components/arcanum/status-pill";
import { ConnectCta } from "@/components/warm/ConnectCta";
import { useWorkspaceMode } from "@/lib/auth-session";
import { formatUsd, truncateAddress } from "@/lib/format";
import { verdictTone } from "@/lib/receipts";
import { trpc } from "@/lib/trpc";
import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import { datePart, timePart } from "../ledger/_lib/helpers";

export function ReceiptsList() {
  const workspace = useWorkspaceMode();

  // The list is scoped to the signed-in identity, so it waits for SIWE like
  // the detail page does: a connected but unsigned wallet sees a skeleton,
  // not an empty list it would read as "no receipts".
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } =
    trpc.receipts.list.useInfiniteQuery(
      { limit: 25 },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: workspace.isAuthenticated,
      },
    );

  const settling =
    !workspace.isAuthenticated &&
    (workspace.isResolving || workspace.dataMode === "connected_unsigned");
  const signedOut = !workspace.isAuthenticated && !settling;
  const pending = settling || (workspace.isAuthenticated && isLoading);

  const allItems = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="arc-receipts">
      <style>{`
        .arc-row{animation:arcRowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--row-i) * 55ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease,box-shadow 220ms ease}
        .arc-row:hover{transform:translate3d(3px,-1px,0);background:var(--wl-bg-raised);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes arcRowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <header className="mb-9 border-b border-[var(--wl-line)] pb-8">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            DECISION ATTESTATIONS
          </p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="font-display text-[42px] font-semibold leading-[.9] tracking-[-.02em]">
                Payment Receipts
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                {ARC_NETWORK_BADGE}
              </span>
            </div>
          </div>
        </header>

        <section className="min-w-0 flex-1 overflow-hidden border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
          <div className="hidden grid-cols-[1.2fr_1.5fr_1fr_1.2fr_1fr_90px] gap-4 border-b border-[var(--wl-line)] px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] md:grid">
            <span>Time</span>
            <span>Wallet</span>
            <span>Verdict</span>
            <span>Reason Code</span>
            <span>Amount</span>
            <span className="text-right">Action</span>
          </div>

          <div>
            {signedOut ? (
              <ConnectCta note="Sign in with the wallet that owns your workspace to see its receipts." />
            ) : pending ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b border-[var(--wl-line-faint)] px-5 py-4">
                  <div className="h-4 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
                </div>
              ))
            ) : isError ? (
              <div className="px-6 py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  UNAVAILABLE
                </p>
                <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                  Receipts could not be loaded.
                </p>
              </div>
            ) : allItems.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  NO RECEIPTS YET
                </p>
                <p className="mx-auto mt-3 max-w-[52ch] text-[13px] leading-[1.6] text-[var(--wl-secondary2)]">
                  A receipt is issued each time an agent asks for one before paying. Call
                  requestPaymentReceipt from the SDK, or POST /api/receipts, with a signed intent.
                </p>
              </div>
            ) : (
              allItems.map((item, index) => {
                const verdict = item.receipt.receipt.decision.verdict;

                return (
                  <Link
                    key={item.receipt.receipt.receiptId}
                    href={`/receipts/${item.receipt.receipt.receiptId}`}
                    className="arc-row flex cursor-pointer flex-col gap-2 border-b border-[var(--wl-line-faint)] px-5 py-4 md:grid md:grid-cols-[1.2fr_1.5fr_1fr_1.2fr_1fr_90px] md:items-center md:gap-4 md:py-3"
                    style={{ "--row-i": Math.min(index, 20) } as React.CSSProperties}
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] font-medium text-[var(--wl-ink)]">
                        {timePart(item.createdAt)}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--wl-secondary)]">
                        {datePart(item.createdAt)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-mono text-[11px] text-[var(--wl-ink)]">
                        {item.walletLabel ??
                          truncateAddress(item.receipt.receipt.request.governedWalletAddress)}
                      </span>
                      <span className="font-mono text-[9px] text-[var(--wl-secondary)]">
                        BLOCK {item.receipt.receipt.evaluation.blockNumber}
                      </span>
                    </div>
                    <div>
                      <StatusPill status={verdict.toUpperCase()} tone={verdictTone(verdict)} />
                    </div>
                    <div className="font-mono text-[10px] text-[var(--wl-body)]">
                      {item.receipt.receipt.decision.reasonCode}
                    </div>
                    <div className="font-mono text-[11px] font-medium text-[var(--wl-ink)]">
                      {formatUsd(Number(item.receipt.receipt.request.amount))}
                    </div>
                    <div className="flex justify-end">
                      <span className="font-mono text-[14px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]">
                        <Arrow glyph="→" />
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
          {hasNextPage && workspace.isAuthenticated && !isLoading && (
            <div className="border-t border-[var(--wl-line)] p-4 text-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)] transition-colors hover:text-[var(--wl-signal-deep)] disabled:opacity-50"
              >
                {isFetchingNextPage ? "LOADING..." : "LOAD MORE"}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
