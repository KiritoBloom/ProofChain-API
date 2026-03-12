import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { createListBlocksHandler, createListBlocksService } from "../src/modules/blocks/public-ledger.js";
import type { BlockRecord, BlockRepository } from "../src/types/persistence.js";

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

describe("public block ledger", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.close();
      }
    }
  });

  it("lists blocks in descending sequence order", async () => {
    const repository = new InMemoryBlockRepository(blockFixtures());
    const result = await createListBlocksService({ blockRepository: repository })(2);

    expect(result).toEqual({
      count: 2,
      blocks: [blockFixtures()[1], blockFixtures()[0]]
    });
  });

  it("exposes the GET /blocks handler", async () => {
    const server = await startLedgerServer(new InMemoryBlockRepository(blockFixtures()));
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/blocks?limit=2`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      count: 2,
      blocks: [blockFixtures()[1], blockFixtures()[0]]
    });
  });

  it("rejects unsupported methods", async () => {
    const server = await startLedgerServer(new InMemoryBlockRepository(blockFixtures()));
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/blocks`, {
      method: "POST"
    });

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});

function blockFixtures(): BlockRecord[] {
  return [
    {
      block_id: "blk_001",
      sequence: 1,
      event_ids: ["evt_001", "evt_002"],
      hashes: [
        "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
        "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89"
      ],
      merkle_root: "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      signature: "signature-1",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      created_at: "2026-03-12T00:05:00.000Z"
    },
    {
      block_id: "blk_002",
      sequence: 2,
      event_ids: ["evt_003"],
      hashes: ["1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28"],
      merkle_root: "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
      signature: "signature-2",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:10:00.000Z",
      created_at: "2026-03-12T00:10:00.000Z"
    }
  ];
}

async function startLedgerServer(
  repository: BlockRepository
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const handler = createListBlocksHandler({
    apiBaseUrl: "http://127.0.0.1:3005",
    listBlocks: createListBlocksService({ blockRepository: repository })
  });
  const server = createServer(async (request, response) => {
    if ((request.url ?? "").startsWith("/blocks")) {
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
