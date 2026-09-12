"use client";

import { useVendorFlagHistory } from "@/lib/live-data";
import type { Vendor } from "@/lib/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export function useVendorSelection(vendors: readonly Vendor[]) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("ALLOWLIST / PER-PAYMENT CAPS");
  const [menu, setMenu] = useState<string | null>(null);
  const [capEditing, setCapEditing] = useState(false);
  const [capValue, setCapValue] = useState("");
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  const [noteEditValue, setNoteEditValue] = useState("");
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.("[data-vendor-menu]")) setMenu(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, []);
  const selected = useMemo(
    () => vendors.find((vendor) => vendor.id === selectedId) ?? null,
    [vendors, selectedId],
  );
  const flagHistory = useVendorFlagHistory(selected?.address ?? null);
  const selectVendor = useCallback((id: string) => {
    setSelectedId(id);
    setCapEditing(false);
    setFlagNoteOpen(false);
    setFlagNote("");
    setNoteEditOpen(false);
    setNoteEditValue("");
  }, []);
  return {
    detail: {
      capEditing,
      capValue,
      flagNote,
      flagNoteOpen,
      noteEditOpen,
      noteEditValue,
      setCapEditing,
      setCapValue,
      setFlagNote,
      setFlagNoteOpen,
      setNoteEditOpen,
      setNoteEditValue,
    },
    flagHistory,
    menu,
    notice,
    selectVendor,
    selected,
    selectedId,
    setMenu,
    setNotice,
    setSelectedId,
  };
}
