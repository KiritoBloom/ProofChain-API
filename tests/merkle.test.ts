import { describe, expect, it } from "vitest";

import { buildMerkleProof, buildMerkleTree, verifyMerkleProof } from "../src/lib/merkle/tree.js";

const leafHashes = [
  "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
  "3e23e8160039594a33894f6564e1b1348bbd7a0088d42c4acb73eeaed59c009d",
  "2e7d2c03a9507ae265ecf5b5356885a53393a2029d241394997265a1a25aefc6",
  "18ac3e7343f016890c510e93f935261169d9e3f565436429830fafe18f21d2a6"
];

describe("Merkle tree", () => {
  it("builds the expected root for four leaves", () => {
    const tree = buildMerkleTree(leafHashes);

    expect(tree.root).toBe("b49bc3807db9f46837972b214363ce73d275a1c94d2296d2a4b549f6056dbb7d");
    expect(tree.levels).toHaveLength(3);
  });

  it("duplicates the last leaf when a level has an odd count", () => {
    const tree = buildMerkleTree(leafHashes.slice(0, 3));

    expect(tree.root).toBe("d31a37ef6ac14a2db1470c4316beb5592e6afd4465022339adafda76a18ffabe");
  });

  it("builds and verifies inclusion proofs", () => {
    const tree = buildMerkleTree(leafHashes);
    const proof = buildMerkleProof(tree, 2);

    expect(proof).toEqual([
      {
        position: "right",
        hash: "18ac3e7343f016890c510e93f935261169d9e3f565436429830fafe18f21d2a6"
      },
      {
        position: "left",
        hash: "e5a01fee14e0ed5c48714f22180f25ad8365b53f9779f79dc4a3d7e93963f94a"
      }
    ]);
    expect(verifyMerkleProof(leafHashes[2], proof, tree.root)).toBe(true);
  });

  it("returns false for a tampered proof with valid structure", () => {
    const tree = buildMerkleTree(leafHashes);
    const proof = buildMerkleProof(tree, 1);
    const tamperedProof = [
      proof[0],
      {
        ...proof[1],
        hash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
      }
    ];

    expect(verifyMerkleProof(leafHashes[1], tamperedProof, tree.root)).toBe(false);
  });

  it("rejects out-of-range leaf indexes", () => {
    const tree = buildMerkleTree(leafHashes);

    expect(() => buildMerkleProof(tree, 99)).toThrow("out of bounds");
  });
});
