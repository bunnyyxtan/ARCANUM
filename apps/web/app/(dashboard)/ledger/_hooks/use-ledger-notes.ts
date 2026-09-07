import { useEffect, useState } from "react";

import { trpc } from "@/lib/trpc";
import type { LedgerEntry } from "@/lib/types";

export type LedgerNotes = {
  flagPending: boolean;
  flagNoteOpen: boolean;
  flagNote: string;
  setFlagNote: (value: string) => void;
  noteEditOpen: boolean;
  noteEditValue: string;
  setNoteEditValue: (value: string) => void;
  toggleVendorFlag: (entry: LedgerEntry) => Promise<void>;
  saveNoteEdit: (entry: LedgerEntry) => Promise<void>;
  beginNoteEdit: (note?: string | null) => void;
  cancelFlagNote: () => void;
  cancelNoteEdit: () => void;
};

export function useLedgerNotes(
  selectedId: string | null,
  isConnected: boolean,
  flaggedAddresses: Set<string>,
  showNotice: (message: string) => void,
): LedgerNotes {
  const utils = trpc.useUtils();
  const flagMutation = trpc.vendorFlags.flag.useMutation();
  const unflagMutation = trpc.vendorFlags.unflag.useMutation();
  const updateNoteMutation = trpc.vendorFlags.updateNote.useMutation();
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  const [noteEditValue, setNoteEditValue] = useState("");
  const flagPending =
    flagMutation.isPending || unflagMutation.isPending || updateNoteMutation.isPending;

  const refreshFlags = async (vendorAddress: string) => {
    await Promise.all([
      utils.vendorFlags.list.invalidate(),
      utils.vendorFlags.history.invalidate({ vendorAddress }),
    ]);
  };
  const toggleVendorFlag = async (entry: LedgerEntry) => {
    if (!isConnected || flagPending) return;
    const vendorAddress = entry.counterpartyAddress.toLowerCase();
    const flagged = flaggedAddresses.has(vendorAddress);
    if (!flagged && !flagNoteOpen) {
      setFlagNote("");
      setFlagNoteOpen(true);
      return;
    }
    try {
      if (flagged) {
        await unflagMutation.mutateAsync({ vendorAddress });
        showNotice(`${entry.counterparty} unflagged / review marker cleared`);
      } else {
        const note = flagNote.trim();
        await flagMutation.mutateAsync(note ? { vendorAddress, note } : { vendorAddress });
        setFlagNoteOpen(false);
        setFlagNote("");
        showNotice(`${entry.counterparty} flagged / review marker saved for all approvers`);
      }
      await refreshFlags(vendorAddress);
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : "Vendor flag update failed.");
    }
  };
  const saveNoteEdit = async (entry: LedgerEntry) => {
    if (!isConnected || flagPending) return;
    const vendorAddress = entry.counterpartyAddress.toLowerCase();
    const note = noteEditValue.trim();
    try {
      await updateNoteMutation.mutateAsync({ vendorAddress, note: note || null });
      setNoteEditOpen(false);
      setNoteEditValue("");
      showNotice(
        note
          ? `${entry.counterparty} review note updated / flag preserved`
          : `${entry.counterparty} review note cleared / flag preserved`,
      );
      await refreshFlags(vendorAddress);
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : "Review note update failed.");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset note editors whenever the selected row changes
  useEffect(() => {
    setFlagNoteOpen(false);
    setFlagNote("");
    setNoteEditOpen(false);
    setNoteEditValue("");
  }, [selectedId]);

  return {
    flagPending,
    flagNoteOpen,
    flagNote,
    setFlagNote,
    noteEditOpen,
    noteEditValue,
    setNoteEditValue,
    toggleVendorFlag,
    saveNoteEdit,
    beginNoteEdit: (note) => {
      setNoteEditValue(note ?? "");
      setNoteEditOpen(true);
    },
    cancelFlagNote: () => {
      setFlagNoteOpen(false);
      setFlagNote("");
    },
    cancelNoteEdit: () => {
      setNoteEditOpen(false);
      setNoteEditValue("");
    },
  };
}
