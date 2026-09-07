"use client";

import type { Address } from "viem";

import { useAgentSignerState } from "./use-agent-signer-state";
import { useAgentSignerWrite } from "./use-agent-signer-write";

function useAgentSignerControllerInternal(governedWalletAddress: Address | null) {
  const state = useAgentSignerState(governedWalletAddress);
  const write = useAgentSignerWrite(governedWalletAddress, state);
  const txStatusLabel =
    state.txStatus === "wallet"
      ? "CONFIRM IN WALLET"
      : state.txStatus === "confirming"
        ? "WAITING FOR RECEIPT"
        : state.txStatus === "syncing"
          ? "SYNCING RECORD"
          : state.txStatus === "synced"
            ? "SIGNER STATE SYNCED"
            : state.txStatus === "sync_failed"
              ? "CONTRACT CONFIRMED · RECORD SYNC FAILED"
              : null;
  return {
    address: state.address,
    canAuthorize: write.canAuthorize,
    canRevoke: write.canRevoke,
    chainId: write.chainId,
    isConnected: state.isConnected,
    managementDisabledReason: write.managementDisabledReason,
    setSignerInput: state.setSignerInput,
    signerAuthorized: state.signerAuthorized,
    signerInput: state.signerInput,
    submitSignerWrite: write.submitSignerWrite,
    switchToArcTestnet: write.switchToArcTestnet,
    txArcscanUrl: write.txArcscanUrl,
    txError: state.txError,
    txStatusLabel,
    usableSignerAddress: state.usableSignerAddress,
  };
}

export type AgentSignerController = ReturnType<typeof useAgentSignerControllerInternal>;

export function useAgentSignerController(
  governedWalletAddress: Address | null,
): AgentSignerController {
  return useAgentSignerControllerInternal(governedWalletAddress);
}
