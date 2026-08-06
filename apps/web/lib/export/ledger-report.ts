/**
 * Ledger export — CSV download and a print-ready report window.
 *
 * Both exports operate on the rows the user currently sees (filters applied),
 * so the report always matches the on-screen record.
 */

import type { LedgerEntry } from "@/lib/types";

export type LedgerReportContext = {
  /** Rows to export, in display order (newest first). */
  rows: LedgerEntry[];
  /** Human description of active filters, e.g. "Status: ESCALATED · Search: openai". */
  filtersLabel: string;
  /** Pre-formatted totals for the exported set. */
  totals: { valueLabel: string; approved: number; rejected: number; escalated: number };
  /** Formats an amount for display, e.g. formatUsd. */
  formatAmount: (amount: number) => string;
  /** Maps a category id to its display label. */
  formatCategory: (category: LedgerEntry["category"]) => string;
};

function csvCell(value: string | number): string {
  let text = String(value ?? "");
  // Neutralize spreadsheet formula injection: Excel/Sheets evaluate cells
  // starting with = + - @ (and tab/CR-prefixed variants) even when quoted.
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildLedgerCsv({ rows, formatCategory }: LedgerReportContext): string {
  const header = [
    "Timestamp (UTC)",
    "Agent",
    "Counterparty",
    "Counterparty address",
    "Category",
    "Amount (USDC)",
    "Status",
    "Decision reason",
    "Tx hash",
    "Block",
  ];
  const lines = rows.map((row) =>
    [
      row.timestamp,
      row.agentName,
      row.counterparty,
      row.counterpartyAddress,
      formatCategory(row.category),
      row.amount.toFixed(2),
      row.status.toUpperCase(),
      row.reason,
      row.hash,
      row.block > 0 ? row.block : "",
    ]
      .map(csvCell)
      .join(","),
  );
  return `${[header.map(csvCell).join(","), ...lines].join("\r\n")}\r\n`;
}

export function downloadLedgerCsv(context: LedgerReportContext, now = new Date()): void {
  const stamp = now.toISOString().slice(0, 19).replace(/[T:]/g, "-");
  const blob = new Blob([`\uFEFF${buildLedgerCsv(context)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `arcanum-ledger-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shortHash(hash: string): string {
  return /^0x[a-fA-F0-9]{10,}$/.test(hash) ? `${hash.slice(0, 10)}…${hash.slice(-6)}` : hash;
}

export function buildLedgerReportHtml(context: LedgerReportContext, now = new Date()): string {
  const { rows, filtersLabel, totals, formatAmount, formatCategory } = context;
  const generated = `${now.toISOString().replace("T", " ").slice(0, 19)} UTC`;

  const bodyRows = rows
    .map(
      (row, index) => `
      <tr>
        <td class="mono">${index + 1}</td>
        <td class="mono">${escapeHtml(row.timestamp.replace("T", " ").slice(0, 19))}</td>
        <td>${escapeHtml(row.agentName)}</td>
        <td>${escapeHtml(row.counterparty)}<div class="sub mono">${escapeHtml(row.counterpartyAddress)}</div></td>
        <td>${escapeHtml(formatCategory(row.category))}</td>
        <td class="num">${escapeHtml(formatAmount(row.amount))}</td>
        <td><span class="status status-${row.status}">${row.status.toUpperCase()}</span></td>
        <td class="reason">${escapeHtml(row.reason)}<div class="sub mono">${escapeHtml(shortHash(row.hash))}</div></td>
      </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>ARCANUM · Governed Ledger Report</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 40px auto; max-width: 1080px; padding: 0 24px; color: #1a1713;
         font: 13px/1.5 "Helvetica Neue", Arial, sans-serif; background: #fff; }
  .mono { font-family: "SF Mono", "Cascadia Mono", Consolas, monospace; font-size: 11px; }
  header { border-bottom: 2px solid #1a1713; padding-bottom: 18px; }
  .kicker { font-family: monospace; font-size: 10px; letter-spacing: .18em; color: #c2410c; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 34px; margin: 8px 0 4px; }
  .meta { display: flex; flex-wrap: wrap; gap: 6px 28px; margin-top: 10px; color: #57534e; font-size: 11px; }
  .meta b { color: #1a1713; font-weight: 600; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #d6d3d1;
             border-radius: 6px; margin: 22px 0; overflow: hidden; }
  .summary > div { padding: 14px 16px; border-left: 1px solid #d6d3d1; }
  .summary > div:first-child { border-left: none; }
  .summary .label { font-family: monospace; font-size: 9px; letter-spacing: .15em; color: #78716c; }
  .summary .value { font-family: Georgia, serif; font-size: 24px; margin-top: 6px; }
  .summary .accent { color: #c2410c; }
  table { width: 100%; border-collapse: collapse; }
  thead th { text-align: left; font-family: monospace; font-size: 9px; letter-spacing: .14em;
             color: #78716c; border-bottom: 1px solid #1a1713; padding: 8px 10px; }
  tbody td { border-bottom: 1px solid #e7e5e4; padding: 9px 10px; vertical-align: top; }
  tbody tr:nth-child(even) { background: #fafaf9; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  .sub { color: #a8a29e; font-size: 10px; margin-top: 2px; word-break: break-all; }
  .reason { max-width: 260px; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-family: monospace;
            font-size: 9px; letter-spacing: .1em; border: 1px solid currentColor; }
  .status-approved { color: #15803d; } .status-rejected { color: #b91c1c; }
  .status-escalated { color: #c2410c; } .status-frozen { color: #1a1713; }
  footer { margin-top: 26px; padding-top: 12px; border-top: 1px solid #d6d3d1;
           color: #a8a29e; font-size: 10px; display: flex; justify-content: space-between; }
  @media print {
    body { margin: 0; max-width: none; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
  }
</style>
</head>
<body>
  <header>
    <p class="kicker">ARCANUM / GOVERNED LEDGER</p>
    <h1>Decision Record Report</h1>
    <div class="meta">
      <span>Generated <b>${escapeHtml(generated)}</b></span>
      <span>Window <b>Live read model · ${rows.length} most recent movement${rows.length === 1 ? "" : "s"}</b></span>
      <span>Filters <b>${escapeHtml(filtersLabel)}</b></span>
    </div>
  </header>

  <section class="summary">
    <div><p class="label">TOTAL VALUE</p><p class="value">${escapeHtml(totals.valueLabel)}</p></div>
    <div><p class="label">APPROVED</p><p class="value">${totals.approved}</p></div>
    <div><p class="label">REJECTED</p><p class="value">${totals.rejected}</p></div>
    <div><p class="label">ESCALATED</p><p class="value accent">${totals.escalated}</p></div>
  </section>

  <table>
    <thead>
      <tr>
        <th>#</th><th>TIME (UTC)</th><th>AGENT</th><th>COUNTERPARTY</th>
        <th>CATEGORY</th><th class="num">AMOUNT</th><th>STATUS</th><th>REASON / TX</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>

  <footer>
    <span>Every governed movement carries the decision that allowed it.</span>
    <span>arcanum · governed ledger</span>
  </footer>
</body>
</html>`;
}

/** Opens the report in a new window and triggers the print dialog (save as PDF). */
export function openLedgerReport(context: LedgerReportContext): boolean {
  // Must NOT pass "noopener" here: it disowns the new browsing context and
  // window.open returns null, so the report could never be written. We sever
  // the reverse link manually instead.
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) return false;
  reportWindow.opener = null;
  reportWindow.document.write(buildLedgerReportHtml(context));
  reportWindow.document.close();
  reportWindow.focus();
  // Give the new document a beat to lay out before the print dialog opens.
  reportWindow.setTimeout(() => reportWindow.print(), 250);
  return true;
}
