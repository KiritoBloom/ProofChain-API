import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { generateEd25519KeyPairPem } from "../src/lib/crypto/ed25519.js";
import { buildMerkleTree } from "../src/lib/merkle/tree.js";
import { serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";
import { createEd25519BlockSigner } from "../src/modules/blocks/service.js";
import { createGetProofHandler, createVerifyProofHandler } from "../src/modules/proofs/http-handlers.js";
import { createGetProofByEventIdService, createVerifyProofService } from "../src/modules/proofs/service.js";
import type { BlockRecord, BlockRepository, EventRecord, EventRepository } from "../src/types/persistence.js";

class DemoEventRepository implements EventRepository {
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
    return this.events.filter((event) => event.block_id === blockId).map((event) => structuredClone(event));
  }
}

class DemoBlockRepository implements BlockRepository {
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

async function main(): Promise<void> {
  const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
  const events: EventRecord[] = [
    {
      event_id: "evt_demo_001",
      schema_version: 1,
      service: "auth-service",
      type: "login-attempt",
      payload: { success: true, user_id: "user-100" },
      received_at: "2026-03-12T00:00:01.000Z",
      hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
      block_id: "blk_demo_001",
      created_at: "2026-03-12T00:00:01.000Z",
      updated_at: "2026-03-12T00:05:00.000Z"
    },
    {
      event_id: "evt_demo_002",
      schema_version: 1,
      service: "payment-service",
      type: "transaction",
      payload: { amount: 200, user_id: "1245" },
      received_at: "2026-03-12T00:00:02.000Z",
      hash: "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      block_id: "blk_demo_001",
      created_at: "2026-03-12T00:00:02.000Z",
      updated_at: "2026-03-12T00:05:00.000Z"
    }
  ];
  const merkleRoot = buildMerkleTree(events.map((event) => event.hash)).root;
  const signature = createEd25519BlockSigner(privateKeyPem)(
    serializeSignedBlockPayload({
      key_id: "demo-2026-01",
      merkle_root: merkleRoot,
      sealed_at: "2026-03-12T00:05:00.000Z"
    })
  );
  const blockRepository = new DemoBlockRepository([
    {
      block_id: "blk_demo_001",
      sequence: 1,
      event_ids: events.map((event) => event.event_id),
      hashes: events.map((event) => event.hash),
      merkle_root: merkleRoot,
      signature,
      algorithm: "Ed25519",
      key_id: "demo-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      created_at: "2026-03-12T00:05:00.000Z"
    }
  ]);
  const eventRepository = new DemoEventRepository(events);
  const getProofHandler = createGetProofHandler({
    apiBaseUrl: "http://127.0.0.1:3004",
    getProofByEventId: createGetProofByEventIdService({
      blockRepository,
      eventRepository
    })
  });
  const verifyProofHandler = createVerifyProofHandler({
    verifyProof: createVerifyProofService()
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
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const proofResponse = await fetch(`${baseUrl}/proof/evt_demo_002`);
  const proof = await proofResponse.json();
  const verifyResponse = await fetch(`${baseUrl}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      ...proof,
      public_key: publicKeyPem
    })
  });

  console.log("GET /proof/evt_demo_002");
  console.log(JSON.stringify(proof, null, 2));
  console.log("");
  console.log("POST /verify");
  console.log(JSON.stringify(await verifyResponse.json(), null, 2));

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
