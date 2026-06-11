"use client";

import { useCallback, useEffect, useState } from "react";

export type ArcanumDensity = "comfortable" | "compact";

export const OPEN_COMMAND_PALETTE_EVENT = "arcanum:open-command-palette";
export const CLOSE_ARCANUM_OVERLAYS_EVENT = "arcanum:close-overlays";
export const DENSITY_CHANGED_EVENT = "arcanum:density-changed";
export const PRESENTATION_CHANGED_EVENT = "arcanum:presentation-changed";

const densityKey = "arcanum:density";

function isDensity(value: string | null): value is ArcanumDensity {
  return value === "comfortable" || value === "compact";
}

function currentDensity(): ArcanumDensity {
  if (typeof window === "undefined") {
    return "comfortable";
  }

  const stored = window.localStorage.getItem(densityKey);
  return isDensity(stored) ? stored : "comfortable";
}

function applyDensity(density: ArcanumDensity) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.density = density;
  window.localStorage.setItem(densityKey, density);
  window.dispatchEvent(new CustomEvent(DENSITY_CHANGED_EVENT, { detail: density }));
}

export function setArcanumDensity(density: ArcanumDensity) {
  applyDensity(density);
}

export function toggleArcanumDensity() {
  const next = currentDensity() === "compact" ? "comfortable" : "compact";
  applyDensity(next);
  return next;
}

export function useArcanumDensity() {
  const [density, setDensityState] = useState<ArcanumDensity>("comfortable");

  useEffect(() => {
    const initial = currentDensity();
    setDensityState(initial);
    applyDensity(initial);

    const sync = (event: Event) => {
      const custom = event as CustomEvent<ArcanumDensity>;
      setDensityState(isDensity(custom.detail) ? custom.detail : currentDensity());
    };

    window.addEventListener(DENSITY_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(DENSITY_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setDensity = useCallback((next: ArcanumDensity) => {
    setDensityState(next);
    applyDensity(next);
  }, []);

  const toggleDensity = useCallback(() => {
    const next = toggleArcanumDensity();
    setDensityState(next);
    return next;
  }, []);

  return { density, setDensity, toggleDensity };
}

function presentationFromHash() {
  return typeof window !== "undefined" && window.location.hash === "#present";
}

function applyPresentationMode(active: boolean) {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  document.documentElement.dataset.presentation = active ? "true" : "false";

  const target = active
    ? `${window.location.pathname}${window.location.search}#present`
    : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", target);
  window.dispatchEvent(new CustomEvent(PRESENTATION_CHANGED_EVENT, { detail: active }));
}

export function setPresentationMode(active: boolean) {
  applyPresentationMode(active);
}

export function togglePresentationMode() {
  const next = !presentationFromHash();
  applyPresentationMode(next);
  return next;
}

export function usePresentationMode() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => {
      const next = presentationFromHash();
      setActive(next);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.presentation = next ? "true" : "false";
      }
    };

    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener(PRESENTATION_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener(PRESENTATION_CHANGED_EVENT, sync);
    };
  }, []);

  const setPresentation = useCallback((next: boolean) => {
    setActive(next);
    applyPresentationMode(next);
  }, []);

  const togglePresentation = useCallback(() => {
    const next = !active;
    setActive(next);
    applyPresentationMode(next);
    return next;
  }, [active]);

  return {
    presentationMode: active,
    setPresentationMode: setPresentation,
    togglePresentationMode: togglePresentation,
  };
}

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT));
  }
}

export function closeArcanumOverlays() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLOSE_ARCANUM_OVERLAYS_EVENT));
  }
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}
