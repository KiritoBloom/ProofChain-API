import { z } from "zod";

import type { ProofEnvelope } from "../../types/integrity.js";
import { normalizeHashHex } from "../crypto/hash.js";

const proofStepSchema = z.object({
  position: z.enum(["left", "right"]),
  hash: z.string().transform((value) => normalizeHashHex(value))
});

export const getProofParamsSchema = z.object({
  event_id: z.string().regex(/^evt_[a-zA-Z0-9_-]+$/)
});

const proofEnvelopeObjectSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().regex(/^evt_[a-zA-Z0-9_-]+$/),
  event_hash: z.string().transform((value) => normalizeHashHex(value)),
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  merkle_root: z.string().transform((value) => normalizeHashHex(value)),
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  signature: z.string().min(1),
  sealed_at: z.string().datetime(),
  proof: z.array(proofStepSchema)
});

export const proofEnvelopeSchema: z.ZodType<ProofEnvelope> = proofEnvelopeObjectSchema;

export const verifyProofRequestSchema = proofEnvelopeObjectSchema.extend({
  public_key: z.string().min(1)
});

export const verifyProofResponseSchema = z.object({
  valid: z.boolean()
});
