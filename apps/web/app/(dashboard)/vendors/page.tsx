"use client";

import { arcTestnet } from "@arcanum/shared";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { keccak256, parseUnits, toBytes } from "viem";
import type { Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

import { AddVendorModal } from "@/components/warm/AddVendorModal";
import { ConnectCta } from "@/components/warm/ConnectCta";
import { useWorkspaceMode } from "@/lib/auth-session";
import {
  type AddVendorFormState,
  type VendorCategoryValue,
  guardedWalletControlAbi,
  initialVendorForm,
  vendorCategoryOptions,
} from "@/lib/contracts";
import { isEvmAddress, isSameAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import {
  useLiveVendors,
  useVendorFlagHistory,
  useVendorFlags,
  vendorFlagEventLabel,
} from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { Vendor } from "@/lib/types";

const categories = ["ALL", "API", "COMPUTE", "DATA", "SUBCONTRACTING", "OTHER"] as const;

function categoryLabel(value: VendorCategoryValue) {
  return value === "subcontracting" ? "SUBCONTRACTING" : value.toUpperCase();
}

function vendorCategoryIndex(value: VendorCategoryValue) {
  return vendorCategoryOptions.findIndex((option) => option.value === value);
}

function parseUsdcCapInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative USDC amount with up to 6 decimals.`);
  }
  return parseUnits(trimmed, 6);
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }
  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function StatePill({ blocked }: { blocked: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
        blocked
          ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
          : "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
      }`}
    >
      {blocked ? "BLOCKED" : "APPROVED"}
    </span>
  );
}

