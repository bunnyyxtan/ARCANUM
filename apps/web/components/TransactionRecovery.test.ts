import type { PendingTransaction } from "@/lib/transaction-recovery";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { TransactionRecoveryPanel } from "./TransactionRecovery";

const pending: PendingTransaction = {
  account: `0x${"1".repeat(40)}`,
  chainId: 5042002,
  action: "wallet:policy",
  label: "setPolicy",
  createdAt: 1,
  hash: `0x${"a".repeat(64)}`,
  status: "unknown",
};
function panel(overrides: Partial<Parameters<typeof TransactionRecoveryPanel>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(TransactionRecoveryPanel, {
      recovery: { records: [pending], online: true, isConnected: true },
      clientReady: true,
      checking: null,
      message: null,
      onCheck: vi.fn(),
      onDismiss: vi.fn(),
      ...overrides,
    }),
  );
}
describe("transaction recovery rendered controls (not a mounted browser test)", () => {
  it("shows the original hash and explorer recovery without a resend or pending dismissal control", () => {
    const html = panel();
    expect(html).toContain(pending.hash);
    expect(html).toContain("View original transaction");
    expect(html).toContain("Check status");
    expect(html).toContain("Outcome unknown");
    expect(html).not.toContain("Dismiss confirmed record");
    expect(html).not.toContain('disabled=""');
    expect(html).not.toContain(">Retry");
  });

  it.each([
    { online: false, isConnected: true },
    { online: true, isConnected: false },
  ])("disables status checks when offline or disconnected: %j", (connection) => {
    const html = panel({ recovery: { records: [pending], ...connection } });
    expect(html).toContain('disabled=""');
    expect(html).toContain(pending.hash);
    if (!connection.online) expect(html).toContain("reconnect to check status");
  });

  it("disables unavailable RPC, concurrent checks, and reservations without a hash", () => {
    expect(panel({ clientReady: false })).toContain('disabled=""');
    expect(panel({ checking: "busy" })).toContain('disabled=""');
    const html = panel({
      recovery: { records: [{ ...pending, hash: undefined }], online: true, isConnected: true },
    });
    expect(html).toContain('disabled=""');
    expect(html).toContain("this action remains blocked");
  });

  it("names final receipt state without inferring business success and permits only final dismissal", () => {
    for (const status of ["success", "reverted", "cancelled", "replaced"] as const) {
      const html = panel({
        recovery: { records: [{ ...pending, status }], online: true, isConnected: true },
      });
      expect(html).toContain(`Transaction ${status}`);
      expect(html).toContain("does not prove the intended business outcome");
      expect(html).toContain("Dismiss confirmed record");
    }
  });

  it("keeps storage-failure hash warnings visible", () => {
    const html = panel({
      recovery: {
        records: [{ ...pending, storageError: "Copy this hash now" }],
        error: "Storage unavailable",
        online: true,
        isConnected: true,
      },
    });
    expect(html).toContain("Copy this hash now");
    expect(html).toContain(pending.hash);
    expect(html).toContain('role="alert"');
  });
});
