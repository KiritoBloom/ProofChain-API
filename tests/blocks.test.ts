import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createBlockCreationHandler } from "../src/modules/blocks/http-handlers.js";
import { createBlockSealingService } from "../src/modules/blocks/service.js";
import type {
  BlockRecord,
  BlockRepository,
  EventRecord,
  EventRepository
} from "../src/types/persistence.js";

class InMemoryEventRepository implements EventRepository {
  constructor(private readonly events = new Map<string, EventRecord>()) {}

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
      .sort(
        (left, right) =>
          left.received_at.localeCompare(right.received_at) ||
          left.event_id.localeCompare(right.event_id)
      )
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
      .sort(
        (left, right) =>
          left.received_at.localeCompare(right.received_at) ||
          left.event_id.localeCompare(right.event_id)
      )
      .map((event) => structuredClone(event));
  }
}

class InMemoryBlockRepository implements BlockRepository {
  private readonly blocks = new Map<string, BlockRecord>();

  async createBlock(record: BlockRecord): Promise<BlockRecord> {
    this.blocks.set(record.block_id, structuredClone(record));
    return record;
  }

  async getBlockById(blockId: string): Promise<BlockRecord | null> {
    const blockRecord = this.blocks.get(blockId);
    return blockRecord ? structuredClone(blockRecord) : null;
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

const baseEvents: EventRecord[] = [
  {
    event_id: "evt_002",
    schema_version: 1,
    service: "payment-service",
    type: "transaction",
    payload: { amount: 200, user_id: "1245" },
    received_at: "2026-03-12T00:00:02.000Z",
    hash: "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
    block_id: null,
    created_at: "2026-03-12T00:00:02.000Z",
    updated_at: "2026-03-12T00:00:02.000Z"
  },
  {
    event_id: "evt_001",
    schema_version: 1,
    service: "auth-service",
    type: "login-attempt",
    payload: { success: true, user_id: "user-100" },
    received_at: "2026-03-12T00:00:01.000Z",
    hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
    block_id: null,
    created_at: "2026-03-12T00:00:01.000Z",
    updated_at: "2026-03-12T00:00:01.000Z"
  },
  {
    event_id: "evt_003",
    schema_version: 1,
    service: "orders-service",
    type: "status-change",
    payload: { order_id: "ord_200", status: "confirmed" },
    received_at: "2026-03-12T00:00:03.000Z",
    hash: "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
    block_id: null,
    created_at: "2026-03-12T00:00:03.000Z",
    updated_at: "2026-03-12T00:00:03.000Z"
  }
];

describe("block sealing", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.close();
      }
    }
  });

  it("seals unsealed events into an ordered block", async () => {
    const eventRepository = new InMemoryEventRepository();
    const blockRepository = new InMemoryBlockRepository();

    for (const eventRecord of baseEvents) {
      await eventRepository.createEvent(eventRecord);
    }

    const sealBlock = createBlockSealingService({
      blockRepository,
      eventRepository,
      now: () => "2026-03-12T00:05:00.000Z",
      createBlockId: () => "blk_test_001",
      signBlockPayload: (payload) => `signed:${payload}`,
      signingKeyId: "main-2026-01"
    });

    const result = await sealBlock({ max_events: 2 });

    expect(result).toEqual({
      block_id: "blk_test_001",
      sequence: 1,
      event_count: 2,
      merkle_root:
        "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      signature:
        'signed:{"algorithm":"Ed25519","key_id":"main-2026-01","merkle_root":"81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322","schema_version":1,"sealed_at":"2026-03-12T00:05:00.000Z"}',
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      anchor: null
    });

    expect(await blockRepository.getBlockById("blk_test_001")).toEqual({
      block_id: "blk_test_001",
      sequence: 1,
      event_ids: ["evt_001", "evt_002"],
      hashes: [
        "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
        "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89"
      ],
      merkle_root:
        "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      signature:
        'signed:{"algorithm":"Ed25519","key_id":"main-2026-01","merkle_root":"81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322","schema_version":1,"sealed_at":"2026-03-12T00:05:00.000Z"}',
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      created_at: "2026-03-12T00:05:00.000Z"
    });

    expect((await eventRepository.getEventById("evt_001"))?.block_id).toBe(
      "blk_test_001"
    );
    expect(
      (await eventRepository.getEventById("evt_003"))?.block_id
    ).toBeNull();
  });

  it("prevents empty block creation", async () => {
    const sealBlock = createBlockSealingService({
      blockRepository: new InMemoryBlockRepository(),
      eventRepository: new InMemoryEventRepository(),
      signBlockPayload: () => "signed",
      signingKeyId: "main-2026-01"
    });

    await expect(sealBlock()).rejects.toThrow("No unsealed events");
  });

  it("supports scheduled GET requests for Vercel cron compatibility", async () => {
    const eventRepository = new InMemoryEventRepository();
    const blockRepository = new InMemoryBlockRepository();
    await eventRepository.createEvent(baseEvents[0]);

    const handler = createBlockCreationHandler({
      sealBlock: createBlockSealingService({
        blockRepository,
        eventRepository,
        now: () => "2026-03-12T00:05:00.000Z",
        createBlockId: () => "blk_test_cron",
        signBlockPayload: (payload) => `signed:${payload}`,
        signingKeyId: "main-2026-01"
      }),
      blockSealToken: "manual-secret"
    });

    const server = await startBlockServer(handler);
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/blocks/create`, {
      method: "GET",
      headers: {
        "user-agent": "vercel-cron/1.0"
      }
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      block_id: "blk_test_cron",
      sequence: 1,
      event_count: 1,
      merkle_root:
        "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      signature:
        'signed:{"algorithm":"Ed25519","key_id":"main-2026-01","merkle_root":"24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89","schema_version":1,"sealed_at":"2026-03-12T00:05:00.000Z"}',
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      anchor: null
    });
  });

  it("requires a cron secret when configured", async () => {
    const eventRepository = new InMemoryEventRepository();
    const blockRepository = new InMemoryBlockRepository();
    await eventRepository.createEvent(baseEvents[0]);

    const handler = createBlockCreationHandler({
      sealBlock: createBlockSealingService({
        blockRepository,
        eventRepository,
        now: () => "2026-03-12T00:05:00.000Z",
        createBlockId: () => "blk_test_cron_secret",
        signBlockPayload: (payload) => `signed:${payload}`,
        signingKeyId: "main-2026-01"
      }),
      cronSecret: "secret-value"
    });

    const server = await startBlockServer(handler);
    servers.push(server);

    const missingSecretResponse = await fetch(
      `${server.baseUrl}/blocks/create`,
      {
        method: "GET",
        headers: {
          "user-agent": "vercel-cron/1.0"
        }
      }
    );

    expect(missingSecretResponse.status).toBe(400);
    expect(await missingSecretResponse.json()).toEqual({
      error: "Scheduled block creation requires a valid cron secret."
    });

    const validSecretResponse = await fetch(`${server.baseUrl}/blocks/create`, {
      method: "GET",
      headers: {
        authorization: "Bearer secret-value",
        "user-agent": "vercel-cron/1.0"
      }
    });

    expect(validSecretResponse.status).toBe(201);
  });

  it("rejects manual GET requests to the create route", async () => {
    const handler = createBlockCreationHandler({
      sealBlock: async () => {
        throw new Error("should not run");
      }
    });
    const server = await startBlockServer(handler);
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/blocks/create`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "GET /blocks/create is reserved for scheduled invocations."
    });
  });

  it("requires a bearer token for manual POST block sealing", async () => {
    const eventRepository = new InMemoryEventRepository();
    const blockRepository = new InMemoryBlockRepository();
    await eventRepository.createEvent(baseEvents[0]);

    const handler = createBlockCreationHandler({
      sealBlock: createBlockSealingService({
        blockRepository,
        eventRepository,
        now: () => "2026-03-12T00:05:00.000Z",
        createBlockId: () => "blk_test_manual_auth",
        signBlockPayload: (payload) => `signed:${payload}`,
        signingKeyId: "main-2026-01"
      }),
      blockSealToken: "manual-secret"
    });
    const server = await startBlockServer(handler);
    servers.push(server);

    const unauthorized = await fetch(`${server.baseUrl}/blocks/create`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ max_events: 1 })
    });

    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({
      error: "A valid bearer token is required for manual block sealing."
    });

    const authorized = await fetch(`${server.baseUrl}/blocks/create`, {
      method: "POST",
      headers: {
        authorization: "Bearer manual-secret",
        "content-type": "application/json"
      },
      body: JSON.stringify({ max_events: 1 })
    });

    expect(authorized.status).toBe(201);
  });

  it("anchors new blocks when an anchor service is configured", async () => {
    const eventRepository = new InMemoryEventRepository();
    const blockRepository = new InMemoryBlockRepository();
    await eventRepository.createEvent(baseEvents[0]);

    const sealBlock = createBlockSealingService({
      blockRepository,
      eventRepository,
      now: () => "2026-03-12T00:05:00.000Z",
      createBlockId: () => "blk_test_anchor",
      signBlockPayload: (payload) => `signed:${payload}`,
      signingKeyId: "main-2026-01",
      anchorBlock: async (block) => ({
        schema_version: 1,
        anchor_id: "anc_000001_test",
        block_id: block.block_id,
        block_sequence: block.sequence,
        merkle_root: block.merkle_root,
        signature: block.signature,
        algorithm: block.algorithm,
        key_id: block.key_id,
        sealed_at: block.sealed_at,
        prev_anchor_hash: null,
        checkpoint:
          "b4e3665117032d4b67d2d0f15710ca2f7925745f5675c4600af6684b87f0d793",
        anchored_at: "2026-03-12T00:05:01.000Z",
        created_at: "2026-03-12T00:05:01.000Z"
      })
    });

    await expect(sealBlock({ max_events: 1 })).resolves.toMatchObject({
      block_id: "blk_test_anchor",
      anchor: {
        anchor_id: "anc_000001_test",
        block_id: "blk_test_anchor",
        block_sequence: 1,
        prev_anchor_hash: null
      }
    });
  });
});

async function startBlockServer(
  handler: (request: RequestLike, response: ResponseLike) => Promise<void>
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3003");

    if (requestUrl.pathname === "/blocks/create") {
      await handler(request, response);
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

type RequestLike = Parameters<typeof createBlockCreationHandler>[0] extends {
  sealBlock: never;
}
  ? never
  : Parameters<ReturnType<typeof createBlockCreationHandler>>[0];
type ResponseLike = Parameters<
  ReturnType<typeof createBlockCreationHandler>
>[1];
