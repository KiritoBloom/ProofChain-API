import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashCanonicalJson, hashPair, normalizeHashHex, sha256Hex } from "../src/lib/crypto/hash.js";

describe("hashing", () => {
  it("computes the expected SHA-256 hex digest", () => {
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("hashes canonical JSON deterministically", () => {
    const result = hashCanonicalJson({
      payload: {
        amount: 200,
        user_id: "1245"
      },
      type: "transaction",
      service: "payment-service"
    });

    expect(result.canonical).toBe(
      '{"payload":{"amount":200,"user_id":"1245"},"service":"payment-service","type":"transaction"}'
    );
    expect(result.hash).toBe("e620eb23edefc4bd290260b58c35c976f7dfc9173efb178a9755182706342504");
  });

  it("hashes Merkle pairs from hash bytes, not hex text", () => {
    const left = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
    const right = "cb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34";
    const expected = createHash("sha256")
      .update(Buffer.concat([Buffer.from(left, "hex"), Buffer.from(right, "hex")]))
      .digest("hex");

    expect(hashPair(left, right)).toBe(expected);
  });

  it("normalizes uppercase hashes", () => {
    expect(normalizeHashHex("BA7816BF8F01CFEA414140DE5DAE2223B00361A396177A9CB410FF61F20015AD")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
  });
});
