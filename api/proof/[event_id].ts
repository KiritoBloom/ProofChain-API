import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createGetProofHandler } from "../../src/modules/proofs/http-handlers.js";
import { createGetProofByEventIdService } from "../../src/modules/proofs/service.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const getProofHandler = createGetProofHandler({
    apiBaseUrl: env.API_BASE_URL,
    getProofByEventId: createGetProofByEventIdService({
      blockRepository: persistenceContext.blockRepository,
      eventRepository: persistenceContext.eventRepository
    }),
    logger
  });

  await getProofHandler(request, response);
}
