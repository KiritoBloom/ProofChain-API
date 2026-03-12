import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../src/lib/config/env.js";
import { createLogger } from "../src/lib/logging/logger.js";
import { createVerifyProofHandler } from "../src/modules/proofs/http-handlers.js";
import { createVerifyProofService } from "../src/modules/proofs/service.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();
  const verifyProofHandler = createVerifyProofHandler({
    verifyProof: createVerifyProofService(),
    logger: createLogger(env)
  });

  await verifyProofHandler(request, response);
}
