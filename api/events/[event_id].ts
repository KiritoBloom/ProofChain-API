import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../../src/lib/db/runtime.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createGetEventByIdHandler } from "../../src/modules/events/http-handlers.js";
import { createGetEventByIdService } from "../../src/modules/events/service.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const getEventByIdHandler = createGetEventByIdHandler({
    apiBaseUrl: env.API_BASE_URL,
    getEventById: createGetEventByIdService({
      eventRepository: persistenceContext.eventRepository
    }),
    logger
  });

  await getEventByIdHandler(request, response);
}
