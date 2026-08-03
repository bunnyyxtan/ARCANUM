"use client";

import { useState, type CSSProperties } from "react";

import { getArcscanAddressUrl } from "@/lib/arcscan";
import { deployedContracts } from "@/lib/contracts";
import { shortAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

type HealthState = "OPERATIONAL" | "DEGRADED" | "CHECKING";

function Arrow({ direction = "↗" }: { direction?: string }) {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      {direction}
    </span>
  );
}

function HealthCard({
  index,
  label,
  detail,
  metric,
  metricLabel,
  state = "OPERATIONAL",
}: {
  index: number;
  label: string;
  detail: string;
  metric: string;
  metricLabel: string;
  state?: HealthState;
}) {
  return (
    <article
      className="health-card warm-reveal is-visible relative border-r border-[var(--wl-line)] px-7 py-7 first:pl-0 last:border-r-0 last:pr-0 max-lg:border-b max-lg:border-r-0 max-lg:px-0 max-lg:py-6"
      style={{ "--i": index } as CSSProperties}
    >
      <span className="card-rule absolute left-0 right-7 top-0 h-[2px] bg-[var(--wl-signal)]" />
      <div className="flex items-start justify-between gap-5">
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-body)]">
          {label}
        </span>
        <span
          className={`font-mono text-[10px] tracking-[.12em] ${
            state === "OPERATIONAL" ? "text-[var(--wl-ink)]" : "text-[var(--wl-signal)]"
          }`}
        >
          {state}
        </span>
      </div>
      <p className="mt-12 max-w-[290px] text-[13px] leading-[1.45] text-[var(--wl-secondary2)]">
        {detail}
      </p>
      <div className="mt-8 border-t border-[var(--wl-line-soft)] pt-4">
        <strong className="block font-mono text-[20px] font-medium tabular-nums tracking-[-.04em]">
          {metric}
        </strong>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
          {metricLabel}
        </span>
      </div>
    </article>
  );
}

