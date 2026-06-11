export const keyboardShortcuts = [
  { section: "NAVIGATION", keys: "G O", label: "Go to Overview" },
  { section: "NAVIGATION", keys: "G A", label: "Go to Agents" },
  { section: "NAVIGATION", keys: "G V", label: "Go to Vendors" },
  { section: "NAVIGATION", keys: "G L", label: "Go to Ledger" },
  { section: "NAVIGATION", keys: "G E", label: "Go to Escalations" },
  { section: "NAVIGATION", keys: "G N", label: "Go to Anomalies" },
  { section: "NAVIGATION", keys: "G S", label: "Go to Settings" },
  { section: "ACTIONS", keys: "CTRL K", label: "Open command palette" },
  { section: "ACTIONS", keys: "?", label: "Open shortcut help" },
  { section: "ACTIONS", keys: "CTRL .", label: "Toggle presentation mode" },
  { section: "ACTIONS", keys: "ESC", label: "Close overlays" },
] as const;

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable ||
    target.getAttribute("role") === "textbox"
  );
}
