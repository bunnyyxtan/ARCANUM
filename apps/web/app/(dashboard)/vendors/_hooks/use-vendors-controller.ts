"use client";

import { useWorkspaceMode } from "@/lib/auth-session";
import { errorText } from "@/lib/chain-errors";
import { useLiveVendors } from "@/lib/live-data";
import { useVendorFilters } from "./use-vendor-filters";
import { useAddVendor, useVendorForm } from "./use-vendor-form";
import { useVendorMutations } from "./use-vendor-mutations";
import { useVendorReview } from "./use-vendor-review";
import { useVendorSelection } from "./use-vendor-selection";
import { useVendorWrite } from "./use-vendor-write";

function useVendorsControllerInternal() {
  const workspace = useWorkspaceMode();
  const liveVendors = useLiveVendors();
  const vendors = liveVendors.data;
  const filters = useVendorFilters(vendors);
  const form = useVendorForm(workspace.isAuthenticated);
  const selection = useVendorSelection(vendors);
  const write = useVendorWrite(form.selectedWalletAddress, form.walletsLoading, liveVendors);
  const mutations = useVendorMutations(
    form.selectedWalletAddress,
    form.setVendorSaving,
    selection,
    write,
  );
  const review = useVendorReview(selection);
  const addVendor = useAddVendor(form, selection, write);
  const registry = {
    category: filters.category,
    menu: selection.menu,
    notice: selection.notice,
    query: filters.query,
    selectedId: selection.selectedId,
    setCategory: filters.setCategory,
    setMenu: selection.setMenu,
    setNotice: selection.setNotice,
    setQuery: filters.setQuery,
    setSelectedId: selection.setSelectedId,
  };
  const retryVendors = async () => {
    try {
      await liveVendors.refetch();
    } catch (caught) {
      selection.setNotice(errorText(caught).toUpperCase());
    }
  };
  return {
    workspace,
    liveVendors,
    vendors,
    visible: filters.visible,
    selected: selection.selected,
    flagHistory: selection.flagHistory,
    approvedCount: filters.approvedCount,
    blockedCount: filters.blockedCount,
    categoryCount: filters.categoryCount,
    loading: liveVendors.isLoading && vendors.length === 0,
    errored: liveVendors.isError && vendors.length === 0,
    switchPending: write.switchPending,
    writePending: write.writePending,
    walletOptions: form.walletOptions,
    vendorWriteDisabledReason: write.vendorWriteDisabledReason,
    vendorNetworkNotice: write.vendorNetworkNotice,
    registry,
    detail: selection.detail,
    form,
    selectVendor: selection.selectVendor,
    ...review,
    updateVendorForm: form.updateVendorForm,
    closeAddVendor: form.closeAddVendor,
    openAddVendor: form.openAddVendor,
    ...addVendor,
    ...mutations,
    retryVendors,
  };
}

export type VendorsController = ReturnType<typeof useVendorsControllerInternal>;

export function useVendorsController(): VendorsController {
  return useVendorsControllerInternal();
}
