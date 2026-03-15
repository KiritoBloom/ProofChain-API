import type { ProofEnvelope } from "../../types/integrity.js";
import { computeTransparencyCheckpoint } from "../crypto/transparency-anchor.js";
import { BadRequestError } from "../http/errors.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { serializeSignedBlockPayload } from "../crypto/signed-block.js";
import { verifyMerkleProof } from "../merkle/tree.js";

export function verifyProofEnvelope(
  proof: ProofEnvelope,
  publicKey: string
): { valid: boolean; anchor_valid?: boolean } {
  try {
    if (!verifyMerkleProof(proof.event_hash, proof.proof, proof.merkle_root)) {
      return {
        valid: false,
        ...(proof.anchor
          ? { anchor_valid: verifyTransparencyAnchor(proof) }
          : {})
      };
    }

    const payload = serializeSignedBlockPayload({
      algorithm: proof.algorithm,
      key_id: proof.key_id,
      merkle_root: proof.merkle_root,
      sealed_at: proof.sealed_at
    });

    const valid = verifyEd25519Signature(payload, proof.signature, publicKey);

    return {
      valid,
      ...(proof.anchor ? { anchor_valid: verifyTransparencyAnchor(proof) } : {})
    };
  } catch (error: unknown) {
    throw new BadRequestError(
      error instanceof Error
        ? error.message
        : "Invalid proof verification input."
    );
  }
}

function verifyTransparencyAnchor(proof: ProofEnvelope): boolean {
  const anchor = proof.anchor;

  if (!anchor) {
    return false;
  }

  if (
    anchor.schema_version !== 1 ||
    anchor.block_id !== proof.block_id ||
    anchor.merkle_root !== proof.merkle_root ||
    anchor.signature !== proof.signature ||
    anchor.algorithm !== proof.algorithm ||
    anchor.key_id !== proof.key_id ||
    anchor.sealed_at !== proof.sealed_at
  ) {
    return false;
  }

  return (
    computeTransparencyCheckpoint({
      algorithm: anchor.algorithm,
      key_id: anchor.key_id,
      block_id: anchor.block_id,
      block_sequence: anchor.block_sequence,
      merkle_root: anchor.merkle_root,
      signature: anchor.signature,
      sealed_at: anchor.sealed_at,
      prev_anchor_hash: anchor.prev_anchor_hash,
      anchored_at: anchor.anchored_at
    }) === anchor.checkpoint
  );
}
