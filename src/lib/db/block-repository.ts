import type {
  BlockRecord,
  BlockRepository,
  CreateBlockRecordInput
} from "../../types/persistence.js";
import type { BlockDocument } from "./documents.js";
import { BLOCKS_COLLECTION } from "./collections.js";
import { toBlockRecord } from "./documents.js";

interface BlockCollectionLike {
  insertOne(document: BlockDocument): Promise<unknown>;
  findOne(
    filter: Record<string, unknown>,
    options?: { sort?: Record<string, 1 | -1> }
  ): Promise<BlockDocument | null>;
  find(filter: Record<string, unknown>): {
    sort(sortDefinition: Record<string, 1 | -1>): {
      limit(count: number): {
        toArray(): Promise<BlockDocument[]>;
      };
    };
  };
}

export class MongoBlockRepository implements BlockRepository {
  constructor(private readonly collection: BlockCollectionLike) {}

  static fromDb(db: { collection(name: string): unknown }): MongoBlockRepository {
    return new MongoBlockRepository(db.collection(BLOCKS_COLLECTION) as BlockCollectionLike);
  }

  async createBlock(record: CreateBlockRecordInput): Promise<BlockRecord> {
    await this.collection.insertOne({ ...record });

    return record;
  }

  async getBlockById(blockId: string): Promise<BlockRecord | null> {
    const document = await this.collection.findOne({ block_id: blockId });

    return document ? toBlockRecord(document) : null;
  }

  async getLatestBlockSequence(): Promise<number | null> {
    const document = await this.collection.findOne({}, { sort: { sequence: -1 } });

    return document?.sequence ?? null;
  }

  async listBlocks(limit: number): Promise<BlockRecord[]> {
    const documents = await this.collection.find({}).sort({ sequence: -1 }).limit(limit).toArray();

    return documents.map((document) => toBlockRecord(document));
  }
}
