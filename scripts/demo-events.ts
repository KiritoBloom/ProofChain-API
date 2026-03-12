import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { createGetEventByIdHandler, createPostEventsHandler } from "../src/modules/events/http-handlers.js";
import { createEventIngestionService, createGetEventByIdService } from "../src/modules/events/service.js";
import type { EventRecord, EventRepository } from "../src/types/persistence.js";

class DemoEventRepository implements EventRepository {
  private readonly events = new Map<string, EventRecord>();

  async createEvent(record: EventRecord): Promise<EventRecord> {
    this.events.set(record.event_id, record);
    return record;
  }

  async getEventById(eventId: string): Promise<EventRecord | null> {
    return this.events.get(eventId) ?? null;
  }

  async listUnsealedEvents(limit: number): Promise<EventRecord[]> {
    return [...this.events.values()].filter((event) => event.block_id === null).slice(0, limit);
  }

  async markEventsSealed(eventIds: string[], blockId: string): Promise<number> {
    let modifiedCount = 0;

    for (const eventId of eventIds) {
      const eventRecord = this.events.get(eventId);

      if (!eventRecord || eventRecord.block_id !== null) {
        continue;
      }

      eventRecord.block_id = blockId;
      eventRecord.updated_at = "2026-03-12T00:10:00.000Z";
      this.events.set(eventId, eventRecord);
      modifiedCount += 1;
    }

    return modifiedCount;
  }

  async getEventsByBlockId(blockId: string): Promise<EventRecord[]> {
    return [...this.events.values()]
      .filter((event) => event.block_id === blockId)
      .sort((left, right) => left.received_at.localeCompare(right.received_at) || left.event_id.localeCompare(right.event_id));
  }
}

async function main(): Promise<void> {
  const repository = new DemoEventRepository();
  const ingestEvent = createEventIngestionService({
    eventRepository: repository,
    createEventId: () => "evt_demo_001",
    now: () => "2026-03-12T00:00:00.000Z"
  });
  const getEventById = createGetEventByIdService({
    eventRepository: repository
  });

  const postEventsHandler = createPostEventsHandler({ ingestEvent });
  const getEventByIdHandler = createGetEventByIdHandler({
    apiBaseUrl: "http://127.0.0.1:3001",
    getEventById
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3001");

    if (requestUrl.pathname === "/events") {
      await postEventsHandler(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/events/")) {
      await getEventByIdHandler(request, response);
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const createResponse = await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      service: "payment-service",
      type: "transaction",
      payload: {
        amount: 200,
        user_id: "1245"
      }
    })
  });
  const createdEvent = (await createResponse.json()) as {
    event_id: string;
  };
  const getResponse = await fetch(`${baseUrl}/events/${createdEvent.event_id}`);
  const fetchedEvent = await getResponse.json();

  console.log("POST /events");
  console.log(JSON.stringify(createdEvent, null, 2));
  console.log("");
  console.log(`GET /events/${createdEvent.event_id}`);
  console.log(JSON.stringify(fetchedEvent, null, 2));

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
