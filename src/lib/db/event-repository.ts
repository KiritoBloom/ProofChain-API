import type {
  CreateEventRecordInput,
  EventRecord,
  EventRepository
} from "../../types/persistence.js";
import type { EventDocument } from "./documents.js";
import { EVENTS_COLLECTION } from "./collections.js";
import { toEventRecord } from "./documents.js";

interface EventCursorLike {
  sort(sortDefinition: Record<string, 1 | -1>): EventCursorLike;
  limit(count: number): EventCursorLike;
  toArray(): Promise<EventDocument[]>;
}

interface EventCollectionLike {
  insertOne(document: EventDocument): Promise<unknown>;
  findOne(filter: Record<string, unknown>): Promise<EventDocument | null>;
  find(filter: Record<string, unknown>): EventCursorLike;
  updateMany(
    filter: Record<string, unknown>,
    update: { $set: Record<string, unknown> }
  ): Promise<{ modifiedCount: number }>;
}

export class MongoEventRepository implements EventRepository {
  constructor(private readonly collection: EventCollectionLike) {}

  static fromDb(db: { collection(name: string): unknown }): MongoEventRepository {
    return new MongoEventRepository(db.collection(EVENTS_COLLECTION) as EventCollectionLike);
  }

  async createEvent(record: CreateEventRecordInput): Promise<EventRecord> {
    await this.collection.insertOne({ ...record });

    return record;
  }

  async getEventById(eventId: string): Promise<EventRecord | null> {
    const document = await this.collection.findOne({ event_id: eventId });

    return document ? toEventRecord(document) : null;
  }

  async listUnsealedEvents(limit: number): Promise<EventRecord[]> {
    const documents = await this.collection
      .find({ block_id: null })
      .sort({ received_at: 1, event_id: 1 })
      .limit(limit)
      .toArray();

    return documents.map((document) => toEventRecord(document));
  }

  async markEventsSealed(eventIds: string[], blockId: string): Promise<number> {
    if (eventIds.length === 0) {
      return 0;
    }

    const result = await this.collection.updateMany(
      {
        event_id: { $in: eventIds },
        block_id: null
      },
      {
        $set: {
          block_id: blockId,
          updated_at: new Date().toISOString()
        }
      }
    );

    return result.modifiedCount;
  }

  async getEventsByBlockId(blockId: string): Promise<EventRecord[]> {
    const documents = await this.collection
      .find({ block_id: blockId })
      .sort({ received_at: 1, event_id: 1 })
      .toArray();

    return documents.map((document) => toEventRecord(document));
  }
}
