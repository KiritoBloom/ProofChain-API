import type {
  AnchorRecord,
  AnchorRepository,
  CreateAnchorRecordInput
} from "../../types/persistence.js";
import type { AnchorDocument } from "./documents.js";
import { ANCHORS_COLLECTION } from "./collections.js";
import { toAnchorRecord } from "./documents.js";

interface AnchorCollectionLike {
  insertOne(document: AnchorDocument): Promise<unknown>;
  findOne(
    filter: Record<string, unknown>,
    options?: { sort?: Record<string, 1 | -1> }
  ): Promise<AnchorDocument | null>;
  find(filter: Record<string, unknown>): {
    sort(sortDefinition: Record<string, 1 | -1>): {
      limit(count: number): {
        toArray(): Promise<AnchorDocument[]>;
      };
    };
  };
}

export class MongoAnchorRepository implements AnchorRepository {
  constructor(private readonly collection: AnchorCollectionLike) {}

  static fromDb(db: {
    collection(name: string): unknown;
  }): MongoAnchorRepository {
    return new MongoAnchorRepository(
      db.collection(ANCHORS_COLLECTION) as AnchorCollectionLike
    );
  }

  async createAnchor(record: CreateAnchorRecordInput): Promise<AnchorRecord> {
    await this.collection.insertOne({ ...record });

    return record;
  }

  async getAnchorByBlockId(blockId: string): Promise<AnchorRecord | null> {
    const document = await this.collection.findOne({ block_id: blockId });

    return document ? toAnchorRecord(document) : null;
  }

  async getLatestAnchor(): Promise<AnchorRecord | null> {
    const document = await this.collection.findOne(
      {},
      { sort: { block_sequence: -1 } }
    );

    return document ? toAnchorRecord(document) : null;
  }

  async listAnchors(limit: number): Promise<AnchorRecord[]> {
    const documents = await this.collection
      .find({})
      .sort({ block_sequence: -1 })
      .limit(limit)
      .toArray();

    return documents.map((document) => toAnchorRecord(document));
  }
}
