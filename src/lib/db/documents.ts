import type { ObjectId } from "mongodb";

import type {
  AnchorRecord,
  BlockRecord,
  EventRecord
} from "../../types/persistence.js";

export interface EventDocument extends EventRecord {
  _id?: ObjectId;
}

export interface BlockDocument extends BlockRecord {
  _id?: ObjectId;
}

export interface AnchorDocument extends AnchorRecord {
  _id?: ObjectId;
}

export function toEventRecord(document: EventDocument): EventRecord {
  const { _id, ...record } = document;

  void _id;

  return record;
}

export function toBlockRecord(document: BlockDocument): BlockRecord {
  const { _id, ...record } = document;

  void _id;

  return record;
}

export function toAnchorRecord(document: AnchorDocument): AnchorRecord {
  const { _id, ...record } = document;

  void _id;

  return record;
}