export default function VendorsPage() {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
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

  /**
   * Mirror a settled VendorRegistry write into the read model. The server
   * re-reads the registry on-chain, so this can only record what is true.
   * Returns an error message when the sync failed, or null on success.
   */
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
      const message = errorMessage(caught);
      toast.warning("VENDOR WRITE LIVE ON-CHAIN · REGISTRY NOT SYNCED", { description: message });
      return message;
    }
  };

  const [category, setCategory] = useState<string>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("ALLOWLIST / 30 DAY WINDOW");
  const [menu, setMenu] = useState<string | null>(null);

  const [capEditing, setCapEditing] = useState(false);
  const [capValue, setCapValue] = useState("");
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  const [noteEditValue, setNoteEditValue] = useState("");

  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const [vendorForm, setVendorForm] = useState<AddVendorFormState>(initialVendorForm);
  const [vendorError, setVendorError] = useState<string | null>(null);
  const [vendorSaving, setVendorSaving] = useState(false);
  const [vendorTxHash, setVendorTxHash] = useState<string | null>(null);
  const [selectedWalletAddress, setSelectedWalletAddress] = useState("");
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
    if (!selectedWalletAddress && first) {
      setSelectedWalletAddress(first.address);
    }
  }, [selectedWalletAddress, walletOptions]);

  const selectedGovernedWalletAddress = isEvmAddress(selectedWalletAddress)
    ? (selectedWalletAddress as Address)
    : null;

  const governedWalletOwnerQuery = useReadContract({
    abi: guardedWalletControlAbi,
    address: selectedGovernedWalletAddress ?? undefined,
    functionName: "owner",
    chainId: arcTestnet.id,
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
            ? "Could not verify governed wallet owner on Arc Testnet."
            : !address || !isSameAddress(governedWalletOwner, address)
              ? `Only the governed wallet owner (${shortAddress(governedWalletOwner)}) can manage its VendorRegistry.`
              : null;

  const vendorNetworkNotice =
    isConnected && chainId !== arcTestnet.id
      ? "Wallet will be asked to switch to Arc Testnet."
      : null;

  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.("[data-vendor-menu]")) {
        setMenu(null);
      }
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, []);

  const vendors = liveVendors.data;
  const visible = useMemo(
    () =>
      vendors.filter(
        (vendor) =>
          (category === "ALL" || categoryLabel(vendor.category) === category) &&
          `${vendor.name} ${vendor.address}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [vendors, category, query],
  );

  const selected = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedId) ?? null,
    [vendors, selectedId],
  );

  const flagHistory = useVendorFlagHistory(selected?.address ?? null);

  const approvedCount = vendors.filter((vendor) => vendor.trust !== "blocked").length;
  const blockedCount = vendors.filter((vendor) => vendor.trust === "blocked").length;
  const categoryCount = new Set(vendors.map((vendor) => vendor.category)).size;

  const selectVendor = useCallback((id: string) => {
    setSelectedId(id);
    setCapEditing(false);
    setFlagNoteOpen(false);
    setFlagNote("");
    setNoteEditOpen(false);
    setNoteEditValue("");
  }, []);

  const isVendorFlagged = (vendorAddress: string) =>
    vendorFlagsState.flaggedAddresses.has(vendorAddress.toLowerCase());

  const vendorFlagDetail = (vendorAddress: string) =>
    vendorFlagsState.flagDetails.get(vendorAddress.toLowerCase());

  const vendorUnflagDetail = (vendorAddress: string) =>
    vendorFlagsState.unflagDetails.get(vendorAddress.toLowerCase());

  const toggleVendorFlag = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    if (!isVendorFlagged(vendorAddress) && !flagNoteOpen) {
      setFlagNote("");
      setFlagNoteOpen(true);
      return;
    }
    try {
      if (isVendorFlagged(vendorAddress)) {
        await unflagMutation.mutateAsync({ vendorAddress });
        setNotice(`${vendor.name.toUpperCase()} REVIEW FLAG CLEARED`);
      } else {
        const note = flagNote.trim();
        await flagMutation.mutateAsync(note ? { vendorAddress, note } : { vendorAddress });
        setFlagNoteOpen(false);
        setFlagNote("");
        setNotice(`${vendor.name.toUpperCase()} FLAGGED FOR REVIEW`);
      }
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      setNotice(errorMessage(caught).toUpperCase());
    }
  };

  const saveNoteEdit = async (vendor: Vendor) => {
    if (!isConnected || flagToggling) return;
    const vendorAddress = vendor.address.toLowerCase();
    const note = noteEditValue.trim();
    try {
      await updateNoteMutation.mutateAsync({ vendorAddress, note: note ? note : null });
      setNoteEditOpen(false);
      setNoteEditValue("");
      setNotice(
        `${vendor.name.toUpperCase()} REVIEW NOTE ${note ? "UPDATED" : "CLEARED"} · FLAG PRESERVED`,
      );
      await utils.vendorFlags.invalidate();
    } catch (caught) {
      setNotice(errorMessage(caught).toUpperCase());
    }
  };

  const ensureVendorWriteReady = async () => {
    if (vendorWriteDisabledReason) {
      throw new Error(vendorWriteDisabledReason);
    }
    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error("Arc Testnet RPC is unavailable.");
    }
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
    return selectedGovernedWalletAddress;
  };

  const updateVendorForm = (patch: Partial<AddVendorFormState>) => {
    setVendorForm((current) => ({ ...current, ...patch }));
    setVendorError(null);
  };

  const closeAddVendor = () => {
    if (vendorSaving) {
      return;
    }
    setAddVendorOpen(false);
    setVendorError(null);
  };

  const openAddVendor = () => {
    setVendorForm(initialVendorForm);
    setVendorError(null);
    setVendorTxHash(null);
    setAddVendorOpen(true);
  };

  const addVendorRemote = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("vendors.add", event)) {
      return;
    }
    if (vendorSubmittingRef.current) {
      return;
    }

    const name = vendorForm.name.trim();
    const vendorAddressRaw = vendorForm.address.trim();
    const notes = vendorForm.notes.trim();

    vendorSubmittingRef.current = true;
    setVendorSaving(true);
    setVendorError(null);
    setVendorTxHash(null);
    try {
      if (name.length < 2) {
        throw new Error("Vendor name must be at least 2 characters.");
      }
      if (!isEvmAddress(vendorAddressRaw) || isZeroAddress(vendorAddressRaw)) {
        throw new Error("Vendor add requires a valid non-zero 0x address.");
      }
      const categoryIndex = vendorCategoryIndex(vendorForm.category);
      if (categoryIndex < 0) {
        throw new Error("Select a valid vendor category.");
      }

      const perVendorCap = parseUsdcCapInput(vendorForm.perVendorCap, "Per-vendor cap");
      const governedWallet = await ensureVendorWriteReady();
      const vendorAddress = vendorAddressRaw as Address;
      const metadataHash = keccak256(toBytes(`arcanum-vendor:${name}:${vendorAddress}:${notes}`));

      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "addVendor",
        args: [vendorAddress, categoryIndex, perVendorCap, metadataHash],
        chainId: arcTestnet.id,
      });
      setVendorTxHash(hash);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") {
        throw new Error("VendorRegistry transaction reverted.");
      }

      const syncFailed = await recordVendorState(governedWallet, vendorAddress, {
        name,
        category: vendorForm.category,
        kycStatus: vendorForm.confidential ? "arcanevm" : "public",
        perVendorCap: Number(perVendorCap) / 1e6,
      });

      await utils.vendors.list.invalidate();
      await liveVendors.refetch();
      setVendorForm(initialVendorForm);
      setAddVendorOpen(false);
      setNotice(
        syncFailed
          ? `${name.toUpperCase()} WRITE CONFIRMED · REGISTRY NOT SYNCED`
          : `${name.toUpperCase()} WRITE CONFIRMED · REGISTRY UPDATED`,
      );
      toast.success("VENDOR WRITE CONFIRMED", {
        description: "On-chain write confirmed. The record may take a moment to update.",
      });
    } catch (caught) {
      const message = errorMessage(caught);
      setVendorError(message);
      toast.error("VENDOR WRITE FAILED", { description: message });
    } finally {
      setVendorSaving(false);
      vendorSubmittingRef.current = false;
    }
  };

  const setVendorStatusRemote = async (
    action: "block" | "remove",
    vendor: Vendor,
    event: ReactMouseEvent<HTMLElement>,
  ) => {
    if (!allowTrustedMutation(`vendors.${action}`, event)) {
      return;
    }
    if (vendorSubmittingRef.current) {
      return;
    }
    if (!isEvmAddress(vendor.address)) {
      toast.info("Vendor action unavailable", {
        description: "A full vendor address is required for on-chain writes.",
      });
      return;
    }
    if (vendor.walletAddress && !isSameAddress(vendor.walletAddress, selectedWalletAddress)) {
      toast.info("Vendor action unavailable", {
        description: "Select this vendor's governed wallet before writing.",
      });
      return;
    }

    vendorSubmittingRef.current = true;
    setVendorSaving(true);
    try {
      const governedWallet = await ensureVendorWriteReady();
      const functionName = action === "block" ? "blockVendor" : "removeVendor";
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName,
        args: [vendor.address as Address],
        chainId: arcTestnet.id,
      });

      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") {
        throw new Error("VendorRegistry transaction reverted.");
      }

      const syncFailed = await recordVendorState(governedWallet, vendor.address as Address, {
        name: vendor.name,
        category: vendor.category,
        kycStatus: vendor.confidential ? "arcanevm" : "public",
        perVendorCap: 0,
      });

      await utils.vendors.list.invalidate();
      await liveVendors.refetch();
      setNotice(
        `${vendor.name.toUpperCase()} ${action === "block" ? "BLOCKED" : "REMOVED"} · CONFIRMED`,
      );
      if (!syncFailed) {
        toast.success(action === "block" ? "VENDOR BLOCK CONFIRMED" : "VENDOR REMOVE CONFIRMED", {
          description: "On-chain write confirmed and the vendor registry has been updated.",
        });
      }
    } catch (caught) {
      const message = errorMessage(caught);
      toast.error("VENDOR ACTION FAILED", { description: message });
    } finally {
      setVendorSaving(false);
      vendorSubmittingRef.current = false;
    }
  };

  const submitCap = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!selected) {
      return;
    }
    const amount = Number(capValue);
    if (!amount || amount <= 0) {
      setNotice("ENTER A VALID MONTHLY CAP");
      return;
    }
    void (async () => {
      if (!allowTrustedMutation("vendors.updateCap", event)) {
        return;
      }
      if (vendorSubmittingRef.current) {
        return;
      }
      if (!isEvmAddress(selected.address)) {
        toast.info("Cap update unavailable", {
          description: "A full vendor address is required for on-chain updates.",
        });
        return;
      }

      vendorSubmittingRef.current = true;
      setVendorSaving(true);
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
          chainId: arcTestnet.id,
        });
        const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
        if (receipt?.status !== "success") {
          throw new Error("VendorRegistry transaction reverted.");
        }
        const syncFailed = await recordVendorState(governedWallet, selected.address as Address, {
          name: selected.name,
          category: selected.category,
          kycStatus: selected.confidential ? "arcanevm" : "public",
          perVendorCap: Number(perVendorCap) / 1e6,
        });

        await utils.vendors.list.invalidate();
        await liveVendors.refetch();
        setCapEditing(false);
        setNotice(
          `${selected.name.toUpperCase()} CAP REVISED TO $${amount.toLocaleString("en-US")} / MO`,
        );
        if (!syncFailed) {
          toast.success("VENDOR CAP CONFIRMED", {
            description: "On-chain write confirmed and the vendor registry has been updated.",
          });
        }
      } catch (caught) {
        const message = errorMessage(caught);
        setNotice(message.toUpperCase());
        toast.error("VENDOR CAP FAILED", { description: message });
      } finally {
        setVendorSaving(false);
        vendorSubmittingRef.current = false;
      }
    })();
  };

  const loading = liveVendors.isLoading && vendors.length === 0;
  const errored = liveVendors.isError && vendors.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <style>{`
        .vendor-row{animation:vendorIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 80ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .vendor-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes vendorIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.vendor-row{animation:none;transition:none}.vendor-row:hover{transform:none}}
      `}</style>

      <section className="flex flex-col justify-between gap-6 border-b border-[var(--wl-line)] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[var(--wl-signal)]">
            COUNTERPARTIES / ALLOWLIST
          </p>
          <h1 className="font-display mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.015em]">
            Vendors
          </h1>
          <p className="mt-5 max-w-[480px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            The counterparties your agents can pay, with a cap and an accountable name attached.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddVendor}
          className="warm-pill min-h-11 md:min-h-0 w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
        >
          Add vendor <span className="ml-2 text-base leading-none">+</span>
        </button>
      </section>

      <section className="mt-8 grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] max-md:grid-cols-1 max-md:divide-x-0 max-md:divide-y">
        <div className="p-5 sm:p-7 max-md:flex max-md:items-center max-md:justify-between">
          <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-secondary)]">
            APPROVED
          </span>
          <strong className="font-display mt-6 block text-4xl font-semibold tracking-[-.015em] max-md:mt-0">
            {approvedCount}
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)] max-md:hidden">
            COUNTERPARTIES
          </span>
        </div>
        <div className="p-5 sm:p-7 max-md:flex max-md:items-center max-md:justify-between">
          <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-secondary)]">
            CATEGORIES
          </span>
          <strong className="font-display mt-6 block text-4xl font-semibold tracking-[-.015em] max-md:mt-0">
            {categoryCount}
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)] max-md:hidden">
            ACTIVE GROUPS
          </span>
        </div>
        <div className="p-5 sm:p-7 max-md:flex max-md:items-center max-md:justify-between">
          <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-secondary)]">
            BLOCKED
          </span>
          <strong className="font-display mt-6 block text-4xl font-semibold tracking-[-.015em] text-[var(--wl-signal)] max-md:mt-0">
            {blockedCount}
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)] max-md:hidden">
            COUNTERPARTIES
          </span>
        </div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-ink)] pb-4 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              REGISTRY / GOVERNED
            </p>
            <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-.015em]">
              Vendor registry
            </h2>
          </div>
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
            {notice}
          </span>
        </div>

        <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-line)] py-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`min-h-11 md:min-h-0 rounded-full px-3 py-1.5 font-mono text-[9px] tracking-[.13em] transition-colors duration-[220ms] ${
                  category === item
                    ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                    : "border border-[var(--wl-line)] text-[var(--wl-secondary2)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 border-b border-[var(--wl-line)] pb-1 text-[var(--wl-secondary)]">
            <span className="font-mono text-[10px]">⌕</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search vendors"
              className="h-11 w-[170px] bg-transparent text-[12px] outline-none placeholder:text-[var(--wl-mute)] max-md:w-full"
            />
          </label>
        </div>

        <div className="hidden grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] lg:grid">
          <span>Vendor</span>
          <span>Category</span>
          <span>Per-vendor cap</span>
          <span>Approved by</span>
          <span>Trust</span>
          <span>State</span>
        </div>

        <div className="divide-y divide-[var(--wl-line-soft)] border-b border-[var(--wl-line)]">
          {workspace.dataMode === "disconnected" && !workspace.isResolving ? (
            <ConnectCta className="px-4 py-12 text-center" />
          ) : loading ? (
            [0, 1, 2].map((row) => (
              <div
                key={row}
                className="grid gap-3 px-4 py-5 max-md:gap-4 lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr]"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-20 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              </div>
            ))
          ) : errored ? (
            <div className="px-4 py-12 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                VENDOR QUERY FAILED
              </p>
              <button
                type="button"
                onClick={() => void liveVendors.refetch()}
                className="mt-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
              >
                RETRY
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-4 py-12 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">
              NO VENDORS YET · ADD A COUNTERPARTY TO THE ALLOWLIST
            </div>
          ) : (
            visible.map((vendor, index) => {
              const blocked = vendor.trust === "blocked";
              return (
                <div
                  key={vendor.id}
                  onClick={() => {
                    selectVendor(vendor.id);
                    setNotice(`${vendor.name.toUpperCase()} SELECTED · DETAIL RAIL READY`);
                  }}
                  onKeyDown={(event) => event.key === "Enter" && selectVendor(vendor.id)}
                  role="button"
                  tabIndex={0}
                  style={{ "--row": index } as CSSProperties}
                  className={`vendor-row relative grid w-full gap-3 px-4 py-5 text-left max-md:gap-4 lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] lg:items-center ${
                    selected?.id === vendor.id ? "bg-[var(--wl-bg-soft)]" : ""
                  }`}
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-[13px] font-medium">
                      {vendor.name}
                    </strong>
                    <small className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                      {shortAddress(vendor.address)}
                    </small>
                    {isVendorFlagged(vendor.address) && (
                      <span
                        title={
                          vendorFlagDetail(vendor.address)
                            ? `Flagged by ${vendorFlagDetail(vendor.address)?.flaggedBy} · ${vendorFlagDetail(vendor.address)?.flaggedAt}${
                                vendorFlagDetail(vendor.address)?.note
                                  ? ` · ${vendorFlagDetail(vendor.address)?.note}`
                                  : ""
                              }${
                                vendorFlagDetail(vendor.address)?.noteEditedBy
                                  ? ` · Note last edited by ${vendorFlagDetail(vendor.address)?.noteEditedBy} · ${vendorFlagDetail(vendor.address)?.noteEditedAt}`
                                  : ""
                              }`
                            : undefined
                        }
                        className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--wl-signal)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
                      >
                        <span className="shrink-0">⚑ Review</span>
                        {vendorFlagDetail(vendor.address) && (
                          <span className="min-w-0 truncate normal-case tracking-[.08em] text-[var(--wl-secondary)]">
                            by {vendorFlagDetail(vendor.address)?.flaggedByShort} ·{" "}
                            {vendorFlagDetail(vendor.address)?.flaggedAt}
                            {vendorFlagDetail(vendor.address)?.note && (
                              <span className="max-w-[140px] truncate">
                                · “{vendorFlagDetail(vendor.address)?.note}”
                              </span>
                            )}
                            {vendorFlagDetail(vendor.address)?.noteEditedBy && (
                              <span>
                                {" "}
                                · note edited by{" "}
                                {vendorFlagDetail(vendor.address)?.noteEditedByShort} ·{" "}
                                {vendorFlagDetail(vendor.address)?.noteEditedAt}
                              </span>
                            )}
                          </span>
                        )}
                      </span>
                    )}
                    {!isVendorFlagged(vendor.address) && vendorUnflagDetail(vendor.address) && (
                      <span
                        title={`Review flag removed by ${vendorUnflagDetail(vendor.address)?.removedBy} · ${vendorUnflagDetail(vendor.address)?.removedAt}`}
                        className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--wl-line)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
                      >
                        <span className="shrink-0">Unflagged</span>
                        <span className="min-w-0 truncate normal-case tracking-[.08em]">
                          by {vendorUnflagDetail(vendor.address)?.removedByShort} ·{" "}
                          {vendorUnflagDetail(vendor.address)?.removedAt}
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="w-fit rounded-full border border-[var(--wl-line)] px-2.5 py-1 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)]">
                    <small className="mr-2 text-[8px] text-[var(--wl-mute)] md:hidden">
                      CATEGORY
                    </small>
                    {categoryLabel(vendor.category)}
                  </span>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--wl-body)]">
                    <small className="mr-2 text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                      CAP
                    </small>
                    {vendor.confidential ? "capped" : "no cap"}
                  </span>
                  <span>
                    <small className="mr-2 font-mono text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                      APPROVED BY
                    </small>
                    <span className="block text-[12px]">
                      {vendor.approvedBy[0] ? shortAddress(vendor.approvedBy[0]) : "-"}
                    </span>
                    <small className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                      {vendor.createdAt ?? "N/A"}
                    </small>
                  </span>
                  <span className="font-mono text-[11px] uppercase tracking-[.1em]">
                    <small className="mr-2 text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                      TRUST
                    </small>
                    {vendor.trust}
                  </span>
                  <span className="flex items-center justify-between gap-3">
                    <StatePill blocked={blocked} />
                    <span
                      data-vendor-menu
                      className="relative"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Actions for ${vendor.name}`}
                        aria-expanded={menu === vendor.id}
                        onClick={() => setMenu(menu === vendor.id ? null : vendor.id)}
                        className="flex h-11 w-11 items-center justify-center font-mono text-[16px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
                      >
                        ⋯
                      </button>
                      {menu === vendor.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-8 z-20 w-[190px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-1 shadow-[8px_10px_0_var(--wl-line-faint)]"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(vendor.address);
                              setNotice(`${vendor.name.toUpperCase()} ADDRESS COPIED`);
                              setMenu(null);
                            }}
                            className="block w-full px-3 py-2 text-left font-mono text-[9px] hover:bg-[var(--wl-bg-soft)]"
                          >
                            COPY ADDRESS
                          </button>
                          <button
                            type="button"
                            disabled={vendorSaving || blocked}
                            onClick={(event) => {
                              setMenu(null);
                              void setVendorStatusRemote("block", vendor, event);
                            }}
                            className="block w-full px-3 py-2 text-left font-mono text-[9px] text-[var(--wl-signal)] hover:bg-[var(--wl-bg-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            BLOCK VENDOR
                          </button>
                          <button
                            type="button"
                            disabled={vendorSaving}
                            onClick={(event) => {
                              setMenu(null);
                              void setVendorStatusRemote("remove", vendor, event);
                            }}
                            className="block w-full px-3 py-2 text-left font-mono text-[9px] text-[var(--wl-signal)] hover:bg-[var(--wl-bg-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            REMOVE VENDOR
                          </button>
                        </div>
                      )}
                    </span>
                  </span>
                </div>
              );
            })
          )}

          <button
            type="button"
            onClick={openAddVendor}
            className="flex min-h-14 w-full items-center gap-3 border border-dashed border-[var(--wl-line)] px-4 py-5 text-left text-[var(--wl-secondary)] transition-colors duration-[220ms] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
          >
            <span className="font-mono text-[13px]">+</span>
            <span className="font-mono text-[10px] uppercase tracking-[.14em]">
              Add vendor to allowlist
            </span>
            <span className="ml-auto font-mono text-[9px]">SIGNED APPROVAL REQUIRED</span>
          </button>
        </div>
      </section>

      {selected && (
        <aside className="mt-8 grid gap-7 border-t-2 border-[var(--wl-ink)] bg-[var(--wl-bg-soft)] p-6 sm:p-8 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  SELECTED / COUNTERPARTY
                </p>
                <h3 className="font-display mt-4 text-3xl font-semibold tracking-[-.015em]">
                  {selected.name}
                </h3>
                <p className="mt-2 font-mono text-[10px] text-[var(--wl-secondary)]">
                  {shortAddress(selected.address)} · {categoryLabel(selected.category)}
                </p>
              </div>
              <span className="flex flex-col items-end gap-2">
                <StatePill blocked={selected.trust === "blocked"} />
                {isVendorFlagged(selected.address) && (
                  <span
                    title={
                      vendorFlagDetail(selected.address)
                        ? `Flagged by ${vendorFlagDetail(selected.address)?.flaggedBy} · ${vendorFlagDetail(selected.address)?.flaggedAt}${
                            vendorFlagDetail(selected.address)?.note
                              ? ` · ${vendorFlagDetail(selected.address)?.note}`
                              : ""
                          }${
                            vendorFlagDetail(selected.address)?.noteEditedBy
                              ? ` · Note last edited by ${vendorFlagDetail(selected.address)?.noteEditedBy} · ${vendorFlagDetail(selected.address)?.noteEditedAt}`
                              : ""
                          }`
                        : undefined
                    }
                    className="rounded-full border border-[var(--wl-signal)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
                  >
                    ⚑ Review
                    {vendorFlagDetail(selected.address) && (
                      <span className="block text-[8px] normal-case tracking-[.08em] text-[var(--wl-secondary)]">
                        by {vendorFlagDetail(selected.address)?.flaggedByShort} ·{" "}
                        {vendorFlagDetail(selected.address)?.flaggedAt}
                        {vendorFlagDetail(selected.address)?.note && (
                          <span className="block max-w-[180px] truncate">
                            “{vendorFlagDetail(selected.address)?.note}”
                          </span>
                        )}
                        {vendorFlagDetail(selected.address)?.noteEditedBy && (
                          <span className="block">
                            note edited by {vendorFlagDetail(selected.address)?.noteEditedByShort} ·{" "}
                            {vendorFlagDetail(selected.address)?.noteEditedAt}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                )}
                {!isVendorFlagged(selected.address) && vendorUnflagDetail(selected.address) && (
                  <span
                    title={`Review flag removed by ${vendorUnflagDetail(selected.address)?.removedBy} · ${vendorUnflagDetail(selected.address)?.removedAt}`}
                    className="rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
                  >
                    Unflagged
                    <span className="block text-[8px] normal-case tracking-[.08em]">
                      by {vendorUnflagDetail(selected.address)?.removedByShort} ·{" "}
                      {vendorUnflagDetail(selected.address)?.removedAt}
                    </span>
                  </span>
                )}
              </span>
            </div>

            <div className="mt-10">
              <div className="flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-secondary)]">
                <span>PER-VENDOR CAP</span>
                <span>{selected.confidential ? "SET" : "NONE"}</span>
              </div>
              <div className="mt-3 flex justify-between font-mono text-[9px] text-[var(--wl-mute)]">
                <span>Last used {selected.lastUsed}</span>
                <span>Added {selected.createdAt ?? "N/A"}</span>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  setCapValue("");
                  setCapEditing((value) => !value);
                }}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em]"
              >
                Update cap
              </button>
              <button
                type="button"
                disabled={vendorSaving || selected.trust === "blocked"}
                onClick={(event) => void setVendorStatusRemote("block", selected, event)}
                className="rounded-full border border-[var(--wl-signal)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)] transition-transform duration-[220ms] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Block vendor
              </button>
              <button
                type="button"
                disabled={flagToggling || !isConnected}
                title={!isConnected ? "Connect wallet first." : undefined}
                onClick={() => void toggleVendorFlag(selected)}
                className="rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isVendorFlagged(selected.address)
                  ? "Unflag review"
                  : flagNoteOpen
                    ? "Save flag"
                    : "Flag for review"}
              </button>
              {isVendorFlagged(selected.address) && (
                <button
                  type="button"
                  disabled={flagToggling || !isConnected}
                  title={!isConnected ? "Connect wallet first." : undefined}
                  onClick={() => {
                    if (noteEditOpen) {
                      void saveNoteEdit(selected);
                    } else {
                      setNoteEditValue(vendorFlagDetail(selected.address)?.note ?? "");
                      setNoteEditOpen(true);
                    }
                  }}
                  className="rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {noteEditOpen
                    ? "Save note"
                    : vendorFlagDetail(selected.address)?.note
                      ? "Edit note"
                      : "Add note"}
                </button>
              )}
              {isVendorFlagged(selected.address) && noteEditOpen && (
                <div className="w-full">
                  <input
                    autoFocus
                    value={noteEditValue}
                    maxLength={200}
                    onChange={(event) => setNoteEditValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveNoteEdit(selected);
                    }}
                    placeholder="Review note (leave empty to clear it)"
                    className="w-full max-w-[360px] border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setNoteEditOpen(false);
                      setNoteEditValue("");
                    }}
                    className="mt-1.5 block font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!isVendorFlagged(selected.address) && flagNoteOpen && (
                <div className="w-full">
                  <input
                    autoFocus
                    value={flagNote}
                    maxLength={200}
                    onChange={(event) => setFlagNote(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void toggleVendorFlag(selected);
                    }}
                    placeholder="Optional note: why flag this vendor?"
                    className="w-full max-w-[360px] border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFlagNoteOpen(false);
                      setFlagNote("");
                    }}
                    className="mt-1.5 block font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                  >
                    Cancel
                  </button>
                </div>
              )}
              {!isConnected && (
                <p className="w-full font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                  CONNECT WALLET FIRST
                </p>
              )}
            </div>

            {capEditing && (
              <div className="mt-4 border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] p-4">
                <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  REVISE MONTHLY CAP / {selected.name.toUpperCase()}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[13px] text-[var(--wl-secondary)]">$</span>
                  <input
                    autoFocus
                    inputMode="numeric"
                    value={capValue}
                    onChange={(event) => setCapValue(event.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="2500"
                    className="w-[110px] border-b border-[var(--wl-faint)] bg-transparent py-1 font-mono text-[13px] outline-none focus:border-[var(--wl-signal)]"
                  />
                  <span className="font-mono text-[10px] text-[var(--wl-mute)]">/ MO · USDC</span>
                  <button
                    type="button"
                    disabled={vendorSaving}
                    onClick={submitCap}
                    className="warm-pill ml-2 rounded-full bg-[var(--wl-signal)] px-4 py-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {vendorSaving ? "SIGNING…" : "SIGN & APPLY"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCapEditing(false)}
                    className="font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                  >
                    CANCEL
                  </button>
                </div>
                <p className="mt-2 font-mono text-[8.5px] tracking-[.08em] text-[var(--wl-mute)]">
                  WRITES addVendor WITH THE REVISED PER-VENDOR CAP · TAKES EFFECT NEXT SETTLEMENT
                  WINDOW
                </p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-4">
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
                Counterparty detail
              </span>
              <span className="font-mono text-[9px] text-[var(--wl-mute)]">
                {selected.trust.toUpperCase()}
              </span>
            </div>
            <div className="divide-y divide-[var(--wl-line)]">
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-[12px] text-[var(--wl-body)]">Full address</span>
                <span className="font-mono text-[11px] tabular-nums">{selected.address}</span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-[12px] text-[var(--wl-body)]">Approved by</span>
                <span className="font-mono text-[11px]">
                  {selected.approvedBy.map((by) => shortAddress(by)).join(", ") || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <span className="text-[12px] text-[var(--wl-body)]">Confidential</span>
                <span className="font-mono text-[11px]">
                  {selected.confidential ? "YES" : "NO"}
                </span>
              </div>
            </div>
            <p className="mt-8 max-w-[390px] font-mono text-[9px] leading-[1.6] tracking-[.08em] text-[var(--wl-mute)]">
              Every payment is evaluated against this cap before it reaches the governed wallet.
            </p>

            <div className="mt-10">
              <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-4">
                <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
                  Review history
                </span>
                <span className="font-mono text-[9px] text-[var(--wl-mute)]">
                  {flagHistory.entries.length > 0
                    ? `${flagHistory.entries.length} EVENTS`
                    : "AUDIT TRAIL"}
                </span>
              </div>
              {flagHistory.isLoading ? (
                <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                  LOADING REVIEW TRAIL…
                </p>
              ) : flagHistory.isError ? (
                <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)]">
                  REVIEW TRAIL UNAVAILABLE · RETRY SHORTLY
                </p>
              ) : flagHistory.entries.length === 0 ? (
                <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                  NO REVIEW EVENTS RECORDED FOR THIS VENDOR
                </p>
              ) : (
                <ol className="divide-y divide-[var(--wl-line)]">
                  {flagHistory.entries.map((entry) => (
                    <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span
                          className={`block text-[11px] ${
                            entry.eventType === "unflagged"
                              ? "text-[var(--wl-secondary2)]"
                              : "text-[var(--wl-body)]"
                          }`}
                        >
                          {entry.eventType === "flagged" && (
                            <span className="mr-1.5 text-[var(--wl-signal)]">⚑</span>
                          )}
                          {vendorFlagEventLabel(entry.eventType)}
                        </span>
                        {entry.note && (
                          <span className="mt-1 block truncate font-mono text-[9px] text-[var(--wl-secondary)]">
                            “{entry.note}”
                          </span>
                        )}
                        {!entry.note && entry.eventType === "note_updated" && (
                          <span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                            note cleared
                          </span>
                        )}
                      </span>
                      <span
                        title={entry.actor}
                        className="shrink-0 text-right font-mono text-[9px] text-[var(--wl-mute)]"
                      >
                        {entry.actorShort}
                        <span className="block">{entry.at}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </aside>
      )}

      {addVendorOpen && (
        <AddVendorModal
          error={vendorError}
          form={vendorForm}
          networkNotice={vendorNetworkNotice}
          onAdd={addVendorRemote}
          onChange={updateVendorForm}
          onClose={closeAddVendor}
          onWalletChange={setSelectedWalletAddress}
          saving={vendorSaving || switchPending || writePending}
          selectedWalletAddress={selectedWalletAddress}
          txHash={vendorTxHash}
          walletOptions={walletOptions}
          writeDisabledReason={vendorWriteDisabledReason}
        />
      )}
    </div>
  );
}
