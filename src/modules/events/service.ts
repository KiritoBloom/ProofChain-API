import { randomUUID } from "node:crypto";

import { hashCanonicalJson } from "../../lib/crypto/hash.js";
import { NotFoundError } from "../../lib/http/errors.js";
import type { CanonicalJsonObject } from "../../types/integrity.js";
import type { EventRecord, EventRepository } from "../../types/persistence.js";

export interface IngestEventInput {
  service: string;
  type: string;
  payload: CanonicalJsonObject;
}

export interface IngestEventResult {
  event_id: string;
  hash: string;
  received_at: string;
}

interface EventServiceDependencies {
  eventRepository: EventRepository;
  createEventId?: () => string;
  now?: () => string;
}

export function createEventIngestionService(dependencies: EventServiceDependencies) {
  return async function ingestEvent(input: IngestEventInput): Promise<IngestEventResult> {
    const timestamp = (dependencies.now ?? defaultNow)();
    const event_id = (dependencies.createEventId ?? defaultEventId)();
    const hashResult = hashCanonicalJson({
      payload: input.payload,
      received_at: timestamp,
      schema_version: 1,
      service: input.service,
      type: input.type
    });

    const record: EventRecord = {
      event_id,
      schema_version: 1,
      service: input.service,
      type: input.type,
      payload: input.payload,
      received_at: timestamp,
      hash: hashResult.hash,
      block_id: null,
      created_at: timestamp,
      updated_at: timestamp
    };

    await dependencies.eventRepository.createEvent(record);

    return {
      event_id,
      hash: hashResult.hash,
      received_at: timestamp
    };
  };
}

export function createGetEventByIdService(dependencies: { eventRepository: EventRepository }) {
  return async function getEventById(eventId: string): Promise<EventRecord> {
    const eventRecord = await dependencies.eventRepository.getEventById(eventId);

    if (!eventRecord) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    return eventRecord;
  };
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultEventId(): string {
  return `evt_${randomUUID().replace(/-/g, "")}`;
}
