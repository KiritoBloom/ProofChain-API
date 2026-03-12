import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createGetEventByIdHandler, createPostEventsHandler } from "../src/modules/events/http-handlers.js";
import { createEventIngestionService, createGetEventByIdService } from "../src/modules/events/service.js";
import type { EventRecord, EventRepository } from "../src/types/persistence.js";

class InMemoryEventRepository implements EventRepository {
  private readonly events = new Map<string, EventRecord>();

  async createEvent(record: EventRecord): Promise<EventRecord> {
    this.events.set(record.event_id, structuredClone(record));
    return record;
  }

  async getEventById(eventId: string): Promise<EventRecord | null> {
    const eventRecord = this.events.get(eventId);

    return eventRecord ? structuredClone(eventRecord) : null;
  }

  async listUnsealedEvents(limit: number): Promise<EventRecord[]> {
    return [...this.events.values()]
      .filter((event) => event.block_id === null)
      .sort((left, right) => left.received_at.localeCompare(right.received_at))
      .slice(0, limit)
      .map((event) => structuredClone(event));
  }

  async markEventsSealed(eventIds: string[], blockId: string): Promise<number> {
    let modifiedCount = 0;

    for (const eventId of eventIds) {
      const eventRecord = this.events.get(eventId);

      if (!eventRecord || eventRecord.block_id !== null) {
        continue;
      }

      this.events.set(eventId, {
        ...eventRecord,
        block_id: blockId,
        updated_at: "2026-03-12T00:10:00.000Z"
      });
      modifiedCount += 1;
    }

    return modifiedCount;
  }

  async getEventsByBlockId(blockId: string): Promise<EventRecord[]> {
    return [...this.events.values()]
      .filter((event) => event.block_id === blockId)
      .sort((left, right) => left.received_at.localeCompare(right.received_at) || left.event_id.localeCompare(right.event_id))
      .map((event) => structuredClone(event));
  }
}

describe("events API", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();

      if (server) {
        await server.close();
      }
    }
  });

  it("creates and retrieves an event", async () => {
    const server = await startEventApiServer();
    servers.push(server);

    const createResponse = await fetch(`${server.baseUrl}/events`, {
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

    expect(createResponse.status).toBe(201);

    const createdEvent = (await createResponse.json()) as {
      event_id: string;
      hash: string;
      received_at: string;
    };

    expect(createdEvent).toEqual({
      event_id: "evt_test_001",
      hash: "7f11573aa34834921911add16b7a02d75ab4c15c342868c135573aa3c767e285",
      received_at: "2026-03-12T00:00:00.000Z"
    });

    const getResponse = await fetch(`${server.baseUrl}/events/${createdEvent.event_id}`);

    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      event_id: "evt_test_001",
      schema_version: 1,
      service: "payment-service",
      type: "transaction",
      payload: {
        amount: 200,
        user_id: "1245"
      },
      received_at: "2026-03-12T00:00:00.000Z",
      hash: "7f11573aa34834921911add16b7a02d75ab4c15c342868c135573aa3c767e285",
      block_id: null,
      created_at: "2026-03-12T00:00:00.000Z",
      updated_at: "2026-03-12T00:00:00.000Z"
    });
  });

  it("rejects invalid event ingestion requests", async () => {
    const server = await startEventApiServer();
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        service: "payment-service",
        payload: {
          amount: 200
        }
      })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request",
      issues: [
        {
          message: "Required",
          path: "type"
        }
      ]
    });
  });

  it("returns 404 when an event does not exist", async () => {
    const server = await startEventApiServer();
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/events/evt_missing`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Event not found: evt_missing"
    });
  });

  it("rejects unsupported methods", async () => {
    const server = await startEventApiServer();
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/events`, {
      method: "GET"
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(await response.json()).toEqual({
      error: "Method Not Allowed"
    });
  });
});

async function startEventApiServer(): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const repository = new InMemoryEventRepository();
  const postEventsHandler = createPostEventsHandler({
    ingestEvent: createEventIngestionService({
      eventRepository: repository,
      createEventId: () => "evt_test_001",
      now: () => "2026-03-12T00:00:00.000Z"
    })
  });
  const getEventByIdHandler = createGetEventByIdHandler({
    apiBaseUrl: "http://127.0.0.1:3001",
    getEventById: createGetEventByIdService({
      eventRepository: repository
    })
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

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
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
  };
}
