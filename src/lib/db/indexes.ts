import type { IndexDescription } from "mongodb";

import { BLOCKS_COLLECTION, EVENTS_COLLECTION } from "./collections.js";

const eventIndexes: IndexDescription[] = [
  {
    key: { event_id: 1 },
    name: "event_id_unique",
    unique: true
  },
  {
    key: { block_id: 1, received_at: 1 },
    name: "block_id_received_at"
  }
];

const blockIndexes: IndexDescription[] = [
  {
    key: { block_id: 1 },
    name: "block_id_unique",
    unique: true
  },
  {
    key: { sequence: 1 },
    name: "sequence_unique",
    unique: true
  }
];

export async function ensureProofChainIndexes(db: Db): Promise<void> {
  const eventCollection = db.collection(EVENTS_COLLECTION);
  const blockCollection = db.collection(BLOCKS_COLLECTION);

  await Promise.all([eventCollection.createIndexes(eventIndexes), blockCollection.createIndexes(blockIndexes)]);
}

interface Db {
  collection(name: string): {
    createIndexes(indexes: IndexDescription[]): Promise<unknown>;
  };
}
