import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { generateEd25519KeyPairPem } from "../src/lib/crypto/ed25519.js";
import { createBlockCreationHandler } from "../src/modules/blocks/http-handlers.js";
import { createBlockSealingService, createEd25519BlockSigner } from "../src/modules/blocks/service.js";
import { createPostEventsHandler } from "../src/modules/events/http-handlers.js";
import { createEventIngestionService } from "../src/modules/events/service.js";
import type { BlockRecord, BlockRepository, EventRecord, EventRepository } from "../src/types/persistence.js";

class DemoEventRepository implements EventRepository {
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
      .sort((left, right) => left.received_at.localeCompare(right.received_at) || left.event_id.localeCompare(right.event_id))
      .slice(0, limit)
      .map((event) => structuredClone(event));
  }

  async markEventsSealed(eventIds: string[], blockId: string): Promise<number> {
    let modifiedCount = 0;

    for (const eventId of eventIds) {
      const existing = this.events.get(eventId);

      if (!existing || existing.block_id !== null) {
        continue;
      }

      this.events.set(eventId, {
        ...existing,
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

class DemoBlockRepository implements BlockRepository {
  private readonly blocks = new Map<string, BlockRecord>();

  async createBlock(record: BlockRecord): Promise<BlockRecord> {
    this.blocks.set(record.block_id, structuredClone(record));
    return record;
  }

  async getBlockById(blockId: string): Promise<BlockRecord | null> {
    const block = this.blocks.get(blockId);
    return block ? structuredClone(block) : null;
  }

  async getLatestBlockSequence(): Promise<number | null> {
    const sequences = [...this.blocks.values()].map((block) => block.sequence);
    return sequences.length === 0 ? null : Math.max(...sequences);
  }

  async listBlocks(limit: number): Promise<BlockRecord[]> {
    return [...this.blocks.values()]
      .sort((left, right) => right.sequence - left.sequence)
      .slice(0, limit)
      .map((block) => structuredClone(block));
  }
}

async function main(): Promise<void> {
  const eventRepository = new DemoEventRepository();
  const blockRepository = new DemoBlockRepository();
  const { privateKeyPem } = generateEd25519KeyPairPem();
  let eventCounter = 0;
  const postEventsHandler = createPostEventsHandler({
    ingestEvent: createEventIngestionService({
      eventRepository,
      createEventId: () => {
        eventCounter += 1;
        return `evt_demo_${String(eventCounter).padStart(3, "0")}`;
      },
      now: () => `2026-03-12T00:00:0${eventCounter}.000Z`
    })
  });
  const blockCreationHandler = createBlockCreationHandler({
    sealBlock: createBlockSealingService({
      blockRepository,
      eventRepository,
      now: () => "2026-03-12T00:05:00.000Z",
      createBlockId: (sequence) => `blk_demo_${String(sequence).padStart(3, "0")}`,
      signBlockPayload: createEd25519BlockSigner(privateKeyPem),
      signingKeyId: "demo-2026-01"
    })
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3002");

    if (requestUrl.pathname === "/events") {
      await postEventsHandler(request, response);
      return;
    }

    if (requestUrl.pathname === "/blocks/create") {
      await blockCreationHandler(request, response);
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));

  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service: "auth-service",
      type: "login-attempt",
      payload: { success: true, user_id: "user-100" }
    })
  });

  await fetch(`${baseUrl}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      service: "payment-service",
      type: "transaction",
      payload: { amount: 200, user_id: "1245" }
    })
  });

  const blockResponse = await fetch(`${baseUrl}/blocks/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      max_events: 10
    })
  });

  console.log("POST /blocks/create");
  console.log(JSON.stringify(await blockResponse.json(), null, 2));

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
