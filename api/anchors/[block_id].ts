import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createGetAnchorByBlockHandler } from "../../src/modules/anchors/http-handlers.js";
import { createGetAnchorByBlockIdService } from "../../src/modules/anchors/service.js";

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const getAnchorByBlockHandler = createGetAnchorByBlockHandler({
    apiBaseUrl: env.API_BASE_URL,
    getAnchorByBlockId: createGetAnchorByBlockIdService({
      anchorRepository: persistenceContext.anchorRepository
    }),
    logger
  });

  await getAnchorByBlockHandler(request, response);
}
