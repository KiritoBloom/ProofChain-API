import type { CanonicalJsonObject } from "./integrity.js";

export interface EventRecord {
  event_id: string;
  schema_version: 1;
  service: string;
  type: string;
  payload: CanonicalJsonObject;
  received_at: string;
  hash: string;
  block_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PublicEventRecord {
  event_id: string;
  schema_version: 1;
  service: string;
  type: string;
  received_at: string;
  hash: string;
  block_id: string | null;
  created_at: string;
  updated_at: string;
  payload_redacted: true;
}

export interface BlockRecord {
  block_id: string;
  sequence: number;
  event_ids: string[];
  hashes: string[];
  merkle_root: string;
  signature: string;
  algorithm: "Ed25519";
  key_id: string;
  sealed_at: string;
  created_at: string;
}

export interface PublicBlockRecord {
  block_id: string;
  sequence: number;
  event_count: number;
  merkle_root: string;
  signature: string;
  algorithm: "Ed25519";
  key_id: string;
  sealed_at: string;
  created_at: string;
}

export type CreateEventRecordInput = EventRecord;

export type CreateBlockRecordInput = BlockRecord;

export interface EventRepository {
  createEvent(record: CreateEventRecordInput): Promise<EventRecord>;
  getEventById(eventId: string): Promise<EventRecord | null>;
  listUnsealedEvents(limit: number): Promise<EventRecord[]>;
  markEventsSealed(eventIds: string[], blockId: string): Promise<number>;
  getEventsByBlockId(blockId: string): Promise<EventRecord[]>;
}

export interface BlockRepository {
  createBlock(record: CreateBlockRecordInput): Promise<BlockRecord>;
  getBlockById(blockId: string): Promise<BlockRecord | null>;
  getLatestBlockSequence(): Promise<number | null>;
  listBlocks(limit: number): Promise<BlockRecord[]>;
}