export default function StatusPage() {
  const health = trpc.health.ping.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const indexer = health.data?.indexer;
  const rpc = health.data?.rpc;
  const supabase = health.data?.supabase;

  const runCheck = async () => {
    const result = await health.refetch();
    if (result.status === "success") {
      setCheckedAt(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " UTC",
      );
    }
  };

  const indexerState: HealthState = health.isLoading
    ? "CHECKING"
    : indexer?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const indexerMetric = health.isLoading
    ? "…"
    : indexer?.lastIndexedBlock != null
      ? String(indexer.lastIndexedBlock)
      : "—";
  const indexerMetricLabel = health.isLoading
    ? "CHECKING"
    : indexer?.status === "stale"
      ? "STALE / INDEXING LAG"
      : (indexer?.error ?? "LAST INDEXED BLOCK");

  const readModelState: HealthState = health.isLoading
    ? "CHECKING"
    : supabase?.readModel.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const readModelMetric = health.isLoading
    ? "…"
    : supabase?.readModel.sampleRows != null
      ? String(supabase.readModel.sampleRows)
      : "—";
  const readModelMetricLabel = health.isLoading
    ? "CHECKING"
    : supabase?.serviceRole.status === "configured"
      ? "SAMPLE ROWS · SERVICE ROLE CONFIGURED"
      : "SERVICE ROLE MISSING";

  const rpcState: HealthState = health.isLoading
    ? "CHECKING"
    : rpc?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const rpcMetric = health.isLoading ? "…" : rpc?.latestBlock ?? "—";
  const rpcMetricLabel = health.isLoading
    ? "CHECKING"
    : rpc?.status === "available"
      ? "LATEST BLOCK · ARC RPC"
      : (rpc?.error ?? "RPC STATUS UNKNOWN");

  return (
    <main
      className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]"

    >
      <style>{`
        .health-card{transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .health-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px -20px rgba(var(--wl-ink-rgb),.5)}
        .health-card:hover .card-rule{transform:scaleX(1)}
        .card-rule{transform:scaleX(.25);transform-origin:left;transition:transform 420ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.health-card,.card-rule{transition:none!important;transform:none!important}}
      `}</style>

      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
          <div className="warm-reveal is-visible">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
              SYSTEMS / READ MODEL
            </p>
            <h1 className="font-display mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.015em]">
              Status
            </h1>
            <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-secondary2)]">
              A direct read on the services that keep governed wallets accountable.
            </p>
          </div>
          <button
            type="button"
            onClick={runCheck}
            disabled={health.isFetching}
            className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:opacity-70"
          >
            {health.isFetching ? "Checking systems" : "Run health check"}
            <Arrow />
          </button>
        </div>

        <section
          className="mt-16 border-y border-[var(--wl-line)]"
          aria-label="Infrastructure health"
        >
          <div className="grid grid-cols-3 max-lg:grid-cols-1">
            <HealthCard
              index={1}
              label="EVENT INDEXER"
              detail="On-chain history is being indexed for governed wallets and may lag behind the latest Arc block."
              metric={indexerMetric}
              metricLabel={indexerMetricLabel}
              state={indexerState}
            />
            <HealthCard
              index={2}
              label="SUPABASE READ MODEL"
              detail="Supabase stores wallet-creation writes so the dashboard can answer quickly."
              metric={readModelMetric}
              metricLabel={readModelMetricLabel}
              state={readModelState}
            />
            <HealthCard
              index={3}
              label="ARC RPC"
              detail="The Arc endpoint is answering signed read requests."
              metric={rpcMetric}
              metricLabel={rpcMetricLabel}
              state={rpcState}
            />
          </div>
        </section>

        <section
          className="warm-reveal is-visible mt-16 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:p-10"
          style={{ "--i": 4 } as CSSProperties}
        >
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            DEPLOYMENT / CONTRACT ADDRESSES
          </p>
          <h2 className="font-display mt-6 text-[26px] font-semibold tracking-[-.015em]">Deployed contracts.</h2>
          <div className="mt-8 divide-y divide-[var(--wl-line)] border-t border-[var(--wl-line)]">
            {deployedContracts.map((contract) => {
              const url = getArcscanAddressUrl(contract.value);
              return (
                <div
                  key={contract.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 py-4"
                >
                  <span className="font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)]">
                    {contract.label}
                  </span>
                  {contract.value ? (
                    url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="warm-link font-mono text-[11px] tabular-nums text-[var(--wl-ink)] hover:text-[var(--wl-signal)]"
                      >
                        {shortAddress(contract.value)}
                      </a>
                    ) : (
                      <span className="font-mono text-[11px] tabular-nums text-[var(--wl-ink)]">
                        {shortAddress(contract.value)}
                      </span>
                    )
                  ) : (
                    <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-signal)]">
                      NOT CONFIGURED
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section
          className="warm-reveal is-visible mt-8 grid gap-12 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:grid-cols-[1fr_280px] md:p-10"
          style={{ "--i": 5 } as CSSProperties}
        >
          <div className="max-w-[700px]">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              READ MODEL / HOW TO READ THIS
            </p>
            <p className="mt-8 text-[16px] leading-[1.5] text-[var(--wl-body)]">
              Supabase stores wallet-creation writes so the dashboard can answer quickly. The indexer
              tracks on-chain history and may lag behind the latest Arc block.
            </p>
            <p className="mt-5 text-[16px] leading-[1.5] text-[var(--wl-body)]">
              Fresh wallets may show no indexed activity until their first transactions are picked
              up. That is expected—not a missing policy decision.
            </p>
          </div>
          <div className="flex flex-col justify-between border-l border-[var(--wl-line)] pl-6 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-6">
            <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              LAST CHECKED
            </span>
            <span className="mt-4 font-mono text-[12px] tabular-nums text-[var(--wl-ink)]">
              {checkedAt ?? (health.isLoading ? "Checking…" : "Not checked yet")}
            </span>
            <span className="mt-8 text-[11px] leading-[1.45] text-[var(--wl-secondary)]">
              All read-only checks complete without writing to the ledger.
            </span>
          </div>
        </section>
      </div>
    </main>
  );
}
