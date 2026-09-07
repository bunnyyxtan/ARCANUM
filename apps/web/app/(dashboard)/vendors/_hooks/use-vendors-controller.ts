"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { type Address, keccak256, toBytes } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { useWorkspaceMode } from "@/lib/auth-session";
import { describeChainError, errorText } from "@/lib/chain-errors";
import {
  type AddVendorFormState,
  guardedWalletControlAbi,
  initialVendorForm,
} from "@/lib/contracts";
import { isEvmAddress, isSameAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import { useLiveVendors, useVendorFlagHistory, useVendorFlags } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { Vendor } from "@/lib/types";

import {
  allowTrustedMutation,
  categoryLabel,
  parseUsdcCapInput,
  vendorCategoryIndex,
} from "../_lib/helpers";

function useRegistryStateInternal() {
  const [category, setCategory] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("ALLOWLIST / 30 DAY WINDOW");
  const [menu, setMenu] = useState<string | null>(null);
  return {
    category,
    setCategory,
    query,
    setQuery,
    selectedId,
    setSelectedId,
    notice,
    setNotice,
    menu,
    setMenu,
  };
}

type RegistryState = ReturnType<typeof useRegistryStateInternal>;

function useRegistryState(): RegistryState {
  return useRegistryStateInternal();
}

function useDetailStateInternal() {
  const [capEditing, setCapEditing] = useState(false);
  const [capValue, setCapValue] = useState("");
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  const [noteEditValue, setNoteEditValue] = useState("");
  return {
    capEditing,
    setCapEditing,
    capValue,
    setCapValue,
    flagNoteOpen,
    setFlagNoteOpen,
    flagNote,
    setFlagNote,
    noteEditOpen,
    setNoteEditOpen,
    noteEditValue,
    setNoteEditValue,
  };
}

type DetailState = ReturnType<typeof useDetailStateInternal>;

function useDetailState(): DetailState {
  return useDetailStateInternal();
}

function useVendorFormStateInternal() {
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<AddVendorFormState>(initialVendorForm);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorTxHash, setVendorTxHash] = useState<string | null>(null);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("");
  return {
    addVendorOpen,
    setAddVendorOpen,
    vendorForm,
    setVendorForm,
    vendorError,
    setVendorError,
    vendorSaving,
    setVendorSaving,
    vendorTxHash,
    setVendorTxHash,
    selectedWalletAddress,
    setSelectedWalletAddress,
  };
}

type VendorFormState = ReturnType<typeof useVendorFormStateInternal>;

function useVendorFormState(): VendorFormState {
  return useVendorFormStateInternal();
}

