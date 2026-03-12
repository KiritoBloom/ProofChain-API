import { z } from "zod";

import type { EventRecord, PublicEventRecord } from "../../types/persistence.js";
import { sha256HexSchema } from "./hash.js";
import { jsonObjectSchema } from "./json.js";

export const eventIdSchema = z.string().regex(/^evt_[a-zA-Z0-9_-]+$/);

export const createEventRequestSchema = z
  .object({
    service: z.string().min(1).max(100),
    type: z.string().min(1).max(100),
    payload: jsonObjectSchema
  })
  .strict();

export const createEventResponseSchema = z.object({
  event_id: eventIdSchema,
  hash: sha256HexSchema,
  received_at: z.string().datetime()
});

export const getEventParamsSchema = z.object({
  event_id: eventIdSchema
});

export const eventRecordSchema: z.ZodType<EventRecord> = z.object({
  event_id: eventIdSchema,
  schema_version: z.literal(1),
  service: z.string().min(1),
  type: z.string().min(1),
  payload: jsonObjectSchema,
  received_at: z.string().datetime(),
  hash: sha256HexSchema,
  block_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export const publicEventRecordSchema: z.ZodType<PublicEventRecord> = z.object({
  event_id: eventIdSchema,
  schema_version: z.literal(1),
  service: z.string().min(1),
  type: z.string().min(1),
  received_at: z.string().datetime(),
  hash: sha256HexSchema,
  block_id: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  payload_redacted: z.literal(true)
});
