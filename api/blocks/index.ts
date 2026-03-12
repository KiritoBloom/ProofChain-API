import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createListBlocksHandler, createListBlocksService } from "../../src/modules/blocks/public-ledger.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const listBlocksHandler = createListBlocksHandler({
    apiBaseUrl: env.API_BASE_URL,
    listBlocks: createListBlocksService({
      blockRepository: persistenceContext.blockRepository
    }),
    logger
  });

  await listBlocksHandler(request, response);
}
