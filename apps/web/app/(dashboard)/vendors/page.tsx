"use client";

import { AddVendorModal } from "@/components/warm/AddVendorModal";

import { VendorDetailPanel } from "./_components/vendor-detail-panel";
import { VendorRegistry } from "./_components/vendor-registry";
import { VendorHeader } from "./_components/vendor-summary";
import { useVendorsController } from "./_hooks/use-vendors-controller";

export default function VendorsPage() {
  const controller = useVendorsController();
  const { form } = controller;
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <style>{`
        .vendor-row{animation:vendorIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 80ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .vendor-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes vendorIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.vendor-row{animation:none;transition:none}.vendor-row:hover{transform:none}}
      `}</style>
      <VendorHeader
        approvedCount={controller.approvedCount}
        blockedCount={controller.blockedCount}
        categoryCount={controller.categoryCount}
        openAddVendor={controller.openAddVendor}
      />
      <VendorRegistry
        errored={controller.errored}
        loading={controller.loading}
        openAddVendor={controller.openAddVendor}
        registry={controller.registry}
        retryVendors={controller.retryVendors}
        rowActions={{
          isVendorFlagged: controller.isVendorFlagged,
          selectVendor: controller.selectVendor,
          setVendorStatusRemote: controller.setVendorStatusRemote,
          vendorFlagDetail: controller.vendorFlagDetail,
          vendorSaving: controller.form.vendorSaving,
          vendorUnflagDetail: controller.vendorUnflagDetail,
        }}
        selected={controller.selected}
        visible={controller.visible}
        workspace={controller.workspace}
      />
      <VendorDetailPanel
        controls={{
          detail: controller.detail,
          flagToggling: controller.flagToggling,
          isConnected: controller.isConnected,
          isVendorFlagged: controller.isVendorFlagged,
          saveNoteEdit: controller.saveNoteEdit,
          setVendorStatusRemote: controller.setVendorStatusRemote,
          submitCap: controller.submitCap,
          toggleVendorFlag: controller.toggleVendorFlag,
          vendorFlagDetail: controller.vendorFlagDetail,
          vendorSaving: controller.form.vendorSaving,
        }}
        flagHistory={controller.flagHistory}
        isVendorFlagged={controller.isVendorFlagged}
        selected={controller.selected}
        vendorFlagDetail={controller.vendorFlagDetail}
        vendorUnflagDetail={controller.vendorUnflagDetail}
      />
      {form.addVendorOpen && (
        <AddVendorModal
          error={form.vendorError}
          form={form.vendorForm}
          networkNotice={controller.vendorNetworkNotice}
          onAdd={controller.addVendorRemote}
          onChange={controller.updateVendorForm}
          onClose={controller.closeAddVendor}
          onWalletChange={form.setSelectedWalletAddress}
          saving={form.vendorSaving || controller.switchPending || controller.writePending}
          selectedWalletAddress={form.selectedWalletAddress}
          txHash={form.vendorTxHash}
          walletOptions={controller.walletOptions}
          writeDisabledReason={controller.vendorWriteDisabledReason}
        />
      )}
    </div>
  );
}
