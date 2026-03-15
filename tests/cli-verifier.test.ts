import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { generateEd25519KeyPairPem } from "../src/lib/crypto/ed25519.js";
import { computeTransparencyCheckpoint } from "../src/lib/crypto/transparency-anchor.js";
import { buildMerkleTree } from "../src/lib/merkle/tree.js";
import { serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";
import { verifyProofFile } from "../src/lib/verification/cli.js";
import { createEd25519BlockSigner } from "../src/modules/blocks/service.js";

describe("CLI verifier", () => {
  it("verifies a proof file that includes the public key", async () => {
    const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
    const merkleRoot = buildMerkleTree([
      "442066b23e8685ce4ff87d9078e6ad9090009f7c3ce9a4dfac3d0e6014f9f699",
      "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89"
    ]).root;
    const signature = createEd25519BlockSigner(privateKeyPem)(
      serializeSignedBlockPayload({
        key_id: "main-2026-01",
        merkle_root: merkleRoot,
        sealed_at: "2026-03-12T00:05:00.000Z"
      })
    );
    const anchor = {
      schema_version: 1 as const,
      anchor_id: "anc_000001_test",
      block_id: "blk_001",
      block_sequence: 1,
      merkle_root: merkleRoot,
      signature,
      algorithm: "Ed25519" as const,
      key_id: "main-2026-01",
      sealed_at: "2026-03-12T00:05:00.000Z",
      prev_anchor_hash: null,
      anchored_at: "2026-03-12T00:06:00.000Z",
      created_at: "2026-03-12T00:06:00.000Z"
    };
    const tempDir = await mkdtemp(join(tmpdir(), "proofchain-cli-test-"));
    const proofFilePath = join(tempDir, "proof.json");

    await writeFile(
      proofFilePath,
      JSON.stringify(
        {
          schema_version: 1,
          event_id: "evt_002",
          event_hash:
            "24453df4d1e7f7c5f7b8d05cc63e4d8fd7d5b3d7d0f7ddfdb8421d9d38ff4a89",
          block_id: "blk_001",
          merkle_root: merkleRoot,
          algorithm: "Ed25519",
          key_id: "main-2026-01",
          signature,
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
          public_key: publicKeyPem
        },
        null,
        2
      ),
      "utf8"
    );

    await expect(verifyProofFile({ proofFilePath })).resolves.toMatchObject({
      valid: true,
      anchorValid: true,
      proof: {
        anchor: {
          anchor_id: "anc_000001_test"
        }
      },
      publicKey: publicKeyPem
    });

    await rm(tempDir, { recursive: true, force: true });
  });

  it("requires a public key when the proof file does not include one", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "proofchain-cli-test-"));
    const proofFilePath = join(tempDir, "proof.json");

    await writeFile(
      proofFilePath,
      JSON.stringify(
        {
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
          proof: []
        },
        null,
        2
      ),
      "utf8"
    );

    await expect(verifyProofFile({ proofFilePath })).rejects.toThrow(
      "A public key is required"
    );

    await rm(tempDir, { recursive: true, force: true });
  });
});
