"use client";

import { describeChainError } from "@/lib/chain-errors";
import {
  type AddVendorFormState,
  guardedWalletControlAbi,
  initialVendorForm,
} from "@/lib/contracts";
import { isEvmAddress, isZeroAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";
import { arcChain } from "@arcanum/shared";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { type Address, keccak256, toBytes } from "viem";
import { allowTrustedMutation, parseUsdcCapInput, vendorCategoryIndex } from "../_lib/helpers";
import type { useVendorSelection } from "./use-vendor-selection";
import type { useVendorWrite } from "./use-vendor-write";

type Selection = ReturnType<typeof useVendorSelection>;
type Write = ReturnType<typeof useVendorWrite>;

export function useVendorForm(isAuthenticated: boolean) {
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<AddVendorFormState>(initialVendorForm);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorTxHash, setVendorTxHash] = useState<string | null>(null);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("");
  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const walletOptions = useMemo(
    () =>
      (walletsQuery.data ?? []).map((wallet) => ({
        address: wallet.address,
        label: wallet.label,
      })),
    [walletsQuery.data],
  );
  useEffect(() => {
    const first = walletOptions[0];
    if (!selectedWalletAddress && first) setSelectedWalletAddress(first.address);
  }, [selectedWalletAddress, walletOptions]);
  const updateVendorForm = (patch: Partial<AddVendorFormState>) => {
    setVendorForm((current) => ({ ...current, ...patch }));
    setVendorError(null);
  };
  const closeAddVendor = () => {
    if (vendorSaving) return;
    setAddVendorOpen(false);
    setVendorError(null);
  };
  const openAddVendor = () => {
    setVendorForm(initialVendorForm);
    setVendorError(null);
    setVendorTxHash(null);
    setAddVendorOpen(true);
  };
  return {
    addVendorOpen,
    closeAddVendor,
    openAddVendor,
    selectedWalletAddress,
    setAddVendorOpen,
    setSelectedWalletAddress,
    setVendorError,
    setVendorForm,
    setVendorSaving,
    setVendorTxHash,
    updateVendorForm,
    vendorError,
    vendorForm,
    vendorSaving,
    vendorTxHash,
    walletOptions,
    walletsLoading: walletsQuery.isLoading,
  };
}

export function useAddVendor(
  form: ReturnType<typeof useVendorForm>,
  selection: Selection,
  write: Write,
) {
  const addVendorRemote = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("vendors.add", event) || write.vendorSubmittingRef.current) return;
    const name = form.vendorForm.name.trim();
    const vendorAddressRaw = form.vendorForm.address.trim();
    const notes = form.vendorForm.notes.trim();
    write.vendorSubmittingRef.current = true;
    form.setVendorSaving(true);
    form.setVendorError(null);
    form.setVendorTxHash(null);
    try {
      if (name.length < 2) throw new Error("Vendor name must be at least 2 characters.");
      if (!isEvmAddress(vendorAddressRaw) || isZeroAddress(vendorAddressRaw)) {
        throw new Error("Vendor add requires a valid non-zero 0x address.");
      }
      const categoryIndex = vendorCategoryIndex(form.vendorForm.category);
      if (categoryIndex < 0) throw new Error("Select a valid vendor category.");
      const perVendorCap = parseUsdcCapInput(form.vendorForm.perVendorCap, "Per-vendor cap");
      const governedWallet = await write.ensureVendorWriteReady();
      const vendorAddress = vendorAddressRaw as Address;
      const hash = await write.writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "addVendor",
        args: [
          vendorAddress,
          categoryIndex,
          perVendorCap,
          keccak256(toBytes(`arcanum-vendor:${name}:${vendorAddress}:${notes}`)),
        ],
        chainId: arcChain.id,
      });
      form.setVendorTxHash(hash);
      const receipt = await write.publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
      const syncFailed = await write.recordVendorState(governedWallet, vendorAddress, {
        name,
        category: form.vendorForm.category,
        kycStatus: form.vendorForm.confidential ? "arcanevm" : "public",
        perVendorCap: Number(perVendorCap) / 1e6,
      });
      await write.refreshVendors();
      form.setVendorForm(initialVendorForm);
      form.setAddVendorOpen(false);
      selection.setNotice(
        syncFailed
          ? `${name.toUpperCase()} WRITE CONFIRMED · REGISTRY NOT SYNCED`
          : `${name.toUpperCase()} WRITE CONFIRMED · REGISTRY UPDATED`,
      );
      toast.success("VENDOR WRITE CONFIRMED", {
        description: "Onchain write confirmed. The record may take a moment to update.",
      });
    } catch (caught) {
      const message = describeChainError(caught);
      form.setVendorError(message);
      toast.error("VENDOR WRITE FAILED", { description: message });
    } finally {
      form.setVendorSaving(false);
      write.vendorSubmittingRef.current = false;
    }
  };
  return { addVendorRemote };
}
