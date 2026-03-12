import { readFile } from "node:fs/promises";

import { z } from "zod";

import { proofEnvelopeSchema } from "../validation/proofs.js";
import { verifyProofEnvelope } from "./proofs.js";

const proofFileSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().regex(/^evt_[a-zA-Z0-9_-]+$/),
  event_hash: z.string(),
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  merkle_root: z.string(),
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  signature: z.string().min(1),
  sealed_at: z.string().datetime(),
  proof: z.array(
    z.object({
      position: z.enum(["left", "right"]),
      hash: z.string()
    })
  ),
  public_key: z.string().min(1).optional()
});

export interface VerifyProofFileOptions {
  proofFilePath: string;
  publicKey?: string;
}

export interface VerifyProofFileResult {
  valid: boolean;
  proof: z.infer<typeof proofEnvelopeSchema>;
  publicKey: string;
}

export async function verifyProofFile(options: VerifyProofFileOptions): Promise<VerifyProofFileResult> {
  const fileContents = await readFile(options.proofFilePath, "utf8");
  const parsed = proofFileSchema.parse(JSON.parse(fileContents));
  const publicKey = options.publicKey ?? parsed.public_key;

  if (!publicKey) {
    throw new Error("A public key is required. Provide it in the proof file or with --public-key.");
  }

  const { public_key: _ignored, ...proof } = parsed;

  void _ignored;

  return {
    valid: verifyProofEnvelope(proof, publicKey).valid,
    proof,
    publicKey
  };
}
