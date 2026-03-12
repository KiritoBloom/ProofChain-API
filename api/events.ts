import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../src/lib/config/env.js";
import { getProofChainPersistenceContext } from "../src/lib/db/runtime.js";
import { createLogger } from "../src/lib/logging/logger.js";
import { createPostEventsHandler } from "../src/modules/events/http-handlers.js";
import { createEventIngestionService } from "../src/modules/events/service.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);
  const persistenceContext = await getProofChainPersistenceContext(env);
  const postEventsHandler = createPostEventsHandler({
    ingestEvent: createEventIngestionService({
      eventRepository: persistenceContext.eventRepository
    }),
    logger
  });

  await postEventsHandler(request, response);
}
