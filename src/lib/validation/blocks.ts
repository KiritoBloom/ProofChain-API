import { z } from "zod";

import type { PublicBlockRecord } from "../../types/persistence.js";
import { sha256HexSchema } from "./hash.js";

export const createBlockRequestSchema = z
  .object({
    max_events: z.number().int().positive().max(1000).optional()
  })
  .strict();

export const createBlockResponseSchema = z.object({
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  sequence: z.number().int().positive(),
  event_count: z.number().int().positive(),
  merkle_root: sha256HexSchema,
  signature: z.string().min(1),
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  sealed_at: z.string().datetime()
});

export const listBlocksQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const blockRecordResponseSchema = z.object({
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  sequence: z.number().int().positive(),
  event_ids: z.array(z.string()),
  hashes: z.array(sha256HexSchema),
  merkle_root: sha256HexSchema,
  signature: z.string().min(1),
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  sealed_at: z.string().datetime(),
  created_at: z.string().datetime()
});

export const publicBlockRecordResponseSchema: z.ZodType<PublicBlockRecord> = z.object({
  block_id: z.string().regex(/^blk_[a-zA-Z0-9_-]+$/),
  sequence: z.number().int().positive(),
  event_count: z.number().int().nonnegative(),
  merkle_root: sha256HexSchema,
  signature: z.string().min(1),
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  sealed_at: z.string().datetime(),
  created_at: z.string().datetime()
});

export const publicListBlocksResponseSchema = z.object({
  blocks: z.array(publicBlockRecordResponseSchema),
  count: z.number().int().nonnegative()
});

export const listBlocksResponseSchema = z.object({
  blocks: z.array(blockRecordResponseSchema),
  count: z.number().int().nonnegative()
});
