"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

const focusableSelector = [
  'a[href]:not([aria-hidden="true"])',
  'area[href]:not([aria-hidden="true"])',
  'button:not([disabled]):not([aria-hidden="true"])',
  'input:not([disabled]):not([type="hidden"]):not([aria-hidden="true"])',
  'select:not([disabled]):not([aria-hidden="true"])',
  'textarea:not([disabled]):not([aria-hidden="true"])',
  '[contenteditable="true"]:not([aria-hidden="true"])',
  '[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])',
].join(",");

type DialogEntry = {
  root: HTMLElement;
  restoreTarget: HTMLElement | null;
};

// A stack, rather than one global key handler per dialog, means a dialog
// opened above another dialog owns Escape and Tab until it closes.
const openDialogs: DialogEntry[] = [];
let lockedBodyOverflow: string | null = null;

function isVisible(element: HTMLElement) {
  if (element.hidden || element.closest("[hidden], [inert], [aria-hidden='true']")) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden";
}

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hasAttribute("data-dialog-backdrop") && isVisible(element),
  );
}

function restoreFocus(target: HTMLElement | null) {
  if (target?.isConnected) {
    target.focus({ preventScroll: true });
  }
}

export function useDialogFocus(
  open: boolean,
  onClose: () => void,
): RefObject<HTMLDivElement | null>;
export function useDialogFocus<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null>;
export function useDialogFocus<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
): RefObject<T | null> {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open || !dialogRef.current) {
      return;
    }

    const root = dialogRef.current;
    const activeElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const entry: DialogEntry = {
      root,
      restoreTarget: activeElement && !root.contains(activeElement) ? activeElement : null,
    };
    if (openDialogs.length === 0) {
      lockedBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    openDialogs.push(entry);

    const focusInitialControl = () => {
      if (openDialogs.at(-1)?.root !== root) {
        return;
      }
      const preferred = root.querySelector<HTMLElement>("[data-dialog-autofocus], [autofocus]");
      const initial =
        (preferred && !preferred.hasAttribute("data-dialog-backdrop") && isVisible(preferred)
          ? preferred
          : focusableElements(root)[0]) ?? null;
      initial?.focus({ preventScroll: true });
    };

    // The effect runs after the dialog has mounted, but deferring one task also
    // lets browser autofocus settle before the shared manager makes its choice.
    const focusTimer = window.setTimeout(focusInitialControl, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (openDialogs.at(-1)?.root !== root) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const controls = focusableElements(root);
      if (controls.length === 0) {
        return;
      }
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {
        return;
      }
      const current = document.activeElement;

      if (!root.contains(current)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (openDialogs.at(-1)?.root !== root || root.contains(event.target as Node)) {
        return;
      }
      focusInitialControl();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const index = openDialogs.indexOf(entry);
      if (index !== -1) {
        openDialogs.splice(index, 1);
      }
      // A nested dialog may still own focus while this one closes. Let the
      // topmost manager finish before restoring the underlying trigger.
      if (openDialogs.length === 0) {
        if (lockedBodyOverflow !== null) {
          document.body.style.overflow = lockedBodyOverflow;
          lockedBodyOverflow = null;
        }
        restoreFocus(entry.restoreTarget);
      }
    };
  }, [open]);

  return dialogRef;
}
