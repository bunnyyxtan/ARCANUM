import { describe, expect, it } from "vitest";

import { CanonicalJsonError, canonicalJson } from "./canonical-json";

describe("canonicalJson", () => {
  it("sorts members by UTF-16 code units and strips whitespace", () => {
    expect(canonicalJson({ b: 1, a: [true, null, "x"], "\u00e9": 2, Z: 3 })).toBe(
      '{"Z":3,"a":[true,null,"x"],"b":1,"\u00e9":2}',
    );
  });

  it("is independent of insertion order and nesting", () => {
    const left = { outer: { y: "1", x: { k: [1, 2] } }, id: "a" };
    const right = { id: "a", outer: { x: { k: [1, 2] }, y: "1" } };
    expect(canonicalJson(left)).toBe(canonicalJson(right));
  });

  it("escapes strings like JSON.stringify", () => {
    expect(canonicalJson({ s: 'quote " backslash \\ newline \n tab \t nul \u0000' })).toBe(
      '{"s":"quote \\" backslash \\\\ newline \\n tab \\t nul \\u0000"}',
    );
  });

  it("omits undefined members but rejects undefined array items", () => {
    expect(canonicalJson({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(() => canonicalJson([1, undefined])).toThrow(CanonicalJsonError);
  });

  it("rejects lone surrogates, which have no UTF-8 encoding", () => {
    expect(() => canonicalJson({ s: "\ud800" })).toThrow(CanonicalJsonError);
    expect(canonicalJson({ s: "\ud83d\ude00" })).toBe('{"s":"\ud83d\ude00"}');
  });

  it("normalizes negative zero", () => {
    expect(canonicalJson({ n: -0 })).toBe('{"n":0}');
  });

  it("rejects values with more than one encoding", () => {
    expect(() => canonicalJson({ n: 1.5 })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ n: Number.MAX_SAFE_INTEGER + 1 })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ n: Number.NaN })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ n: 10n })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ d: new Date(0) })).toThrow(CanonicalJsonError);
    expect(() => canonicalJson({ f: () => 1 })).toThrow(CanonicalJsonError);
  });
});
