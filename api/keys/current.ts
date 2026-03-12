import type { IncomingMessage, ServerResponse } from "node:http";

import { loadEnv } from "../../src/lib/config/env.js";
import { createLogger } from "../../src/lib/logging/logger.js";
import { createGetCurrentKeyHandler } from "../../src/modules/verification/public-key.js";

export default async function handler(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const env = loadEnv();

  if (!env.SIGNING_PUBLIC_KEY || !env.SIGNING_KEY_ID) {
    throw new Error("SIGNING_PUBLIC_KEY and SIGNING_KEY_ID are required to publish verification metadata.");
  }

  const getCurrentKeyHandler = createGetCurrentKeyHandler({
    publicKey: env.SIGNING_PUBLIC_KEY,
    keyId: env.SIGNING_KEY_ID,
    logger: createLogger(env)
  });

  await getCurrentKeyHandler(request, response);
}
