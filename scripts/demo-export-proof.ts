import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { generateEd25519KeyPairPem } from "../src/lib/crypto/ed25519.js";
import { buildMerkleTree } from "../src/lib/merkle/tree.js";
import { serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";
import { exportProofToFile } from "../src/lib/verification/export.js";
import { createEd25519BlockSigner } from "../src/modules/blocks/service.js";
import { createGetProofByEventIdService } from "../src/modules/proofs/service.js";
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
    return this.events
      .filter((event) => event.block_id === blockId)
      .sort((left, right) => left.received_at.localeCompare(right.received_at) || left.event_id.localeCompare(right.event_id))
      .map((event) => structuredClone(event));
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
      event_id: "evt_export_001",
      schema_version: 1,
      service: "auth-service",
      type: "login-attempt",
      payload: { success: true, user_id: "user-100" },
      received_at: "2026-03-12T00:00:01.000Z",
      hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
      block_id: "blk_export_001",
      created_at: "2026-03-12T00:00:01.000Z",
      updated_at: "2026-03-12T00:05:00.000Z"
    },
    {
      event_id: "evt_export_002",
      schema_version: 1,
      service: "payment-service",
      type: "transaction",
      payload: { amount: 200, user_id: "1245" },
      received_at: "2026-03-12T00:00:02.000Z",
      hash: "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      block_id: "blk_export_001",
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
  const proof = await createGetProofByEventIdService({
    blockRepository: new DemoBlockRepository([
      {
        block_id: "blk_export_001",
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
    ]),
    eventRepository: new DemoEventRepository(events)
  })("evt_export_002");
  const tempDir = await mkdtemp(join(tmpdir(), "proofchain-export-"));
  const outputPath = join(tempDir, "proof-export.json");

  await exportProofToFile({
    outputPath,
    proof,
    publicKey: publicKeyPem
  });

  console.log("Exported proof file");
  console.log(await readFile(outputPath, "utf8"));

  await rm(tempDir, { recursive: true, force: true });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
