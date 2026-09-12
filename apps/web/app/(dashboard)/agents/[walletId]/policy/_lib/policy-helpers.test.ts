import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deployment", () => ({
  contractAddresses: {
    anomalyOracle: "0x0000000000000000000000000000000000000001",
    escalationManager: "0x0000000000000000000000000000000000000002",
    policyEngine: "0x0000000000000000000000000000000000000003",
    usdc: "0x0000000000000000000000000000000000000004",
    vendorRegistry: "0x0000000000000000000000000000000000000005",
    walletFactory: "0x0000000000000000000000000000000000000006",
  },
}));

import { initialPolicyDraft as DEFAULT_POLICY, type PolicyDraftState } from "@/lib/contracts";
import {
  buildPolicyEnvelope,
  policyRouteWriteError,
  policyValidationError,
  policyWalletAddressForRoute,
  policyWriteIntentMismatch,
  policyWriteIntentSnapshot,
  reconcilePolicyDraft,
} from "./policy-helpers";

const draft: PolicyDraftState = {
  dailyCap: "100",
  enabledCategories: new Set(["API"]),
  escalationThreshold: "50",
  freezeOnBlockedVendor: true,
  monthlyCap: "1000",
  perTxCap: "75",
  requireAllowlist: true,
};

describe("policy draft validation and reconciliation", () => {
  it("keeps the exported default policy threshold within its per-transaction cap", () => {
    expect(BigInt(DEFAULT_POLICY.escalationThreshold)).toBeLessThanOrEqual(
      BigInt(DEFAULT_POLICY.perTxCap),
    );
  });

  it("rejects an escalation threshold above the per-transaction cap", () => {
    expect(policyValidationError({ ...draft, escalationThreshold: "76" })).toBe(
      "Escalation threshold must be less than or equal to the per transaction cap.",
    );
  });

  it("preserves a dirty draft when a refetch observes a changed on-chain policy", () => {
    const dirtyDraft = { ...draft, dailyCap: "90" };
    const nextOnChain = { ...draft, dailyCap: "110" };

    expect(reconcilePolicyDraft(dirtyDraft, nextOnChain, false)).toEqual({
      draft: dirtyDraft,
      onChainChanged: true,
    });
  });

  it("uses the route wallet instead of retaining or selecting the first wallet", () => {
    const options = [
      { id: "first", address: "0x0000000000000000000000000000000000000001", label: "First" },
      { id: "target", address: "0x0000000000000000000000000000000000000002", label: "Target" },
    ];
    const target = options[1];
    if (!target) throw new Error("test target wallet missing");

    expect(policyWalletAddressForRoute("target", options)).toBe(target.address);
    expect(policyWalletAddressForRoute(target.address.toUpperCase(), options)).toBe(target.address);
  });

  it("clears an unknown nonempty route instead of retaining a loaded dirty wallet", () => {
    const options = [
      { id: "wallet-a", address: "0x0000000000000000000000000000000000000001", label: "Wallet A" },
    ];
    const loadedDirtyWallet = options[0];
    if (!loadedDirtyWallet) throw new Error("test wallet missing");

    expect(policyWalletAddressForRoute("wallet-that-does-not-exist", options)).toBeNull();
    expect(
      policyRouteWriteError("wallet-that-does-not-exist", options, loadedDirtyWallet.address),
    ).toBe("This policy route does not identify a governed wallet.");
  });

  it("rejects a stale selected wallet at the write boundary", () => {
    const options = [
      { id: "wallet-a", address: "0x0000000000000000000000000000000000000001", label: "Wallet A" },
      { id: "wallet-b", address: "0x0000000000000000000000000000000000000002", label: "Wallet B" },
    ];

    expect(policyRouteWriteError("wallet-b", options, options[0]?.address ?? "")).toBe(
      "Open the selected governed wallet's policy route before signing.",
    );
  });

  it("cancels a deferred switch when route, draft, and target change before write", async () => {
    const options = [
      { id: "wallet-a", address: "0x0000000000000000000000000000000000000001", label: "Wallet A" },
      { id: "wallet-b", address: "0x0000000000000000000000000000000000000002", label: "Wallet B" },
    ];
    const walletA = options[0];
    const walletB = options[1];
    if (!walletA || !walletB) throw new Error("test wallets missing");

    let currentDraft = draft;
    let currentRoute = walletA.id;
    let currentWallet = walletA.address;
    const makeCurrentSnapshot = () =>
      policyWriteIntentSnapshot({
        authenticated: true,
        connected: true,
        draft: currentDraft,
        envelope: buildPolicyEnvelope(currentDraft),
        governedWalletAddress: currentWallet,
        options,
        ownerAddress: walletA.address,
        routeWalletId: currentRoute,
        selectedPolicyWalletAddress: currentWallet,
        signerAddress: walletA.address,
      });
    const intent = makeCurrentSnapshot();
    let resolveSwitch!: () => void;
    const deferredSwitch = new Promise<void>((resolve) => {
      resolveSwitch = resolve;
    });
    const write = vi.fn();
    const mirror = vi.fn();
    const attempt = (async () => {
      await deferredSwitch;
      if (policyWriteIntentMismatch(intent, makeCurrentSnapshot(), true)) return;
      write();
      mirror();
    })();

    currentDraft = { ...draft, dailyCap: "90" };
    currentRoute = walletB.id;
    currentWallet = walletB.address;
    resolveSwitch();
    await attempt;

    expect(write).not.toHaveBeenCalled();
    expect(mirror).not.toHaveBeenCalled();
    expect(policyWriteIntentMismatch(intent, makeCurrentSnapshot(), false)).toBe(
      "Policy editor unmounted while preparing the transaction.",
    );
    expect(
      policyWriteIntentMismatch(intent, { ...intent, signerAddress: walletB.address }, true),
    ).toBe("Policy context changed while preparing the transaction. Review the policy and retry.");
  });
});
