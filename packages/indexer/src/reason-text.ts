import { type Hex, hexToString, isHex } from "viem";

function hasControlCharacters(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if ((code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * The free-form `bytes reason` an agent attaches to a transfer, as text.
 *
 * `TransferEscalated` carries the agent's own reason bytes, not an
 * `EscalationReason` enum index, so decoding it as a number produced labels
 * like `UNKNOWN_Infinity`. Readable UTF-8 is returned as written; anything
 * else stays as the hex the chain holds, so the read model never invents text.
 */
export function transferReasonText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  if (!isHex(value)) {
    return value;
  }
  if (value === "0x") {
    return "";
  }
  let decoded: string;
  try {
    decoded = hexToString(value as Hex);
  } catch {
    return value;
  }
  if (decoded.includes("\uFFFD") || hasControlCharacters(decoded)) {
    return value;
  }
  return decoded;
}
