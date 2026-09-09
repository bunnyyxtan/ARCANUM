"use client";

import { Arrow } from "@/components/arcanum/arrow";
import { StatusPill } from "@/components/arcanum/status-pill";
import { ConnectCta } from "@/components/warm/ConnectCta";
import { getArcscanAddressUrl, getArcscanBaseUrl, getArcscanTxUrl } from "@/lib/arcscan";
import { useWorkspaceMode } from "@/lib/auth-session";
import { formatUSDCFromBaseUnits, formatUsd, truncateAddress } from "@/lib/format";
import {
  allowedCategoryNames,
  chainAgreement,
  formatUnixUtc,
  formatUtc,
  vendorCategoryName,
  verdictTone,
} from "@/lib/receipts";
import { trpc } from "@/lib/trpc";
import { type PaymentReceiptVerification, verifyPaymentReceipt } from "@arcanum/shared";
import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";

function CheckRow({ label, valid, details }: { label: string; valid: boolean; details?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--wl-line-faint)] py-2 last:border-0">
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-body)]">
          {label}
        </span>
        {details && (
          <p className="mt-1 break-all font-mono text-[9px] text-[var(--wl-mute)]">{details}</p>
        )}
      </div>
      <span
        className={`shrink-0 font-mono text-[10px] tracking-[.1em] ${valid ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
      >
        {valid ? "PASS" : "FAIL"}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
  mono = true,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
        {label}
      </dt>
      <dd
        className={`mt-1 break-all text-[var(--wl-ink)] ${mono ? "font-mono text-[11px]" : "text-[13px]"}`}
      >
        {children}
      </dd>
    </div>
  );
}

function AddressLink({ address }: { address: string }) {
  const href = getArcscanAddressUrl(address);
  if (!href) return <>{address}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline-offset-4 hover:text-[var(--wl-signal)] hover:underline"
    >
      {address}
    </a>
  );
}

function Flag({ value, yes, no }: { value: boolean; yes: string; no: string }) {
  return (
    <span className={value ? "text-[var(--wl-ink)]" : "text-[var(--wl-signal)]"}>
      {value ? yes : no}
    </span>
  );
}

function statusDetail(status: string, fallback?: string) {
  return status === "verified" || status === "not_checked"
    ? fallback
    : status.replace(/_/g, " ").toUpperCase();
}

export function ReceiptDetail({ receiptId }: { receiptId: string }) {
  const workspace = useWorkspaceMode();
  // Access depends on who signed in, so the query waits for SIWE to finish
  // instead of caching an UNAUTHORIZED answer; the auth bridge invalidates
  // receipt queries whenever the signed identity changes.
  const { data, isLoading, isError, error } = trpc.receipts.get.useQuery(
    { receiptId },
    { enabled: workspace.isAuthenticated, retry: false, refetchOnWindowFocus: false },
  );

  const [verification, setVerification] = useState<PaymentReceiptVerification | null>(null);

  useEffect(() => {
    const envelope = data?.receipt;
    if (!envelope) return;
    let cancelled = false;
    verifyPaymentReceipt(envelope).then((result) => {
      if (!cancelled) setVerification(result);
    });
    return () => {
      cancelled = true;
    };
  }, [data?.receipt]);

  if (!workspace.isAuthenticated) {
    const settling = workspace.isResolving || workspace.dataMode === "connected_unsigned";
    return (
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        {settling ? (
          <div className="h-14 w-72 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
        ) : (
          <ConnectCta note="Sign in with the wallet that owns this workspace to read the receipt." />
        )}
      </main>
    );
  }

  if (isError) {
    const isNotFound = error.data?.code === "NOT_FOUND";
    return (
      <main className="mx-auto max-w-[1400px] px-5 py-16 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
          {isNotFound ? "RECEIPT NOT FOUND" : "RECEIPT UNAVAILABLE"}
        </p>
        <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
          {isNotFound
            ? "No receipt with this id is visible to this workspace."
            : "The receipt could not be loaded. Try again in a moment."}
        </p>
        <Link
          href="/receipts"
          className="mt-6 inline-block rounded-full border border-[var(--wl-line)] px-4 py-2 font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-ink)] transition-colors hover:border-[var(--wl-ink)]"
        >
          <Arrow glyph="←" /> Back to receipts
        </Link>
      </main>
    );
  }

  if (isLoading || !data) {
    return (
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <div className="h-14 w-72 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      </main>
    );
  }

  const envelope = data.receipt;
  const body = envelope.receipt;
  const { decision, request, evaluation } = body;
  const { policy, vendor, spend } = evaluation;
  const blockUrl = `${getArcscanBaseUrl()}/block/${evaluation.blockNumber}`;
  const envelopeJson = JSON.stringify(envelope, null, 2);

  const handleCopyJson = () => {
    void navigator.clipboard.writeText(envelopeJson);
  };
  const handleDownloadJson = () => {
    const blob = new Blob([envelopeJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `arcanum-receipt-${body.receiptId}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="arc-receipts">
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <header className="mb-9 border-b border-[var(--wl-line)] pb-8">
          <Link
            href="/receipts"
            className="mb-4 inline-block font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] transition-colors hover:text-[var(--wl-ink)]"
          >
            <Arrow glyph="←" /> BACK TO RECEIPTS
          </Link>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
                DECISION RECEIPT
              </p>
              <h1 className="mt-3 break-all font-mono text-[20px] font-semibold leading-[1.2] tracking-[-.01em] md:text-[26px]">
                {body.receiptId}
              </h1>
              <p className="mt-3 font-mono text-[11px] text-[var(--wl-secondary)]">
                ISSUED {formatUtc(body.issuedAt)} · {data.wallet?.label ?? "WALLET"}{" "}
                {truncateAddress(request.governedWalletAddress)}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleCopyJson}
                className="rounded border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-ink)] transition-colors hover:bg-[var(--wl-bg-soft)]"
              >
                COPY JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadJson}
                className="rounded border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-ink)] transition-colors hover:bg-[var(--wl-bg-soft)]"
              >
                DOWNLOAD
              </button>
            </div>
          </div>
        </header>

        <div className="grid gap-7 lg:grid-cols-2">
          <section className="border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-6 md:p-8">
            <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              POLICY DECISION
            </h2>
            <div className="mb-6 flex items-center gap-4">
              <StatusPill
                status={decision.verdict.toUpperCase()}
                tone={verdictTone(decision.verdict)}
              />
              <span className="font-mono text-[12px] text-[var(--wl-ink)]">
                {decision.reasonCode}
              </span>
            </div>
            <p className="mb-8 text-[14px] leading-[1.6] text-[var(--wl-body)]">
              {decision.explanation}
            </p>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--wl-line-faint)] pt-6">
              <Field label="AMOUNT">
                {formatUsd(Number(request.amount))}{" "}
                <span className="text-[var(--wl-mute)]">({body.amountBaseUnits} base units)</span>
              </Field>
              <Field label="PURPOSE" mono={false}>
                {request.purpose}
              </Field>
              <Field label="VENDOR" wide>
                <AddressLink address={request.vendorAddress} />
              </Field>
              <Field label="WALLET" wide>
                <AddressLink address={request.governedWalletAddress} />
              </Field>
              <Field label="AGENT SIGNER" wide>
                <AddressLink address={request.agentSignerAddress} />
              </Field>
              <Field label="REFERENCE" wide>
                {request.reference}
              </Field>
            </dl>
          </section>

          <section className="border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-6 md:p-8">
            <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              VERIFICATION · COMPUTED IN THIS BROWSER
            </h2>
            {verification ? (
              <div className="space-y-2">
                <div
                  className={`mb-6 flex items-center gap-2 border-b border-[var(--wl-line)] pb-4 ${verification.ok ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
                >
                  <span className="font-mono text-[12px] font-medium uppercase tracking-[.1em]">
                    {verification.ok ? "RECEIPT VERIFIES" : "VERIFICATION FAILED"}
                  </span>
                </div>
                <CheckRow
                  label="FORMAT"
                  valid={verification.format.status === "valid"}
                  details={
                    verification.format.status === "malformed"
                      ? verification.format.issues[0]
                      : undefined
                  }
                />
                <CheckRow
                  label="RECEIPT DIGEST"
                  valid={verification.receiptDigest.status === "verified"}
                  details={statusDetail(verification.receiptDigest.status, envelope.receiptDigest)}
                />
                <CheckRow
                  label="ISSUER SIGNATURE"
                  valid={verification.issuer.status === "verified"}
                  details={statusDetail(
                    verification.issuer.status,
                    `${body.issuer.keyId} · ${body.issuer.address}`,
                  )}
                />
                <CheckRow
                  label="AGENT SIGNATURE"
                  valid={verification.request.status === "verified"}
                  details={statusDetail(verification.request.status, request.agentSignerAddress)}
                />
                <p className="pt-4 text-[12px] leading-[1.6] text-[var(--wl-secondary2)]">
                  The issuer signed the receipt; the agent signed the request inside it. Neither
                  signature authorizes a transfer, and the wallet decided again at execution time.
                </p>
              </div>
            ) : (
              <div className="animate-pulse py-8 text-center font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                VERIFYING SIGNATURES...
              </div>
            )}
          </section>

          <section className="border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-6 md:p-8 lg:col-span-2">
            <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              EVALUATED AT BLOCK{" "}
              <a
                href={blockUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--wl-ink)] underline underline-offset-4 hover:text-[var(--wl-signal)]"
              >
                {evaluation.blockNumber} <Arrow glyph="↗" />
              </a>
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
              <Field label="BLOCK TIME">{formatUnixUtc(evaluation.blockTimestamp)}</Field>
              <Field label="BLOCK HASH">{truncateAddress(evaluation.blockHash, 10, 8)}</Field>
              <Field label="SIGNER AUTHORIZED">
                <Flag value={evaluation.signerAuthorized} yes="YES" no="NO" />
              </Field>
              <Field label="WALLET FROZEN">
                <Flag value={!evaluation.frozen} yes="NO" no="YES" />
              </Field>

              <Field label="PER-TX CAP">{formatUSDCFromBaseUnits(policy.perTxCap)}</Field>
              <Field label="ESCALATION THRESHOLD">
                {formatUSDCFromBaseUnits(policy.escalationThreshold)}
              </Field>
              <Field label="DAILY SPENT / CAP">
                {formatUSDCFromBaseUnits(spend.effectiveDailySpent)} /{" "}
                {formatUSDCFromBaseUnits(policy.daily24hCap)}
              </Field>
              <Field label="MONTHLY SPENT / CAP">
                {formatUSDCFromBaseUnits(spend.effectiveMonthlySpent)} /{" "}
                {formatUSDCFromBaseUnits(policy.monthlyCap)}
              </Field>

              <Field label="VENDOR STATUS">
                {vendor.blocked ? (
                  <span className="text-[var(--wl-signal)]">BLOCKED</span>
                ) : vendor.allowed ? (
                  "ALLOWLISTED"
                ) : (
                  <span className="text-[var(--wl-signal)]">NOT ALLOWLISTED</span>
                )}
              </Field>
              <Field label="VENDOR CATEGORY">{vendorCategoryName(vendor.category)}</Field>
              <Field label="PER-VENDOR CAP">
                {vendor.perVendorCap === "0"
                  ? "NONE"
                  : formatUSDCFromBaseUnits(vendor.perVendorCap)}
              </Field>
              <Field label="ALLOWED CATEGORIES">
                {allowedCategoryNames(policy.allowedCategories)}
              </Field>

              <Field label="ALLOWLIST REQUIRED">{policy.requireAllowlist ? "YES" : "NO"}</Field>
              <Field label="FREEZE ON BLOCKED VENDOR">
                {policy.freezeOnBlockedVendor ? "YES" : "NO"}
              </Field>
              <Field label="USDC BALANCE">{formatUSDCFromBaseUnits(evaluation.usdcBalance)}</Field>
              <Field label="POLICY VERSION">{evaluation.policyVersion}</Field>

              <Field label="POLICY ENGINE" wide>
                <AddressLink address={evaluation.policyEngine} />
              </Field>
              <Field label="VENDOR REGISTRY" wide>
                <AddressLink address={evaluation.vendorRegistry} />
              </Field>
              <Field label="ESCALATION MANAGER" wide>
                <AddressLink address={evaluation.escalationManager} />
              </Field>
            </dl>
          </section>

          <section className="border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-6 md:p-8 lg:col-span-2">
            <h2 className="mb-6 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              WHAT THE CHAIN DID
            </h2>
            {data.evidence.length === 0 ? (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  NO EVIDENCE LINKED
                </p>
                <p className="mt-3 max-w-[70ch] text-[13px] leading-[1.6] text-[var(--wl-secondary2)]">
                  {decision.verdict === "allow" || decision.verdict === "escalate"
                    ? "No transaction has been linked to this receipt yet. Evidence appears once the agent submits the payment and posts its transaction hash."
                    : "This verdict does not execute, so a compliant agent sends nothing. Evidence only appears here if a transaction was sent regardless."}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {data.evidence.map((row) => {
                  const txUrl = getArcscanTxUrl(row.txHash);
                  const agreed = chainAgreement(row);
                  return (
                    <div
                      key={row.id}
                      className="flex flex-col gap-3 border-l-2 border-[var(--wl-line-bold)] pl-4 md:flex-row md:items-start md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[11px] font-medium uppercase tracking-[.1em]">
                            {row.kind} / {row.outcome}
                          </span>
                          {agreed !== null && (
                            <span
                              className={`font-mono text-[9px] uppercase tracking-[.14em] ${agreed ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
                            >
                              {agreed
                                ? "CHAIN AGREED WITH RECEIPT"
                                : "CHAIN DISAGREED WITH RECEIPT"}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-[var(--wl-secondary)]">
                          OBSERVED {formatUtc(row.observedAt)}
                          {row.blockNumber !== null && ` · BLOCK ${row.blockNumber}`}
                          {row.calldataNamesReceipt === true && " · CALLDATA NAMES THIS RECEIPT"}
                          {row.calldataNamesReceipt === false &&
                            " · CALLDATA DOES NOT NAME THIS RECEIPT"}
                        </p>
                        {row.escalationKey && (
                          <p className="mt-1 break-all font-mono text-[10px] text-[var(--wl-mute)]">
                            ESCALATION {row.escalationKey}
                          </p>
                        )}
                      </div>
                      {txUrl && (
                        <a
                          href={txUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-ink)] underline underline-offset-4 hover:text-[var(--wl-signal)]"
                        >
                          VIEW TX <Arrow glyph="↗" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
