import { z } from "zod";

import type { ProofEnvelope } from "../../types/integrity.js";
import { publicAnchorRecordResponseSchema } from "./anchors.js";
import { sha256HexSchema } from "./hash.js";

const proofStepSchema = z.object({
  position: z.enum(["left", "right"]),
  hash: sha256HexSchema
});

export const getProofParamsSchema = z.object({
  event_id: z.string().regex(/^evt_[a-zA-Z0-9_-]+$/)
});

const proofEnvelopeObjectSchema = z.object({
  schema_version: z.literal(1),
  event_id: z.string().regex(/^evt_[a-zA-Z0-9_-]+$/),
  event_hash: sha256HexSchema,
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  merkle_root: sha256HexSchema,
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  signature: z.string().min(1),
  sealed_at: z.string().datetime(),
  proof: z.array(proofStepSchema),
  anchor: publicAnchorRecordResponseSchema.optional()
});

export const proofEnvelopeSchema: z.ZodType<ProofEnvelope> =
  proofEnvelopeObjectSchema;

export const verifyProofRequestSchema = proofEnvelopeObjectSchema.extend({
  public_key: z.string().min(1)
});

export const verifyProofResponseSchema = z.object({
  valid: z.boolean(),
  anchor_valid: z.boolean().optional()
});
