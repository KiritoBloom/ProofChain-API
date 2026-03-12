import type { MerkleProofStep, MerkleTree } from "../../types/integrity.js";
import { hashPair, normalizeHashHex } from "../crypto/hash.js";

export function buildMerkleTree(hashes: string[]): MerkleTree {
  if (hashes.length === 0) {
    throw new Error("Cannot build a Merkle tree with zero hashes.");
  }

  const leaves = hashes.map((hash) => normalizeHashHex(hash));
  const levels: string[][] = [leaves];

  while (levels[levels.length - 1].length > 1) {
    const currentLevel = levels[levels.length - 1];
    const nextLevel: string[] = [];

    for (let index = 0; index < currentLevel.length; index += 2) {
      const leftHash = currentLevel[index];
      const rightHash = currentLevel[index + 1] ?? leftHash;

      nextLevel.push(hashPair(leftHash, rightHash));
    }

    levels.push(nextLevel);
  }

  return {
    leaves: [...leaves],
    levels,
    root: levels[levels.length - 1][0]
  };
}

export function buildMerkleProof(tree: MerkleTree, leafIndex: number): MerkleProofStep[] {
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= tree.leaves.length) {
    throw new Error("Leaf index is out of bounds for the Merkle tree.");
  }

  const proof: MerkleProofStep[] = [];
  let currentIndex = leafIndex;

  for (let levelIndex = 0; levelIndex < tree.levels.length - 1; levelIndex += 1) {
    const level = tree.levels[levelIndex];
    const isRightNode = currentIndex % 2 === 1;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    const siblingHash = level[siblingIndex] ?? level[currentIndex];

    proof.push({
      position: isRightNode ? "left" : "right",
      hash: siblingHash
    });

    currentIndex = Math.floor(currentIndex / 2);
  }

  return proof;
}

export function verifyMerkleProof(leafHash: string, proof: MerkleProofStep[], merkleRoot: string): boolean {
  let currentHash = normalizeHashHex(leafHash);
  const normalizedRoot = normalizeHashHex(merkleRoot);

  for (const step of proof) {
    const siblingHash = normalizeHashHex(step.hash);

    if (step.position === "left") {
      currentHash = hashPair(siblingHash, currentHash);
      continue;
    }

    if (step.position === "right") {
      currentHash = hashPair(currentHash, siblingHash);
      continue;
    }

    throw new Error("Merkle proof step position must be 'left' or 'right'.");
  }

  return currentHash === normalizedRoot;
}
