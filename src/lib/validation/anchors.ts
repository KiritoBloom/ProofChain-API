import { z } from "zod";

import type { PublicAnchorRecord } from "../../types/persistence.js";
import { sha256HexSchema } from "./hash.js";

export const anchorIdSchema = z.string().regex(/^anc_[a-zA-Z0-9_-]+$/);

export const publicAnchorRecordResponseSchema: z.ZodType<PublicAnchorRecord> =
  z.object({
    schema_version: z.literal(1),
    anchor_id: anchorIdSchema,
    block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
    block_sequence: z.number().int().positive(),
    merkle_root: sha256HexSchema,
    signature: z.string().min(1),
    algorithm: z.literal("Ed25519"),
    key_id: z.string().min(1),
    sealed_at: z.string().datetime(),
    prev_anchor_hash: sha256HexSchema.nullable(),
    checkpoint: sha256HexSchema,
    anchored_at: z.string().datetime(),
    created_at: z.string().datetime()
  });

export const listAnchorsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const publicListAnchorsResponseSchema = z.object({
  anchors: z.array(publicAnchorRecordResponseSchema),
  count: z.number().int().nonnegative()
});

export const getAnchorByBlockParamsSchema = z.object({
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/)
});
