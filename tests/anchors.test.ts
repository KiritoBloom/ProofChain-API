import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { computeTransparencyCheckpoint } from "../src/lib/crypto/transparency-anchor.js";
import {
  createGetAnchorByBlockHandler,
  createListAnchorsHandler
} from "../src/modules/anchors/http-handlers.js";
import {
  createGetAnchorByBlockIdService,
  createListAnchorsService,
  createTransparencyAnchorService
} from "../src/modules/anchors/service.js";
import type {
  AnchorRecord,
  AnchorRepository,
  BlockRecord
} from "../src/types/persistence.js";

class InMemoryAnchorRepository implements AnchorRepository {
  constructor(private readonly anchors: AnchorRecord[] = []) {}

  async createAnchor(record: AnchorRecord): Promise<AnchorRecord> {
    this.anchors.push(structuredClone(record));
    return record;
  }

  async getAnchorByBlockId(blockId: string): Promise<AnchorRecord | null> {
    const anchor = this.anchors.find((entry) => entry.block_id === blockId);
    return anchor ? structuredClone(anchor) : null;
  }

  async getLatestAnchor(): Promise<AnchorRecord | null> {
    if (this.anchors.length === 0) {
      return null;
    }

    return structuredClone(
      [...this.anchors].sort(
        (left, right) => right.block_sequence - left.block_sequence
      )[0]
    );
  }

  async listAnchors(limit: number): Promise<AnchorRecord[]> {
    return [...this.anchors]
      .sort((left, right) => right.block_sequence - left.block_sequence)
      .slice(0, limit)
      .map((anchor) => structuredClone(anchor));
  }
}

describe("transparency anchors", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.close();
      }
    }
  });

  it("creates deterministic chained transparency anchors", async () => {
    const anchorRepository = new InMemoryAnchorRepository();
    const service = createTransparencyAnchorService({
      anchorRepository,
      now: () => "2026-03-12T00:06:00.000Z",
      createAnchorId: (block) =>
        `anc_${String(block.sequence).padStart(6, "0")}_test`
    });

    const firstAnchor = await service(blockFixtures()[0]);
    const secondAnchor = await service(blockFixtures()[1]);

    expect(firstAnchor).toMatchObject({
      anchor_id: "anc_000001_test",
      block_id: "blk_001",
      block_sequence: 1,
      prev_anchor_hash: null
    });
    expect(firstAnchor.checkpoint).toBe(
      computeTransparencyCheckpoint({
        algorithm: "Ed25519",
        key_id: "main-2026-01",
        block_id: "blk_001",
        block_sequence: 1,
        merkle_root:
          "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
        signature: "signature-1",
        sealed_at: "2026-03-12T00:05:00.000Z",
        prev_anchor_hash: null,
        anchored_at: "2026-03-12T00:06:00.000Z"
      })
    );
    expect(secondAnchor.prev_anchor_hash).toBe(firstAnchor.checkpoint);
  });

  it("lists and fetches anchors over HTTP", async () => {
    const anchorRepository = new InMemoryAnchorRepository(anchorFixtures());
    const server = await startAnchorServer(anchorRepository);
    servers.push(server);

    const listResponse = await fetch(`${server.baseUrl}/anchors?limit=2`);
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toMatchObject({
      count: 2,
      anchors: [
        {
          anchor_id: "anc_000002_test",
          block_id: "blk_002",
          block_sequence: 2
        },
        { anchor_id: "anc_000001_test", block_id: "blk_001", block_sequence: 1 }
      ]
    });

    const getResponse = await fetch(`${server.baseUrl}/anchors/blk_001`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toMatchObject({
      anchor_id: "anc_000001_test",
      block_id: "blk_001",
      checkpoint: anchorFixtures()[0].checkpoint
    });
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
      merkle_root:
        "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
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
      hashes: [
        "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28"
      ],
      merkle_root:
        "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
      signature: "signature-2",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:10:00.000Z",
      created_at: "2026-03-12T00:10:00.000Z"
    }
  ];
}

function anchorFixtures(): AnchorRecord[] {
  const first = {
    schema_version: 1 as const,
    anchor_id: "anc_000001_test",
    block_id: "blk_001",
    block_sequence: 1,
    merkle_root:
      "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
    signature: "signature-1",
    algorithm: "Ed25519" as const,
    key_id: "main-2026-01",
    sealed_at: "2026-03-12T00:05:00.000Z",
    prev_anchor_hash: null,
    anchored_at: "2026-03-12T00:06:00.000Z",
    created_at: "2026-03-12T00:06:00.000Z"
  };

  const firstCheckpoint = computeTransparencyCheckpoint(first);

  return [
    {
      ...first,
      checkpoint: firstCheckpoint
    },
    {
      schema_version: 1,
      anchor_id: "anc_000002_test",
      block_id: "blk_002",
      block_sequence: 2,
      merkle_root:
        "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
      signature: "signature-2",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:10:00.000Z",
      prev_anchor_hash: firstCheckpoint,
      checkpoint: computeTransparencyCheckpoint({
        algorithm: "Ed25519",
        key_id: "main-2026-01",
        block_id: "blk_002",
        block_sequence: 2,
        merkle_root:
          "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
        signature: "signature-2",
        sealed_at: "2026-03-12T00:10:00.000Z",
        prev_anchor_hash: firstCheckpoint,
        anchored_at: "2026-03-12T00:11:00.000Z"
      }),
      anchored_at: "2026-03-12T00:11:00.000Z",
      created_at: "2026-03-12T00:11:00.000Z"
    }
  ];
}

async function startAnchorServer(
  repository: AnchorRepository
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const listHandler = createListAnchorsHandler({
    apiBaseUrl: "http://127.0.0.1:3006",
    listAnchors: createListAnchorsService({ anchorRepository: repository })
  });
  const getHandler = createGetAnchorByBlockHandler({
    apiBaseUrl: "http://127.0.0.1:3006",
    getAnchorByBlockId: createGetAnchorByBlockIdService({
      anchorRepository: repository
    })
  });
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3006");

    if (requestUrl.pathname === "/anchors") {
      await listHandler(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/anchors/")) {
      await getHandler(request, response);
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
