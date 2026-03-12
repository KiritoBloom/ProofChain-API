import { describe, expect, it } from "vitest";

import { MongoBlockRepository } from "../src/lib/db/block-repository.js";
import { MongoEventRepository } from "../src/lib/db/event-repository.js";
import { ensureProofChainIndexes } from "../src/lib/db/indexes.js";
import { getMongoDbName, getMongoUri } from "../src/lib/db/mongo.js";
import type { BlockRecord, EventRecord } from "../src/types/persistence.js";

class InMemoryCollection<T extends object> {
  private documents: T[] = [];

  async insertOne(document: T): Promise<void> {
    this.documents.push(structuredClone(document));
  }

  async findOne(filter: Record<string, unknown>, options?: { sort?: Record<string, 1 | -1> }): Promise<T | null> {
    const matches = this.documents.filter((document) => matchesFilter(document, filter));

    if (matches.length === 0) {
      return null;
    }

    if (options?.sort) {
      const [field, direction] = Object.entries(options.sort)[0];
      matches.sort((left, right) => {
        const leftRecord = left as Record<string, unknown>;
        const rightRecord = right as Record<string, unknown>;

        return compareValues(leftRecord[field], rightRecord[field]) * direction;
      });
    }

    return structuredClone(matches[0]);
  }

  find(filter: Record<string, unknown>) {
    const matches = this.documents.filter((document) => matchesFilter(document, filter));

    return new InMemoryCursor<T>(matches);
  }

  async updateMany(
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> }
  ): Promise<{ modifiedCount: number }> {
    let modifiedCount = 0;

    for (const document of this.documents) {
      if (!matchesFilter(document, filter)) {
        continue;
      }

      Object.assign(document, update.$set);
      modifiedCount += 1;
    }

    return { modifiedCount };
  }

  async createIndexes(indexes: Array<{ name?: string; key: Record<string, 1 | -1>; unique?: boolean }>): Promise<string[]> {
    return indexes.map((index) => index.name ?? JSON.stringify(index.key));
  }
}

class InMemoryCursor<T extends object> {
  constructor(private readonly documents: T[]) {}

  sort(sortDefinition: Record<string, 1 | -1>): InMemoryCursor<T> {
    const [field, direction] = Object.entries(sortDefinition)[0];
    this.documents.sort((left, right) => {
      const leftRecord = left as Record<string, unknown>;
      const rightRecord = right as Record<string, unknown>;

      return compareValues(leftRecord[field], rightRecord[field]) * direction;
    });

    return this;
  }

  limit(count: number): InMemoryCursor<T> {
    return new InMemoryCursor(this.documents.slice(0, count));
  }

  async toArray(): Promise<T[]> {
    return this.documents.map((document) => structuredClone(document));
  }
}

class InMemoryDb {
  public readonly collections = new Map<string, InMemoryCollection<object>>();

  collection<T extends object>(name: string): InMemoryCollection<T> {
    const existing = this.collections.get(name);

    if (existing) {
      return existing as InMemoryCollection<T>;
    }

    const created = new InMemoryCollection<object>();
    this.collections.set(name, created);

    return created as InMemoryCollection<T>;
  }
}

const firstEvent: EventRecord = {
  event_id: "evt_001",
  schema_version: 1,
  service: "auth-service",
  type: "login",
  payload: {
    user_id: "user-1"
  },
  received_at: "2026-03-12T00:00:00.000Z",
  hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
  block_id: null,
  created_at: "2026-03-12T00:00:00.000Z",
  updated_at: "2026-03-12T00:00:00.000Z"
};

const secondEvent: EventRecord = {
  event_id: "evt_002",
  schema_version: 1,
  service: "payment-service",
  type: "transaction",
  payload: {
    amount: 200,
    user_id: "user-2"
  },
  received_at: "2026-03-12T00:01:00.000Z",
  hash: "bfade49b3062e232befedd9ee349225ccf1e048e8a10628d3c23aba1cdda42b2",
  block_id: null,
  created_at: "2026-03-12T00:01:00.000Z",
  updated_at: "2026-03-12T00:01:00.000Z"
};

