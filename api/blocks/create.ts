import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createTransparencyAnchorService } from "../../src/modules/anchors/service.js";
import { createBlockCreationHandler } from "../../src/modules/blocks/http-handlers.js";
import {
  createBlockSealingService,
  createEd25519BlockSigner
} from "../../src/modules/blocks/service.js";

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);

  if (!env.SIGNING_PRIVATE_KEY || !env.SIGNING_KEY_ID) {
    throw new Error(
      "SIGNING_PRIVATE_KEY and SIGNING_KEY_ID are required for block sealing."
    );
  }

  const anchorBlock =
    env.TRANSPARENCY_AUTO_ANCHOR === "true"
      ? createTransparencyAnchorService({
          anchorRepository: persistenceContext.anchorRepository
        })
      : undefined;

  const blockCreationHandler = createBlockCreationHandler({
    sealBlock: createBlockSealingService({
      blockRepository: persistenceContext.blockRepository,
      eventRepository: persistenceContext.eventRepository,
      signBlockPayload: createEd25519BlockSigner(env.SIGNING_PRIVATE_KEY),
      signingKeyId: env.SIGNING_KEY_ID,
      anchorBlock
    }),
    logger,
    cronSecret: env.CRON_SECRET,
    blockSealToken: env.BLOCK_SEAL_TOKEN
  });

  await blockCreationHandler(request, response);
}
