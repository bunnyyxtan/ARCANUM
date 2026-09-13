"use client";

import { useState } from "react";
import { useAccount } from "wagmi";

import { getArcscanTxUrl } from "@/lib/arcscan";
import { useLiveLedger, useVendorFlagHistory, useVendorFlags } from "@/lib/live-data";

import { useLedgerExport } from "./use-ledger-export";
import { useLedgerFilters } from "./use-ledger-filters";
import { useLedgerNotes } from "./use-ledger-notes";
import { useLedgerSelection } from "./use-ledger-selection";

function useLedgerControllerInternal() {
  const [page, setPage] = useState(0);
  const liveLedger = useLiveLedger(page);
  const vendorFlags = useVendorFlags();
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const filters = useLedgerFilters(liveLedger.data, vendorFlags.flaggedAddresses);
  const selection = useLedgerSelection(liveLedger.data);
  const ledgerExport = useLedgerExport(
    filters.visibleRows,
    filters.statusFilter,
    filters.flaggedOnly,
    filters.search,
    {
      page,
      totalCount: liveLedger.pageInfo ? liveLedger.pageInfo.totalCount : liveLedger.data.length,
    },
  );
  const notes = useLedgerNotes(
    selection.selectedId,
    isConnected,
    vendorFlags.flaggedAddresses,
    ledgerExport.showNotice,
  );
  const selectedAddress = selection.selected?.counterpartyAddress.toLowerCase();
  const flagHistory = useVendorFlagHistory(selection.selected?.counterpartyAddress ?? null);
  const selectedFlagged = selectedAddress
    ? vendorFlags.flaggedAddresses.has(selectedAddress)
    : false;

  const openArcscan = (hash: string) => {
    const url = getArcscanTxUrl(hash);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      ledgerExport.showNotice("Transaction hash is not yet available on Arcscan.");
    }
  };

  return {
    liveLedger,
    page,
    setPage,
    vendorFlags,
    isConnected,
    readOnly: !isConnected && !isConnecting && !isReconnecting,
    filters,
    selection,
    ledgerExport,
    notes,
    selectedAddress,
    selectedFlagged,
    flagHistory,
    openArcscan,
  };
}

export type LedgerController = ReturnType<typeof useLedgerControllerInternal>;

export function useLedgerController(): LedgerController {
  return useLedgerControllerInternal();
}
