"use client";

import { ARC_NETWORK_NAME } from "@arcanum/shared";
import { useParams } from "next/navigation";

import { DeploymentRecord } from "./_components/deployment-record";
import { PolicyDocument } from "./_components/policy-document";
import { PolicyHeader } from "./_components/policy-header";
import { usePolicyController } from "./_hooks/use-policy-controller";

export default function PolicyEditorPage() {
  const params = useParams();
  const routeWalletId =
    typeof params.walletId === "string"
      ? params.walletId
      : Array.isArray(params.walletId)
        ? (params.walletId[0] ?? "")
        : "";
  const controller = usePolicyController(routeWalletId);

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .policy-in{animation:policyIn 560ms cubic-bezier(.16,1,.3,1) calc(var(--i,0)*80ms) both}@keyframes policyIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.policy-in{animation:none}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <PolicyHeader
          policyBusy={controller.policyBusy}
          policyPendingIndexer={controller.policyPendingIndexer}
          policyReadStatus={controller.policyReadStatus}
          policyTxHash={controller.policyTxHash}
          policyWalletOptions={controller.policyWalletOptions}
          policyWriteDisabledReason={controller.policyWriteDisabledReason}
          resetDraft={controller.resetDraft}
          routeWalletId={routeWalletId}
          savePolicyOnChain={controller.savePolicyOnChain}
          selectedPolicyWalletAddress={controller.selectedPolicyWalletAddress}
          selectedPolicyWalletLabel={controller.selectedPolicyWalletLabel}
          setSelectedPolicyWalletAddress={controller.setSelectedPolicyWalletAddress}
          unsavedCount={controller.unsavedCount}
        />
        <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <PolicyDocument
            policyBusy={controller.policyBusy}
            policyDraft={controller.policyDraft}
            policyError={controller.policyError}
            policyNetworkNotice={controller.policyNetworkNotice}
            onChainPolicyChanged={controller.onChainPolicyChanged}
            policyReadStatus={controller.policyReadStatus}
            policyWriteDisabledReason={controller.policyWriteDisabledReason}
            resetDraft={controller.resetDraft}
            reloadOnChainPolicy={controller.reloadOnChainPolicy}
            savePolicyOnChain={controller.savePolicyOnChain}
            selectedGovernedWalletAddress={controller.selectedGovernedWalletAddress}
            selectedPolicyWalletLabel={controller.selectedPolicyWalletLabel}
            toggleCategory={controller.toggleCategory}
            unsavedCount={controller.unsavedCount}
            updatePolicyDraft={controller.updatePolicyDraft}
            walletsLoading={controller.walletsLoading}
            validationError={controller.validationError}
          />
          <DeploymentRecord
            address={controller.address}
            deployStatusLabel={controller.deployStatusLabel}
            policyDiffs={controller.policyDiffs}
            policyWalletOwner={controller.policyWalletOwner}
            routeWalletId={routeWalletId}
            selectedGovernedWalletAddress={controller.selectedGovernedWalletAddress}
            unsavedCount={controller.unsavedCount}
          />
        </div>
        <footer className="mt-14 flex flex-col justify-between gap-3 border-t border-[var(--wl-line)] pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] sm:flex-row">
          <span>Draft changes · no capital movement until signed</span>
          <span>
            {controller.policyPendingIndexer
              ? "Revision deployed · record updating"
              : `${ARC_NETWORK_NAME} policy`}
          </span>
        </footer>
      </div>
    </main>
  );
}
