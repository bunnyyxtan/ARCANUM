/**
 * Deterministic JSON serialization for signed payloads.
 *
 * This is the RFC 8785 (JSON Canonicalization Scheme) subset the receipt
 * format needs: object members sorted by UTF-16 code units, no insignificant
 * whitespace, strings escaped exactly as `JSON.stringify` escapes them, and
 * numbers restricted to safe integers so no float formatting rules apply.
 * Values that cannot be represented unambiguously - bigint, NaN, Infinity,
 * fractional or unsafe numbers, functions, class instances - throw instead of
 * being coerced. A signature over the output therefore commits to one exact
 * byte sequence that any JCS implementation can reproduce.
 */
export type CanonicalJsonValue =
  | string
  | number
  | boolean
  | null
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue | undefined };

export class CanonicalJsonError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalJsonError";
  }
}

export function canonicalJson(value: unknown): string {
  return serialize(value, "$");
}

function serialize(value: unknown, path: string): string {
  if (value === null) {
    return "null";
  }

  switch (typeof value) {
    case "string":
      if (!value.isWellFormed()) {
        // A lone surrogate has no UTF-8 encoding, so implementations disagree
        // on its bytes; refuse rather than sign something unreproducible.
        throw new CanonicalJsonError(`${path}: strings must be well-formed UTF-16.`);
      }
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isSafeInteger(value)) {
        throw new CanonicalJsonError(
          `${path}: only safe integers can be canonicalized; encode other numbers as strings.`,
        );
      }
      // Number.isSafeInteger(-0) is true, but "-0" and "0" would be two
      // encodings of the same value.
      return Object.is(value, -0) ? "0" : String(value);
    case "object":
      break;
    default:
      throw new CanonicalJsonError(`${path}: ${typeof value} values cannot be canonicalized.`);
  }

  if (Array.isArray(value)) {
    const items = value.map((item, index) => {
      if (item === undefined) {
        throw new CanonicalJsonError(`${path}[${index}]: arrays cannot contain undefined.`);
      }
      return serialize(item, `${path}[${index}]`);
    });
    return `[${items.join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new CanonicalJsonError(`${path}: only plain objects can be canonicalized.`);
  }

  const record = value as Record<string, unknown>;
  // Default sort compares UTF-16 code units, which is the JCS member order.
  const members = Object.keys(record)
    .sort()
    .filter((key) => record[key] !== undefined)
    .map((key) => `${JSON.stringify(key)}:${serialize(record[key], `${path}.${key}`)}`);

  return `{${members.join(",")}}`;
}
