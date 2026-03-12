import type { IncomingMessage, ServerResponse } from "node:http";

import { MethodNotAllowedError, sendErrorResponse } from "../../lib/http/errors.js";
import { sendJson } from "../../lib/http/send-json.js";
import { currentKeyResponseSchema } from "../../lib/validation/keys.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";

export function createGetCurrentKeyHandler(dependencies: {
  publicKey: string;
  keyId: string;
  logger?: StructuredLogger;
}) {
  return async function getCurrentKeyHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      if (request.method !== "GET") {
        throw new MethodNotAllowedError(["GET"]);
      }

      const payload = currentKeyResponseSchema.parse({
        algorithm: "Ed25519",
        key_id: dependencies.keyId,
        public_key: dependencies.publicKey
      });

      dependencies.logger?.info("Published current verification key", {
        key_id: dependencies.keyId
      });

      sendJson(response, 200, payload);
    } catch (error: unknown) {
      dependencies.logger?.warn("Current key request failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}
