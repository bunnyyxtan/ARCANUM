"use client";

import { describeChainError } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress } from "@/lib/format/address";
import type { Vendor } from "@/lib/types";
import { arcChain } from "@arcanum/shared";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import { type Address, keccak256, toBytes } from "viem";
import { allowTrustedMutation, parseUsdcCapInput, vendorCategoryIndex } from "../_lib/helpers";
import type { useVendorSelection } from "./use-vendor-selection";
import type { useVendorWrite } from "./use-vendor-write";

type Selection = ReturnType<typeof useVendorSelection>;
type Write = ReturnType<typeof useVendorWrite>;

export function useVendorMutations(
  selectedWalletAddress: string,
  setVendorSaving: (saving: boolean) => void,
  selection: Selection,
  write: Write,
) {
  const setVendorStatusRemote = async (
    action: "block" | "remove",
    vendor: Vendor,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!allowTrustedMutation(`vendors.${action}`, event) || write.vendorSubmittingRef.current)
      return;
    if (!isEvmAddress(vendor.address)) {
      toast.info("Vendor action unavailable", {
        description: "A full vendor address is required for onchain writes.",
      });
      return;
    }
    if (vendor.walletAddress && !isSameAddress(vendor.walletAddress, selectedWalletAddress)) {
      toast.info("Vendor action unavailable", {
        description: "Select this vendor's governed wallet before writing.",
      });
      return;
    }
    write.vendorSubmittingRef.current = true;
    setVendorSaving(true);
    try {
      const governedWallet = await write.ensureVendorWriteReady();
      const hash = await write.writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: action === "block" ? "blockVendor" : "removeVendor",
        args: [vendor.address as Address],
        chainId: arcChain.id,
      });
      const receipt = await write.publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
      const syncFailed = await write.recordVendorState(governedWallet, vendor.address as Address, {
        name: vendor.name,
        category: vendor.category,
        kycStatus: vendor.confidential ? "arcanevm" : "public",
        perVendorCap: 0,
      });
      await write.refreshVendors();
      selection.setNotice(
        `${vendor.name.toUpperCase()} ${action === "block" ? "BLOCKED" : "REMOVED"} · CONFIRMED`,
      );
      if (!syncFailed) {
        toast.success(action === "block" ? "VENDOR BLOCK CONFIRMED" : "VENDOR REMOVE CONFIRMED", {
          description: "Onchain write confirmed and the vendor registry has been updated.",
        });
      }
    } catch (caught) {
      toast.error("VENDOR ACTION FAILED", { description: describeChainError(caught) });
    } finally {
      setVendorSaving(false);
      write.vendorSubmittingRef.current = false;
    }
  };
  const submitCap = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const vendor = selection.selected;
    if (!vendor) return;
    const amount = Number(selection.detail.capValue);
    if (!amount || amount <= 0) {
      selection.setNotice("ENTER A VALID MONTHLY CAP");
      return;
    }
    void submitVendorCap(event, vendor, amount);
  };
  const submitVendorCap = async (
    event: ReactMouseEvent<HTMLButtonElement>,
    vendor: Vendor,
    amount: number,
  ) => {
    if (!allowTrustedMutation("vendors.updateCap", event) || write.vendorSubmittingRef.current)
      return;
    if (!isEvmAddress(vendor.address)) {
      toast.info("Cap update unavailable", {
        description: "A full vendor address is required for onchain updates.",
      });
      return;
    }
    write.vendorSubmittingRef.current = true;
    setVendorSaving(true);
    try {
      const perVendorCap = parseUsdcCapInput(String(amount), "Per-vendor cap");
      const governedWallet = await write.ensureVendorWriteReady();
      const hash = await write.writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "addVendor",
        args: [
          vendor.address as Address,
          vendorCategoryIndex(vendor.category),
          perVendorCap,
          keccak256(toBytes(`arcanum-vendor:${vendor.name}:${vendor.address}:cap-update`)),
        ],
        chainId: arcChain.id,
      });
      const receipt = await write.publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
      const syncFailed = await write.recordVendorState(governedWallet, vendor.address as Address, {
        name: vendor.name,
        category: vendor.category,
        kycStatus: vendor.confidential ? "arcanevm" : "public",
        perVendorCap: Number(perVendorCap) / 1e6,
      });
      await write.refreshVendors();
      selection.detail.setCapEditing(false);
      selection.setNotice(
        `${vendor.name.toUpperCase()} CAP REVISED TO $${amount.toLocaleString("en-US")} / MO`,
      );
      if (!syncFailed) {
        toast.success("VENDOR CAP CONFIRMED", {
          description: "Onchain write confirmed and the vendor registry has been updated.",
        });
      }
    } catch (caught) {
      const message = describeChainError(caught);
      selection.setNotice(message.toUpperCase());
      toast.error("VENDOR CAP FAILED", { description: message });
    } finally {
      setVendorSaving(false);
      write.vendorSubmittingRef.current = false;
    }
  };
  return { setVendorStatusRemote, submitCap };
}
