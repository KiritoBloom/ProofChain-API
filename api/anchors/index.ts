import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createListAnchorsHandler } from "../../src/modules/anchors/http-handlers.js";
import { createListAnchorsService } from "../../src/modules/anchors/service.js";

export default async function handler(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const listAnchorsHandler = createListAnchorsHandler({
    apiBaseUrl: env.API_BASE_URL,
    listAnchors: createListAnchorsService({
      anchorRepository: persistenceContext.anchorRepository
    }),
    logger
  });

  await listAnchorsHandler(request, response);
}
