import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { generateEd25519KeyPairPem } from "../src/lib/crypto/ed25519.js";
import { buildMerkleTree } from "../src/lib/merkle/tree.js";
import { serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";
import { createEd25519BlockSigner } from "../src/modules/blocks/service.js";
import { createGetProofHandler, createVerifyProofHandler } from "../src/modules/proofs/http-handlers.js";
import { createGetProofByEventIdService, createVerifyProofService } from "../src/modules/proofs/service.js";
import type { ProofEnvelope } from "../src/types/integrity.js";
import type { BlockRecord, BlockRepository, EventRecord, EventRepository } from "../src/types/persistence.js";

class InMemoryEventRepository implements EventRepository {
  constructor(private readonly events: EventRecord[]) {}

  async createEvent(record: EventRecord): Promise<EventRecord> {
    this.events.push(structuredClone(record));
    return record;
  }

  async getEventById(eventId: string): Promise<EventRecord | null> {
    const eventRecord = this.events.find((event) => event.event_id === eventId);
    return eventRecord ? structuredClone(eventRecord) : null;
  }

  async listUnsealedEvents(limit: number): Promise<EventRecord[]> {
    return this.events.filter((event) => event.block_id === null).slice(0, limit).map((event) => structuredClone(event));
  }

  async markEventsSealed(eventIds: string[], blockId: string): Promise<number> {
    let modifiedCount = 0;

    for (const event of this.events) {
      if (eventIds.includes(event.event_id) && event.block_id === null) {
        event.block_id = blockId;
        modifiedCount += 1;
      }
    }

    return modifiedCount;
  }

  async getEventsByBlockId(blockId: string): Promise<EventRecord[]> {
    return this.events
      .filter((event) => event.block_id === blockId)
      .sort((left, right) => left.received_at.localeCompare(right.received_at) || left.event_id.localeCompare(right.event_id))
      .map((event) => structuredClone(event));
  }
}

class InMemoryBlockRepository implements BlockRepository {
  constructor(private readonly blocks: BlockRecord[]) {}

  async createBlock(record: BlockRecord): Promise<BlockRecord> {
    this.blocks.push(structuredClone(record));
    return record;
  }

  async getBlockById(blockId: string): Promise<BlockRecord | null> {
    const blockRecord = this.blocks.find((block) => block.block_id === blockId);
    return blockRecord ? structuredClone(blockRecord) : null;
  }

  async getLatestBlockSequence(): Promise<number | null> {
    return this.blocks.length === 0 ? null : Math.max(...this.blocks.map((block) => block.sequence));
  }

  async listBlocks(limit: number): Promise<BlockRecord[]> {
    return [...this.blocks]
      .sort((left, right) => right.sequence - left.sequence)
      .slice(0, limit)
      .map((block) => structuredClone(block));
  }
}

describe("proof retrieval and verification", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.close();
      }
    }
  });

  it("returns a proof and verifies it successfully", async () => {
    const fixture = await createProofFixture();
    const proof = await createGetProofByEventIdService({
      blockRepository: fixture.blockRepository,
      eventRepository: fixture.eventRepository
    })("evt_002");

    expect(proof).toEqual({
      schema_version: 1,
      event_id: "evt_002",
      event_hash: "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      block_id: "blk_001",
      merkle_root: "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      signature: fixture.signature,
      sealed_at: "2026-03-12T00:05:00.000Z",
      proof: [
        {
          position: "left",
          hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699"
        }
      ]
    });

    await expect(
      createVerifyProofService()({
        ...proof,
        public_key: fixture.publicKeyPem
      })
    ).resolves.toEqual({ valid: true });
  });

  it("returns false for tampered proofs", async () => {
    const fixture = await createProofFixture();
    const proof = await createGetProofByEventIdService({
      blockRepository: fixture.blockRepository,
      eventRepository: fixture.eventRepository
    })("evt_002");

    await expect(
      createVerifyProofService()({
        ...proof,
        merkle_root: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        public_key: fixture.publicKeyPem
      })
    ).resolves.toEqual({ valid: false });
  });

  it("rejects malformed verification input with a bad request error", async () => {
    const fixture = await createSingleEventProofFixture();

    await expect(
      createVerifyProofService()({
        schema_version: 1,
        event_id: "evt_single_001",
        event_hash: "3f53dca7dc9f725905066db21b0c296ed1c4c0c84419c02b27ced7a461e63226",
        block_id: "blk_single_001",
        merkle_root: "3f53dca7dc9f725905066db21b0c296ed1c4c0c84419c02b27ced7a461e63226",
        algorithm: "Ed25519",
        key_id: "main-dev-2026-03",
        signature: fixture.signature,
        sealed_at: "2026-03-12T22:17:43.980Z",
        proof: [],
        public_key: "not-a-public-key"
      })
    ).rejects.toThrow("Expected an Ed25519 public key.");
  });

  it("returns an empty proof for a single-event block and still verifies it", async () => {
    const fixture = await createSingleEventProofFixture();
    const proof = await createGetProofByEventIdService({
      blockRepository: fixture.blockRepository,
      eventRepository: fixture.eventRepository
    })("evt_single_001");

    expect(proof).toEqual({
      schema_version: 1,
      event_id: "evt_single_001",
      event_hash: "3f53dca7dc9f725905066db21b0c296ed1c4c0c84419c02b27ced7a461e63226",
      block_id: "blk_single_001",
      merkle_root: "3f53dca7dc9f725905066db21b0c296ed1c4c0c84419c02b27ced7a461e63226",
      algorithm: "Ed25519",
      key_id: "main-dev-2026-03",
      signature: fixture.signature,
      sealed_at: "2026-03-12T22:17:43.980Z",
      proof: []
    });

    await expect(
      createVerifyProofService()({
        ...proof,
        public_key: fixture.publicKeyPem
      })
    ).resolves.toEqual({ valid: true });
  });

  it("exposes proof and verify HTTP handlers", async () => {
    const fixture = await createProofFixture();
    const server = await startProofServer({
      getProofByEventId: createGetProofByEventIdService({
        blockRepository: fixture.blockRepository,
        eventRepository: fixture.eventRepository
      }),
      verifyProof: createVerifyProofService()
    });
    servers.push(server);

    const proofResponse = await fetch(`${server.baseUrl}/proof/evt_002`);
    expect(proofResponse.status).toBe(200);
    const proof = await proofResponse.json();

    const verifyResponse = await fetch(`${server.baseUrl}/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...proof,
        public_key: fixture.publicKeyPem
      })
    });

    expect(verifyResponse.status).toBe(200);
    expect(await verifyResponse.json()).toEqual({ valid: true });
  });

  it("rejects proof requests for unsealed events", async () => {
    const eventRepository = new InMemoryEventRepository([
      {
        event_id: "evt_010",
        schema_version: 1,
        service: "auth-service",
        type: "login-attempt",
        payload: { success: true, user_id: "user-100" },
        received_at: "2026-03-12T00:00:01.000Z",
        hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
        block_id: null,
        created_at: "2026-03-12T00:00:01.000Z",
        updated_at: "2026-03-12T00:00:01.000Z"
      }
    ]);

    await expect(
      createGetProofByEventIdService({
        blockRepository: new InMemoryBlockRepository([]),
        eventRepository
      })("evt_010")
    ).rejects.toThrow("Event is not sealed");
  });
});

async function createProofFixture() {
  const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
  const events: EventRecord[] = [
    {
      event_id: "evt_001",
      schema_version: 1,
      service: "auth-service",
      type: "login-attempt",
      payload: { success: true, user_id: "user-100" },
      received_at: "2026-03-12T00:00:01.000Z",
      hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
      block_id: "blk_001",
      created_at: "2026-03-12T00:00:01.000Z",
      updated_at: "2026-03-12T00:05:00.000Z"
    },
    {
      event_id: "evt_002",
      schema_version: 1,
      service: "payment-service",
      type: "transaction",
      payload: { amount: 200, user_id: "1245" },
      received_at: "2026-03-12T00:00:02.000Z",
      hash: "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      block_id: "blk_001",
      created_at: "2026-03-12T00:00:02.000Z",
      updated_at: "2026-03-12T00:05:00.000Z"
    }
  ];
  const merkleRoot = buildMerkleTree(events.map((event) => event.hash)).root;
  const signature = createEd25519BlockSigner(privateKeyPem)(
    serializeSignedBlockPayload({
      key_id: "main-2026-01",
      merkle_root: merkleRoot,
      sealed_at: "2026-03-12T00:05:00.000Z"
    })
  );
  const blockRepository = new InMemoryBlockRepository([
    {
      block_id: "blk_001",
      sequence: 1,
      event_ids: events.map((event) => event.event_id),
      hashes: events.map((event) => event.hash),
      merkle_root: merkleRoot,
      signature,
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      created_at: "2026-03-12T00:05:00.000Z"
    }
  ]);

  return {
    blockRepository,
    eventRepository: new InMemoryEventRepository(events),
    publicKeyPem,
    signature
  };
}

async function createSingleEventProofFixture() {
  const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
  const event: EventRecord = {
    event_id: "evt_single_001",
    schema_version: 1,
    service: "payment-service",
    type: "transaction",
    payload: { amount: 125, status: "captured", user_id: "1245" },
    received_at: "2026-03-12T22:17:30.000Z",
    hash: "3f53dca7dc9f725905066db21b0c296ed1c4c0c84419c02b27ced7a461e63226",
    block_id: "blk_single_001",
    created_at: "2026-03-12T22:17:30.000Z",
    updated_at: "2026-03-12T22:17:43.980Z"
  };
  const merkleRoot = buildMerkleTree([event.hash]).root;
  const signature = createEd25519BlockSigner(privateKeyPem)(
    serializeSignedBlockPayload({
      key_id: "main-dev-2026-03",
      merkle_root: merkleRoot,
      sealed_at: "2026-03-12T22:17:43.980Z"
    })
  );

  return {
    blockRepository: new InMemoryBlockRepository([
      {
        block_id: "blk_single_001",
        sequence: 1,
        event_ids: [event.event_id],
        hashes: [event.hash],
        merkle_root: merkleRoot,
        signature,
        algorithm: "Ed25519",
        key_id: "main-dev-2026-03",
        sealed_at: "2026-03-12T22:17:43.980Z",
        created_at: "2026-03-12T22:17:43.980Z"
      }
    ]),
    eventRepository: new InMemoryEventRepository([event]),
    publicKeyPem,
    signature
  };
}

async function startProofServer(dependencies: {
  getProofByEventId: (eventId: string) => Promise<unknown>;
  verifyProof: (input: ProofEnvelope & { public_key: string }) => Promise<{ valid: boolean }>;
}): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const getProofHandler = createGetProofHandler({
    apiBaseUrl: "http://127.0.0.1:3004",
    getProofByEventId: dependencies.getProofByEventId as never
  });
  const verifyProofHandler = createVerifyProofHandler({
    verifyProof: dependencies.verifyProof as never
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3004");

    if (requestUrl.pathname.startsWith("/proof/")) {
      await getProofHandler(request, response);
      return;
    }

    if (requestUrl.pathname === "/verify") {
      await verifyProofHandler(request, response);
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
