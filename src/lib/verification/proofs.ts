import type { ProofEnvelope } from "../../types/integrity.js";
import { BadRequestError } from "../http/errors.js";
import { verifyEd25519Signature } from "../crypto/ed25519.js";
import { serializeSignedBlockPayload } from "../crypto/signed-block.js";
import { verifyMerkleProof } from "../merkle/tree.js";

export function verifyProofEnvelope(proof: ProofEnvelope, publicKey: string): { valid: boolean } {
  try {
    if (!verifyMerkleProof(proof.event_hash, proof.proof, proof.merkle_root)) {
      return { valid: false };
    }

    const payload = serializeSignedBlockPayload({
      algorithm: proof.algorithm,
      key_id: proof.key_id,
      merkle_root: proof.merkle_root,
      sealed_at: proof.sealed_at
    });

    return {
      valid: verifyEd25519Signature(payload, proof.signature, publicKey)
    };
  } catch (error: unknown) {
    throw new BadRequestError(error instanceof Error ? error.message : "Invalid proof verification input.");
  }
}
