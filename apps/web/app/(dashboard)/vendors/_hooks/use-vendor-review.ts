"use client";

import { describeChainError } from "@/lib/chain-errors";
import { useVendorFlags } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { Vendor } from "@/lib/types";
import { useAccount } from "wagmi";
import type { useVendorSelection } from "./use-vendor-selection";

type VendorSelection = ReturnType<typeof useVendorSelection>;

export function useVendorReview(selection: VendorSelection) {
  const { isConnected } = useAccount();
  const vendorFlagsState = useVendorFlags();
  const flagMutation = trpc.vendorFlags.flag.useMutation();
  const unflagMutation = trpc.vendorFlags.unflag.useMutation();
  const updateNoteMutation = trpc.vendorFlags.updateNote.useMutation();
  const utils = trpc.useUtils();
  const flagToggling =
    flagMutation.isPending || unflagMutation.isPending || updateNoteMutation.isPending;
  const isVendorFlagged = (address: string) =>
    vendorFlagsState.flaggedAddresses.has(address.toLowerCase());
  const vendorFlagDetail = (address: string) =>
    vendorFlagsState.flagDetails.get(address.toLowerCase());
  const vendorUnflagDetail = (address: string) =>
    vendorFlagsState.unflagDetails.get(address.toLowerCase());
  const toggleVendorFlag = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    if (!isVendorFlagged(vendorAddress) && !selection.detail.flagNoteOpen) {
      selection.detail.setFlagNote("");
      selection.detail.setFlagNoteOpen(true);
      return;
    }
    try {
      if (isVendorFlagged(vendorAddress)) {
        await unflagMutation.mutateAsync({ vendorAddress });
        selection.setNotice(`${vendor.name.toUpperCase()} REVIEW FLAG CLEARED`);
      } else {
        const note = selection.detail.flagNote.trim();
        await flagMutation.mutateAsync(note ? { vendorAddress, note } : { vendorAddress });
        selection.detail.setFlagNoteOpen(false);
        selection.detail.setFlagNote("");
        selection.setNotice(`${vendor.name.toUpperCase()} FLAGGED FOR REVIEW`);
      }
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      selection.setNotice(describeChainError(caught).toUpperCase());
    }
  };
  const saveNoteEdit = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    const note = selection.detail.noteEditValue.trim();
    try {
      await updateNoteMutation.mutateAsync({ vendorAddress, note: note || null });
      selection.detail.setNoteEditOpen(false);
      selection.detail.setNoteEditValue("");
      selection.setNotice(
        `${vendor.name.toUpperCase()} REVIEW NOTE ${note ? "UPDATED" : "CLEARED"} · FLAG PRESERVED`,
      );
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      selection.setNotice(describeChainError(caught).toUpperCase());
    }
  };
  return {
    flagToggling,
    isConnected,
    isVendorFlagged,
    saveNoteEdit,
    toggleVendorFlag,
    vendorFlagDetail,
    vendorUnflagDetail,
  };
}
