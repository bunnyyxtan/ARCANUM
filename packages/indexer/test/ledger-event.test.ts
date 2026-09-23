import { describe, expect, it } from "vitest";
import { assertIdenticalLedgerEvent, ledgerImmutableFields } from "../src/ledger-event";

const event = {
  id: "ledger-1",
  organization_id: "org-1",
  governed_wallet_id: "wallet-1",
  tx_hash: "0xabc",
  log_index: 3,
  event_time: "2025-01-01T00:00:00Z",
  counterparty_address: "0xdef",
  amount_usdc: "1234567890123456789.123456",
  status: "allowed",
  decision_reason: "allowed",
  block_number: 50,
  chain_id: 5042002,
  policy_snapshot: { escalationId: "1", policyVersion: "2", councilVersion: "3" },
  data_source: "live",
};

describe("immutable ledger replay", () => {
  it("survives the native JSON.parse boundary only with exact SQL text projection", () => {
    const exactWire =
      '[{"id":"ledger-1","amount_usdc":"1234567890123456789.123456","block_number":"9007199254740993"}]';
    const nativeWire =
      '[{"id":"ledger-1","amount_usdc":1234567890123456789.123456,"block_number":9007199254740993}]';
    const expected = { ...event, block_number: "9007199254740993" };
    const [native] = JSON.parse(nativeWire);
    const [exact] = JSON.parse(exactWire);
    expect(String(native.amount_usdc)).not.toBe(event.amount_usdc);
    expect(String(native.block_number)).not.toBe(expected.block_number);
    expect(() => assertIdenticalLedgerEvent({ ...event, ...native }, expected)).toThrow(
      "amount_usdc",
    );
    expect(assertIdenticalLedgerEvent({ ...event, ...exact }, expected).id).toBe(event.id);
    expect(() =>
      assertIdenticalLedgerEvent(
        { ...event, ...exact },
        { ...expected, amount_usdc: "1234567890123456789.123457" },
      ),
    ).toThrow("amount_usdc");
    expect(() =>
      assertIdenticalLedgerEvent(
        { ...event, ...exact },
        { ...expected, block_number: "9007199254740994" },
      ),
    ).toThrow("block_number");
  });
  it.each([
    [1, "1.000000"],
    [0.3, "0.300000"],
    [1e21, "1000000000000000000000.000000"],
  ])("accepts lossless legacy Number amount %s", (stored, expected) => {
    expect(
      assertIdenticalLedgerEvent(
        { ...event, amount_usdc: stored },
        { ...event, amount_usdc: expected },
      ).id,
    ).toBe(event.id);
  });
  it("fails closed when historical float rounding erased financial precision", () => {
    expect(() =>
      assertIdenticalLedgerEvent(
        { ...event, amount_usdc: "9007199254.740992" },
        { ...event, amount_usdc: "9007199254.740993" },
      ),
    ).toThrow("amount_usdc");
  });
  it.each(ledgerImmutableFields)("rejects differing %s", (field) => {
    const replacement =
      field === "event_time"
        ? "2025-01-02T00:00:00Z"
        : ["chain_id", "block_number", "log_index", "amount_usdc"].includes(field)
          ? "4"
          : "different";
    expect(() => assertIdenticalLedgerEvent({ ...event, [field]: replacement }, event)).toThrow(
      "conflicting immutable",
    );
  });
  it("normalizes Postgres decimal, timestamp, bigint and JSON ordering without loss", () => {
    expect(
      assertIdenticalLedgerEvent(
        {
          ...event,
          amount_usdc: `${event.amount_usdc}000`,
          block_number: "50",
          event_time: "2025-01-01T01:00:00+01:00",
          policy_snapshot: { councilVersion: "3", policyVersion: "2", escalationId: "1" },
        },
        event,
      ).id,
    ).toBe(event.id);
  });
  it("permits legacy empty snapshots and changing display labels without adding deployment claims", () => {
    expect(
      assertIdenticalLedgerEvent(
        { ...event, policy_snapshot: {}, agent_label: "new" },
        {
          ...event,
          organization_id: "new-org",
          policy_snapshot: { enriched: "metadata", policyVersion: "2" },
          agent_label: "old",
        },
      ).id,
    ).toBe(event.id);
  });
  it.each(["escalationId", "policyVersion", "councilVersion"])(
    "rejects conflicting shared onchain snapshot claim %s",
    (key) => {
      expect(() =>
        assertIdenticalLedgerEvent(
          { ...event, policy_snapshot: { ...event.policy_snapshot, [key]: "other" } },
          event,
        ),
      ).toThrow(`policy_snapshot.${key}`);
    },
  );
  it("does not erase deployment identity when one is present", () => {
    expect(() =>
      assertIdenticalLedgerEvent(
        {
          ...event,
          policy_snapshot: { deploymentId: "other" },
        },
        { ...event, policy_snapshot: { deploymentId: "this" } },
      ),
    ).toThrow("policy_snapshot");
  });
});
