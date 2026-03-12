import { describe, expect, it } from "vitest";

import { canonicalizeJson } from "../src/lib/crypto/canonical-json.js";

describe("canonical JSON", () => {
  it("sorts object keys recursively and preserves array order", () => {
    const canonical = canonicalizeJson({
      z: 1,
      a: {
        d: true,
        c: [3, { y: 2, x: 1 }]
      }
    });

    expect(canonical).toBe('{"a":{"c":[3,{"x":1,"y":2}],"d":true},"z":1}');
  });

  it("normalizes negative zero", () => {
    expect(canonicalizeJson({ value: -0 })).toBe('{"value":0}');
  });

  it("rejects non-finite numbers", () => {
    expect(() => canonicalizeJson({ value: Number.NaN })).toThrow("Non-finite numbers");
  });

  it("rejects sparse arrays", () => {
    const sparse = new Array(1) as unknown[];

    expect(() => canonicalizeJson(sparse as never)).toThrow("Sparse arrays");
  });

  it("rejects non-plain objects", () => {
    expect(() => canonicalizeJson({ created_at: new Date("2026-03-12T00:00:00.000Z") } as never)).toThrow(
      "Only plain JSON objects"
    );
  });
});