function useVendorsControllerInternal() {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const liveVendors = useLiveVendors();
  const vendorFlagsState = useVendorFlags();
  const flagMutation = trpc.vendorFlags.flag.useMutation();
  const unflagMutation = trpc.vendorFlags.unflag.useMutation();
  const updateNoteMutation = trpc.vendorFlags.updateNote.useMutation();
  const recordVendorStateMutation = trpc.vendors.recordOnChainState.useMutation();
  const flagToggling =
    flagMutation.isPending || unflagMutation.isPending || updateNoteMutation.isPending;
  const registry = useRegistryState();
  const detail = useDetailState();
  const form = useVendorFormState();
  const vendorSubmittingRef = useRef(false);

  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled: workspace.isAuthenticated,
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
    if (!form.selectedWalletAddress && first) {
      form.setSelectedWalletAddress(first.address);
    }
  }, [form.selectedWalletAddress, form.setSelectedWalletAddress, walletOptions]);

  const selectedGovernedWalletAddress = isEvmAddress(form.selectedWalletAddress)
    ? (form.selectedWalletAddress as Address)
    : null;
  const governedWalletOwnerQuery = useReadContract({
    abi: guardedWalletControlAbi,
    address: selectedGovernedWalletAddress ?? undefined,
    functionName: "owner",
    chainId: arcChain.id,
    query: { enabled: Boolean(selectedGovernedWalletAddress) },
  });
  const governedWalletOwner =
    typeof governedWalletOwnerQuery.data === "string" ? governedWalletOwnerQuery.data : null;
  const vendorWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsQuery.isLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage VendorRegistry."
        : governedWalletOwnerQuery.isLoading
          ? "Verifying governed wallet owner."
          : !governedWalletOwner
            ? `Could not verify governed wallet owner on ${ARC_NETWORK_NAME}.`
            : !address || !isSameAddress(governedWalletOwner, address)
              ? `Only the governed wallet owner (${shortAddress(governedWalletOwner)}) can manage its VendorRegistry.`
              : null;
  const vendorNetworkNotice =
    isConnected && chainId !== arcChain.id
      ? `Wallet will be asked to switch to ${ARC_NETWORK_NAME}.`
      : null;

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && registry.setMenu(null);
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.("[data-vendor-menu]")) {
        registry.setMenu(null);
      }
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, [registry.setMenu]);

  const vendors = liveVendors.data;
  const visible = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          (registry.category === "ALL" || categoryLabel(vendor.category) === registry.category) &&
          `${vendor.name} ${vendor.address}`.toLowerCase().includes(registry.query.toLowerCase()),
      ),
    [vendors, registry.category, registry.query],
  );
  const selected = useMemo(
    () => vendors.find((vendor) => vendor.id === registry.selectedId) ?? null,
    [vendors, registry.selectedId],
  );
  const flagHistory = useVendorFlagHistory(selected?.address ?? null);

  const selectVendor = useCallback(
    (id: string) => {
      registry.setSelectedId(id);
      detail.setCapEditing(false);
      detail.setFlagNoteOpen(false);
      detail.setFlagNote("");
      detail.setNoteEditOpen(false);
      detail.setNoteEditValue("");
    },
    [
      registry.setSelectedId,
      detail.setCapEditing,
      detail.setFlagNoteOpen,
      detail.setFlagNote,
      detail.setNoteEditOpen,
      detail.setNoteEditValue,
    ],
  );
  const isVendorFlagged = (vendorAddress: string) =>
    vendorFlagsState.flaggedAddresses.has(vendorAddress.toLowerCase());
  const vendorFlagDetail = (vendorAddress: string) =>
    vendorFlagsState.flagDetails.get(vendorAddress.toLowerCase());
  const vendorUnflagDetail = (vendorAddress: string) =>
    vendorFlagsState.unflagDetails.get(vendorAddress.toLowerCase());

  const toggleVendorFlag = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    if (!isVendorFlagged(vendorAddress) && !detail.flagNoteOpen) {
      detail.setFlagNote("");
      detail.setFlagNoteOpen(true);
      return;
    }
    try {
      if (isVendorFlagged(vendorAddress)) {
        await unflagMutation.mutateAsync({ vendorAddress });
        registry.setNotice(`${vendor.name.toUpperCase()} REVIEW FLAG CLEARED`);
      } else {
        const note = detail.flagNote.trim();
        await flagMutation.mutateAsync(note ? { vendorAddress, note } : { vendorAddress });
        detail.setFlagNoteOpen(false);
        detail.setFlagNote("");
        registry.setNotice(`${vendor.name.toUpperCase()} FLAGGED FOR REVIEW`);
      }
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      registry.setNotice(describeChainError(caught).toUpperCase());
    }
  };

  const saveNoteEdit = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    const note = detail.noteEditValue.trim();
    try {
      await updateNoteMutation.mutateAsync({ vendorAddress, note: note || null });
      detail.setNoteEditOpen(false);
      detail.setNoteEditValue("");
      registry.setNotice(
        `${vendor.name.toUpperCase()} REVIEW NOTE ${note ? "UPDATED" : "CLEARED"} · FLAG PRESERVED`,
      );
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      registry.setNotice(describeChainError(caught).toUpperCase());
    }
  };

  const recordVendorState = async (
    governedWallet: Address,
    vendorAddress: Address,
    details: {
      name: string;
      category: string;
      kycStatus: "public" | "arcanevm";
      perVendorCap: number;
    },
  ) => {
    try {
      await recordVendorStateMutation.mutateAsync({
        walletAddress: governedWallet,
        vendorAddress,
        ...details,
      });
      return null;
    } catch (caught) {
      const message = errorText(caught);
      toast.warning("VENDOR WRITE LIVE ONCHAIN · REGISTRY NOT SYNCED", { description: message });
      return message;
    }
  };
  const ensureVendorWriteReady = async () => {
    if (vendorWriteDisabledReason) throw new Error(vendorWriteDisabledReason);
    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error(`${ARC_NETWORK_NAME} RPC is unavailable.`);
    }
    if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
    return selectedGovernedWalletAddress;
  };
  const refreshVendors = async () => {
    await utils.vendors.list.invalidate();
    await liveVendors.refetch();
  };
  const retryVendors = async () => {
    try {
      await liveVendors.refetch();
    } catch (caught) {
      registry.setNotice(errorText(caught).toUpperCase());
    }
  };
  const updateVendorForm = (patch: Partial<AddVendorFormState>) => {
    form.setVendorForm((current) => ({ ...current, ...patch }));
    form.setVendorError(null);
  };
  const closeAddVendor = () => {
    if (form.vendorSaving) return;
    form.setAddVendorOpen(false);
    form.setVendorError(null);
  };
  const openAddVendor = () => {
    form.setVendorForm(initialVendorForm);
    form.setVendorError(null);
    form.setVendorTxHash(null);
    form.setAddVendorOpen(true);
  };

  const addVendorRemote = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("vendors.add", event) || vendorSubmittingRef.current) return;
    const name = form.vendorForm.name.trim();
    const vendorAddressRaw = form.vendorForm.address.trim();
    const notes = form.vendorForm.notes.trim();
    vendorSubmittingRef.current = true;
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
      const governedWallet = await ensureVendorWriteReady();
      const vendorAddress = vendorAddressRaw as Address;
      const metadataHash = keccak256(toBytes(`arcanum-vendor:${name}:${vendorAddress}:${notes}`));
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "addVendor",
        args: [vendorAddress, categoryIndex, perVendorCap, metadataHash],
        chainId: arcChain.id,
      });
      form.setVendorTxHash(hash);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
      const syncFailed = await recordVendorState(governedWallet, vendorAddress, {
        name,
        category: form.vendorForm.category,
        kycStatus: form.vendorForm.confidential ? "arcanevm" : "public",
        perVendorCap: Number(perVendorCap) / 1e6,
      });
      await refreshVendors();
      form.setVendorForm(initialVendorForm);
      form.setAddVendorOpen(false);
      registry.setNotice(
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
      vendorSubmittingRef.current = false;
    }
  };

  const setVendorStatusRemote = async (
    action: "block" | "remove",
    vendor: Vendor,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!allowTrustedMutation(`vendors.${action}`, event) || vendorSubmittingRef.current) return;
    if (!isEvmAddress(vendor.address)) {
      toast.info("Vendor action unavailable", {
        description: "A full vendor address is required for onchain writes.",
      });
      return;
    }
    if (vendor.walletAddress && !isSameAddress(vendor.walletAddress, form.selectedWalletAddress)) {
      toast.info("Vendor action unavailable", {
        description: "Select this vendor's governed wallet before writing.",
      });
      return;
    }
    vendorSubmittingRef.current = true;
    form.setVendorSaving(true);
    try {
      const governedWallet = await ensureVendorWriteReady();
      const functionName = action === "block" ? "blockVendor" : "removeVendor";
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName,
        args: [vendor.address as Address],
        chainId: arcChain.id,
      });
      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
      const syncFailed = await recordVendorState(governedWallet, vendor.address as Address, {
        name: vendor.name,
        category: vendor.category,
        kycStatus: vendor.confidential ? "arcanevm" : "public",
        perVendorCap: 0,
      });
      await refreshVendors();
      registry.setNotice(
        `${vendor.name.toUpperCase()} ${action === "block" ? "BLOCKED" : "REMOVED"} · CONFIRMED`,
      );
      if (!syncFailed) {
        toast.success(action === "block" ? "VENDOR BLOCK CONFIRMED" : "VENDOR REMOVE CONFIRMED", {
          description: "Onchain write confirmed and the vendor registry has been updated.",
        });
      }
    } catch (caught) {
      const message = describeChainError(caught);
      toast.error("VENDOR ACTION FAILED", { description: message });
    } finally {
      form.setVendorSaving(false);
      vendorSubmittingRef.current = false;
    }
  };

  const submitCap = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!selected) return;
    const amount = Number(detail.capValue);
    if (!amount || amount <= 0) {
      registry.setNotice("ENTER A VALID MONTHLY CAP");
      return;
    }
    void (async () => {
      if (!allowTrustedMutation("vendors.updateCap", event) || vendorSubmittingRef.current) return;
      if (!isEvmAddress(selected.address)) {
        toast.info("Cap update unavailable", {
          description: "A full vendor address is required for onchain updates.",
        });
        return;
      }
      vendorSubmittingRef.current = true;
      form.setVendorSaving(true);
      try {
        const categoryIndex = vendorCategoryIndex(selected.category);
        const perVendorCap = parseUsdcCapInput(String(amount), "Per-vendor cap");
        const governedWallet = await ensureVendorWriteReady();
        const metadataHash = keccak256(
          toBytes(`arcanum-vendor:${selected.name}:${selected.address}:cap-update`),
        );
        const hash = await writeContractAsync({
          address: governedWallet,
          abi: guardedWalletControlAbi,
          functionName: "addVendor",
          args: [selected.address as Address, categoryIndex, perVendorCap, metadataHash],
          chainId: arcChain.id,
        });
        const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
        if (receipt?.status !== "success") throw new Error("VendorRegistry transaction reverted.");
        const syncFailed = await recordVendorState(governedWallet, selected.address as Address, {
          name: selected.name,
          category: selected.category,
          kycStatus: selected.confidential ? "arcanevm" : "public",
          perVendorCap: Number(perVendorCap) / 1e6,
        });
        await refreshVendors();
        detail.setCapEditing(false);
        registry.setNotice(
          `${selected.name.toUpperCase()} CAP REVISED TO $${amount.toLocaleString("en-US")} / MO`,
        );
        if (!syncFailed) {
          toast.success("VENDOR CAP CONFIRMED", {
            description: "Onchain write confirmed and the vendor registry has been updated.",
          });
        }
      } catch (caught) {
        const message = describeChainError(caught);
        registry.setNotice(message.toUpperCase());
        toast.error("VENDOR CAP FAILED", { description: message });
      } finally {
        form.setVendorSaving(false);
        vendorSubmittingRef.current = false;
      }
    })();
  };

  return {
    workspace,
    liveVendors,
    vendors,
    visible,
    selected,
    flagHistory,
    approvedCount: vendors.filter((vendor) => vendor.trust !== "blocked").length,
    blockedCount: vendors.filter((vendor) => vendor.trust === "blocked").length,
    categoryCount: new Set(vendors.map((vendor) => vendor.category)).size,
    loading: liveVendors.isLoading && vendors.length === 0,
    errored: liveVendors.isError && vendors.length === 0,
    isConnected,
    flagToggling,
    switchPending,
    writePending,
    walletOptions,
    vendorWriteDisabledReason,
    vendorNetworkNotice,
    registry,
    detail,
    form,
    selectVendor,
    isVendorFlagged,
    vendorFlagDetail,
    vendorUnflagDetail,
    toggleVendorFlag,
    saveNoteEdit,
    updateVendorForm,
    closeAddVendor,
    openAddVendor,
    addVendorRemote,
    setVendorStatusRemote,
    submitCap,
    retryVendors,
  };
}

export type VendorsController = ReturnType<typeof useVendorsControllerInternal>;

export function useVendorsController(): VendorsController {
  return useVendorsControllerInternal();
}