const blockRecord: BlockRecord = {
  block_id: "blk_001",
  sequence: 1,
  event_ids: ["evt_001", "evt_002"],
  hashes: [firstEvent.hash, secondEvent.hash],
  merkle_root: "19401b0f6e27eb4e327a9bc2fe6fd00da9c0beaa72333b576bbb5be041bb9286",
  signature: "demo-signature",
  algorithm: "Ed25519",
  key_id: "main-2026-01",
  sealed_at: "2026-03-12T00:02:00.000Z",
  created_at: "2026-03-12T00:02:00.000Z"
};

describe("persistence layer", () => {
  it("requires Mongo config when building a live connection", () => {
    expect(() =>
      getMongoUri({
        NODE_ENV: "development",
        APP_NAME: "ProofChain API",
        API_BASE_URL: "http://localhost:3000",
        LOG_LEVEL: "info",
        MONGODB_URI: undefined,
        MONGODB_DB_NAME: "proofchain",
        SIGNING_PRIVATE_KEY: undefined,
        SIGNING_PUBLIC_KEY: undefined,
        SIGNING_KEY_ID: undefined
      })
    ).toThrow("MONGODB_URI");
    expect(() =>
      getMongoDbName({
        NODE_ENV: "development",
        APP_NAME: "ProofChain API",
        API_BASE_URL: "http://localhost:3000",
        LOG_LEVEL: "info",
        MONGODB_URI: "mongodb+srv://demo/proofchain",
        MONGODB_DB_NAME: undefined,
        SIGNING_PRIVATE_KEY: undefined,
        SIGNING_PUBLIC_KEY: undefined,
        SIGNING_KEY_ID: undefined
      })
    ).toThrow("MONGODB_DB_NAME");
  });

  it("creates and queries events through the event repository", async () => {
    const db = new InMemoryDb();
    const repository = MongoEventRepository.fromDb(db);

    await repository.createEvent(secondEvent);
    await repository.createEvent(firstEvent);

    expect(await repository.getEventById("evt_001")).toEqual(firstEvent);
    expect(await repository.listUnsealedEvents(10)).toEqual([firstEvent, secondEvent]);
    expect(await repository.getEventsByBlockId("blk_001")).toEqual([]);

    const modifiedCount = await repository.markEventsSealed(["evt_001", "evt_002"], "blk_001");

    expect(modifiedCount).toBe(2);
    expect(await repository.listUnsealedEvents(10)).toEqual([]);
    expect(await repository.getEventsByBlockId("blk_001")).toEqual([
      {
        ...firstEvent,
        block_id: "blk_001",
        updated_at: expect.any(String)
      },
      {
        ...secondEvent,
        block_id: "blk_001",
        updated_at: expect.any(String)
      }
    ]);

    const sealedEvent = await repository.getEventById("evt_001");
    expect(sealedEvent?.block_id).toBe("blk_001");
  });

  it("creates and queries blocks through the block repository", async () => {
    const db = new InMemoryDb();
    const repository = MongoBlockRepository.fromDb(db);

    await repository.createBlock({
      ...blockRecord,
      block_id: "blk_001",
      sequence: 1
    });
    await repository.createBlock({
      ...blockRecord,
      block_id: "blk_002",
      sequence: 2
    });

    expect(await repository.getBlockById("blk_001")).toEqual({
      ...blockRecord,
      block_id: "blk_001",
      sequence: 1
    });
    expect(await repository.getLatestBlockSequence()).toBe(2);
  });

  it("creates the expected index definitions", async () => {
    const db = new InMemoryDb();

    await ensureProofChainIndexes(db as never);

    expect(db.collections.has("events")).toBe(true);
    expect(db.collections.has("blocks")).toBe(true);
  });
});

function matchesFilter(document: object, filter: Record<string, unknown>): boolean {
  const record = document as Record<string, unknown>;

  for (const [key, value] of Object.entries(filter)) {
    if (isInClause(value)) {
      const documentValue = record[key];

      if (!value.$in.includes(documentValue)) {
        return false;
      }

      continue;
    }

    if (record[key] !== value) {
      return false;
    }
  }

  return true;
}

function isInClause(value: unknown): value is { $in: unknown[] } {
  return typeof value === "object" && value !== null && "$in" in value && Array.isArray(value.$in);
}

function compareValues(left: unknown, right: unknown): number {
  if (left === right) {
    return 0;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  return String(left).localeCompare(String(right));
}
