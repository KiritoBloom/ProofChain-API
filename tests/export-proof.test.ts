import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { computeTransparencyCheckpoint } from "../src/lib/crypto/transparency-anchor.js";
import { exportProofToFile } from "../src/lib/verification/export.js";

describe("proof export", () => {
  it("writes a proof file with optional public key", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "proofchain-export-test-"));
    const outputPath = join(tempDir, "proof.json");
    const anchor = {
      schema_version: 1 as const,
      anchor_id: "anc_000001_test",
      block_id: "blk_001",
      block_sequence: 1,
      merkle_root:
        "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      signature: "signature",
      algorithm: "Ed25519" as const,
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      prev_anchor_hash: null,
      anchored_at: "2026-03-12T00:06:00.000Z",
      created_at: "2026-03-12T00:06:00.000Z"
    };

    await exportProofToFile({
      outputPath,
      proof: {
        schema_version: 1,
        event_id: "evt_002",
        event_hash:
          "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
        block_id: "blk_001",
        merkle_root:
          "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
        algorithm: "Ed25519",
        key_id: "main-2026-01",
        signature: "signature",
        sealed_at: "2026-03-12T00:05:00.000Z",
        proof: [
          {
            position: "left",
            hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699"
          }
        ],
        anchor: {
          ...anchor,
          checkpoint: computeTransparencyCheckpoint(anchor)
        }
      },
      publicKey: "-----BEGIN PUBLIC KEY-----demo-----END PUBLIC KEY-----"
    });

    expect(JSON.parse(await readFile(outputPath, "utf8"))).toEqual({
      schema_version: 1,
      event_id: "evt_002",
      event_hash:
        "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
      block_id: "blk_001",
      merkle_root:
        "81bbdbd23d0a3b8cb6c8423d94b0c4cc032b3a893898dd364f2a8dc82bc9f322",
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      signature: "signature",
      sealed_at: "2026-03-12T00:05:00.000Z",
      proof: [
        {
          position: "left",
          hash: "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699"
        }
      ],
      anchor: {
        ...anchor,
        checkpoint: computeTransparencyCheckpoint(anchor)
      },
      public_key: "-----BEGIN PUBLIC KEY-----demo-----END PUBLIC KEY-----"
    });

    await rm(tempDir, { recursive: true, force: true });
  });
});
