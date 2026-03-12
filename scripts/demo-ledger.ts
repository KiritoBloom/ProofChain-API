import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { createListBlocksHandler, createListBlocksService } from "../src/modules/blocks/public-ledger.js";
import type { BlockRecord, BlockRepository } from "../src/types/persistence.js";

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
  const blockRepository = new DemoBlockRepository([
    {
      block_id: "blk_demo_002",
      sequence: 2,
      event_ids: ["evt_demo_003"],
      hashes: ["1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28"],
      merkle_root: "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
      signature: "demo-signature-2",
      algorithm: "Ed25519",
      key_id: "demo-2026-01",
      sealed_at: "2026-03-12T00:10:00.000Z",
      created_at: "2026-03-12T00:10:00.000Z"
    },
    {
      block_id: "blk_demo_001",
      sequence: 1,
      event_ids: ["evt_demo_001", "evt_demo_002"],
      hashes: [
        "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
        "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89"
      ],
      merkle_root: "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      signature: "demo-signature-1",
      algorithm: "Ed25519",
      key_id: "demo-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      created_at: "2026-03-12T00:05:00.000Z"
    }
  ]);
  const listBlocksHandler = createListBlocksHandler({
    apiBaseUrl: "http://127.0.0.1:3005",
    listBlocks: createListBlocksService({ blockRepository })
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3005");

    if (requestUrl.pathname === "/blocks") {
      await listBlocksHandler(request, response);
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${baseUrl}/blocks?limit=2`);

  console.log("GET /blocks?limit=2");
  console.log(JSON.stringify(await response.json(), null, 2));

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
