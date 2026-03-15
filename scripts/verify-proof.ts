#!/usr/bin/env node

import { resolve } from "node:path";

import { verifyProofFile } from "../src/lib/verification/cli.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command !== "verify") {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const proofFilePath = args[1];

  if (!proofFilePath) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const publicKeyFlagIndex = args.findIndex((arg) => arg === "--public-key");
  const publicKey =
    publicKeyFlagIndex >= 0 ? args[publicKeyFlagIndex + 1] : undefined;
  const result = await verifyProofFile({
    proofFilePath: resolve(proofFilePath),
    publicKey
  });

  console.log(
    JSON.stringify(
      {
        valid: result.valid,
        ...(typeof result.anchorValid === "boolean"
          ? {
              anchor_valid: result.anchorValid
            }
          : {}),
        ...(result.proof.anchor
          ? {
              anchor_checkpoint: result.proof.anchor.checkpoint
            }
          : {}),
        event_id: result.proof.event_id,
        block_id: result.proof.block_id,
        merkle_root: result.proof.merkle_root
      },
      null,
      2
    )
  );

  if (!result.valid) {
    process.exitCode = 1;
  }
}

function printUsage(): void {
  console.log(
    "Usage: proofchain verify <proof-file.json> [--public-key <PEM>]"
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
