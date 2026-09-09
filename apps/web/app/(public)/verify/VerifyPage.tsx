"use client";

import { StatusPill } from "@/components/arcanum/status-pill";
import { EmberMark } from "@/components/warm/EmberMark";
import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { formatUsd, truncateAddress } from "@/lib/format";
import { formatUnixUtc, formatUtc, verdictTone } from "@/lib/receipts";
import {
  ARC_NETWORK_BADGE,
  PAYMENT_RECEIPT_ISSUERS,
  type PaymentReceiptVerification,
  verifyPaymentReceipt,
} from "@arcanum/shared";
import Link from "next/link";
import { type ChangeEvent, useRef, useState } from "react";

function statusDetail(status: string, fallback?: string) {
  return status === "verified" || status === "not_checked"
    ? fallback
    : status.replace(/_/g, " ").toUpperCase();
}

function CheckRow({ label, valid, details }: { label: string; valid: boolean; details?: string }) {
  return (
    <div className="flex items-start justify-between border-b border-[var(--wl-line-faint)] py-3 last:border-0">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-body)]">
          {label}
        </span>
        {details && <p className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">{details}</p>}
      </div>
      <span
        className={`font-mono text-[10px] tracking-[.1em] ${valid ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
      >
        {valid ? "PASS" : "FAIL"}
      </span>
    </div>
  );
}

export function VerifyPage() {
  const [jsonInput, setJsonInput] = useState("");
  const [verification, setVerification] = useState<PaymentReceiptVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // Each run gets a sequence number so a slow verification cannot report on
  // input that has since been replaced.
  const runRef = useRef(0);

  const replaceInput = (value: string) => {
    runRef.current += 1;
    setJsonInput(value);
    setVerification(null);
    setError(null);
    setIsVerifying(false);
  };

  const handleVerify = async () => {
    const run = ++runRef.current;
    setError(null);
    setVerification(null);
    if (!jsonInput.trim()) {
      setError("Paste a receipt envelope first.");
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonInput);
    } catch {
      setError("That is not valid JSON.");
      return;
    }
    setIsVerifying(true);
    try {
      const result = await verifyPaymentReceipt(parsed);
      if (run === runRef.current) setVerification(result);
    } catch (cause) {
      // The verifier throws only for input it cannot serialize at all, such
      // as a string with a lone surrogate. That is a bad receipt, not a page
      // failure.
      if (run === runRef.current) {
        setError(
          cause instanceof Error
            ? `The receipt could not be verified: ${cause.message}`
            : "The receipt could not be verified.",
        );
      }
    } finally {
      if (run === runRef.current) setIsVerifying(false);
    }
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        replaceInput(reader.result);
      }
    };
    reader.readAsText(file);
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        @keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        .rise{animation:rise 500ms cubic-bezier(.16,1,.3,1) both}
      `}</style>
      <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-4 md:px-9 md:py-5">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-[18px] font-bold tracking-[-.015em]"
        >
          <EmberMark size={24} />
          ARCANUM
        </Link>
        <div className="flex items-center gap-3 md:gap-5">
          <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">
            OFFLINE VERIFIER
          </span>
          <span className="rounded-full border border-[var(--wl-line)] px-3 py-2 font-mono text-[9px] tracking-[.12em] text-[var(--wl-body)]">
            {ARC_NETWORK_BADGE}
          </span>
          <ThemeToggle />
        </div>
      </nav>

      <div className="mx-auto max-w-[1080px] px-5 py-6 md:px-9 md:py-16">
        <header className="rise border-b border-[var(--wl-line)] pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            TRUSTLESS VERIFICATION
          </p>
          <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <h1 className="font-display text-[clamp(3rem,7vw,6rem)] font-semibold leading-[.84] tracking-[-.015em]">
                Verify Receipts
                <br />
                <span className="text-[var(--wl-dim)]">Offline.</span>
              </h1>
              <p className="mt-6 max-w-[430px] text-[14px] leading-[1.5] text-[var(--wl-body)]">
                Paste a payment decision receipt and this page checks its digest, the issuer
                signature against the published registry, and the agent signature inside it. The
                checks run in your browser; nothing is sent anywhere and no wallet is needed.
              </p>
            </div>
          </div>
        </header>

        <section
          className="rise mt-6 grid gap-8 md:grid-cols-2 md:mt-10"
          style={{ animationDelay: "100ms" }}
        >
          <div>
            <label
              htmlFor="receipt-envelope"
              className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] mb-3 block"
            >
              PASTE RECEIPT JSON
            </label>
            <textarea
              id="receipt-envelope"
              className="w-full h-64 border border-[var(--wl-line-bold)] bg-[var(--wl-bg-soft)] p-4 font-mono text-[10px] text-[var(--wl-ink)] focus:border-[var(--wl-signal)] focus:outline-none"
              placeholder='{"receipt": {...}, "receiptDigest": "0x...", "signature": "0x..."}'
              value={jsonInput}
              onChange={(event) => replaceInput(event.target.value)}
            />

            <div className="mt-4 flex items-center justify-between">
              <label className="cursor-pointer font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-ink)] underline underline-offset-4 hover:text-[var(--wl-signal)]">
                UPLOAD .JSON FILE
                <input type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
              </label>

              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className="rounded-full bg-[var(--wl-signal)] px-6 py-2.5 font-mono text-[11px] font-semibold tracking-[.05em] text-[var(--wl-bg)] transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {isVerifying ? "VERIFYING..." : "VERIFY"}
              </button>
            </div>

            {error && (
              <div className="mt-6 border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] p-4">
                <p className="font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-signal)]">
                  ERROR
                </p>
                <p className="mt-2 text-[13px] text-[var(--wl-body)]">{error}</p>
              </div>
            )}
          </div>

          <div>
            {verification && (
              <div className="border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-6 shadow-[12px_14px_0_var(--wl-bg-deep2)]">
                <div className="border-b border-[var(--wl-line)] pb-6 mb-6">
                  <h2 className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-mute)] mb-4">
                    VERIFICATION RESULT
                  </h2>
                  <div
                    className={`text-[20px] font-medium tracking-[-.02em] ${verification.ok ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
                  >
                    {verification.ok ? "Receipt verifies" : "Verification failed"}
                  </div>
                </div>

                <div className="space-y-1 mb-8">
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
                    details={statusDetail(verification.receiptDigest.status)}
                  />
                  <CheckRow
                    label="ISSUER SIGNATURE"
                    valid={verification.issuer.status === "verified"}
                    details={statusDetail(
                      verification.issuer.status,
                      verification.body ? `Key ${verification.body.issuer.keyId}` : undefined,
                    )}
                  />
                  <CheckRow
                    label="AGENT SIGNATURE"
                    valid={verification.request.status === "verified"}
                    details={statusDetail(
                      verification.request.status,
                      verification.body?.request.agentSignerAddress,
                    )}
                  />
                </div>

                {verification.body && (
                  <div>
                    <h3 className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] mb-3">
                      RECEIPT CONTENTS
                    </h3>
                    <div className="bg-[var(--wl-bg-soft)] p-4">
                      <dl className="grid grid-cols-2 gap-y-3 gap-x-4">
                        <div>
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            DECISION
                          </dt>
                          <dd className="mt-1">
                            <StatusPill
                              status={verification.body.decision.verdict.toUpperCase()}
                              tone={verdictTone(verification.body.decision.verdict)}
                            />
                            <span className="ml-3 font-mono text-[10px] text-[var(--wl-secondary)]">
                              {verification.body.decision.reasonCode}
                            </span>
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            AMOUNT
                          </dt>
                          <dd className="mt-1 font-mono text-[11px]">
                            {formatUsd(Number(verification.body.request.amount))}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            VENDOR
                          </dt>
                          <dd className="mt-1 font-mono text-[10px] break-all">
                            {verification.body.request.vendorAddress}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            WALLET
                          </dt>
                          <dd className="mt-1 font-mono text-[10px] break-all">
                            {verification.body.request.governedWalletAddress}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            ISSUED
                          </dt>
                          <dd className="mt-1 font-mono text-[10px]">
                            {formatUtc(verification.body.issuedAt)}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            EVALUATED AT BLOCK
                          </dt>
                          <dd className="mt-1 font-mono text-[10px]">
                            {verification.body.evaluation.blockNumber} ·{" "}
                            {formatUnixUtc(verification.body.evaluation.blockTimestamp)}
                          </dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="font-mono text-[8.5px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            ISSUER
                          </dt>
                          <dd className="mt-1 font-mono text-[10px] break-all text-[var(--wl-secondary)]">
                            {verification.body.issuer.keyId} · {verification.body.issuer.address}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-8 border border-[var(--wl-line-faint)] bg-[var(--wl-bg-soft)] p-5">
              <h3 className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] mb-3">
                TRUSTED REGISTRY
              </h3>
              <ul className="space-y-2">
                {PAYMENT_RECEIPT_ISSUERS.map((issuer) => (
                  <li
                    key={issuer.keyId}
                    className="font-mono text-[9px] text-[var(--wl-secondary)]"
                  >
                    <span className="text-[var(--wl-ink)]">{issuer.keyId}</span>
                    <br />
                    {truncateAddress(issuer.address, 12, 12)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
