import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { computeTransparencyCheckpoint } from "../src/lib/crypto/transparency-anchor.js";
import {
  createGetAnchorByBlockHandler,
  createListAnchorsHandler
} from "../src/modules/anchors/http-handlers.js";
import {
  createGetAnchorByBlockIdService,
  createListAnchorsService
} from "../src/modules/anchors/service.js";
import type {
  AnchorRecord,
  AnchorRepository
} from "../src/types/persistence.js";

class DemoAnchorRepository implements AnchorRepository {
  constructor(private readonly anchors: AnchorRecord[]) {}

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

async function main(): Promise<void> {
  const repository = new DemoAnchorRepository(createDemoAnchors());
  const listAnchorsHandler = createListAnchorsHandler({
    apiBaseUrl: "http://127.0.0.1:3007",
    listAnchors: createListAnchorsService({ anchorRepository: repository })
  });
  const getAnchorByBlockHandler = createGetAnchorByBlockHandler({
    apiBaseUrl: "http://127.0.0.1:3007",
    getAnchorByBlockId: createGetAnchorByBlockIdService({
      anchorRepository: repository
    })
  });

  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1:3007");

    if (requestUrl.pathname === "/anchors") {
      await listAnchorsHandler(request, response);
      return;
    }

    if (requestUrl.pathname.startsWith("/anchors/")) {
      await getAnchorByBlockHandler(request, response);
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  console.log("GET /anchors?limit=2");
  console.log(
    JSON.stringify(
      await (await fetch(`${baseUrl}/anchors?limit=2`)).json(),
      null,
      2
    )
  );
  console.log("GET /anchors/blk_demo_001");
  console.log(
    JSON.stringify(
      await (await fetch(`${baseUrl}/anchors/blk_demo_001`)).json(),
      null,
      2
    )
  );

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

function createDemoAnchors(): AnchorRecord[] {
  const firstAnchor = {
    schema_version: 1 as const,
    anchor_id: "anc_demo_001",
    block_id: "blk_demo_001",
    block_sequence: 1,
    merkle_root:
      "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
    signature: "demo-signature-1",
    algorithm: "Ed25519" as const,
    key_id: "demo-2026-01",
    sealed_at: "2026-03-12T00:05:00.000Z",
    prev_anchor_hash: null,
    anchored_at: "2026-03-12T00:06:00.000Z",
    created_at: "2026-03-12T00:06:00.000Z"
  };
  const firstCheckpoint = computeTransparencyCheckpoint(firstAnchor);

  return [
    {
      ...firstAnchor,
      checkpoint: firstCheckpoint
    },
    {
      schema_version: 1,
      anchor_id: "anc_demo_002",
      block_id: "blk_demo_002",
      block_sequence: 2,
      merkle_root:
        "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
      signature: "demo-signature-2",
      algorithm: "Ed25519",
      key_id: "demo-2026-01",
      sealed_at: "2026-03-12T00:10:00.000Z",
      prev_anchor_hash: firstCheckpoint,
      checkpoint: computeTransparencyCheckpoint({
        algorithm: "Ed25519",
        key_id: "demo-2026-01",
        block_id: "blk_demo_002",
        block_sequence: 2,
        merkle_root:
          "1f54656502d08d1e5239cb51c08078265c535437925782f3774db3747f738e28",
        signature: "demo-signature-2",
        sealed_at: "2026-03-12T00:10:00.000Z",
        prev_anchor_hash: firstCheckpoint,
        anchored_at: "2026-03-12T00:11:00.000Z"
      }),
      anchored_at: "2026-03-12T00:11:00.000Z",
      created_at: "2026-03-12T00:11:00.000Z"
    }
  ];
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
