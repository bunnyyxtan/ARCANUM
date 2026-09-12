/**
 * Copy text only reports success after the browser resolves the clipboard
 * write. Callers can expose the value itself when this returns false so the
 * user still has a manual copy path.
 */
export async function copyText(value: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}
