import type { IncomingMessage, ServerResponse } from "node:http";

import { assertBearerToken } from "../../lib/http/auth.js";
import { BadRequestError, MethodNotAllowedError, sendErrorResponse } from "../../lib/http/errors.js";
import { readJsonBody } from "../../lib/http/read-json-body.js";
import { guardBlockCreationRequest } from "../../lib/http/request-guards.js";
import { sendJson } from "../../lib/http/send-json.js";
import { createBlockRequestSchema, createBlockResponseSchema } from "../../lib/validation/blocks.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import type { SealBlockInput, SealBlockResult } from "./service.js";

export function createBlockCreationHandler(dependencies: {
  sealBlock: (input: SealBlockInput) => Promise<SealBlockResult>;
  logger?: StructuredLogger;
  cronSecret?: string;
  blockSealToken?: string;
}) {
  return async function blockCreationHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      guardBlockCreationRequest(request, response);
      const input = await parseBlockCreateInput(request, dependencies.cronSecret, dependencies.blockSealToken);
      const result = await dependencies.sealBlock(input);

      dependencies.logger?.info("Block sealed", {
        block_id: result.block_id,
        event_count: result.event_count,
        sequence: result.sequence
      });

      sendJson(response, 201, createBlockResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Block sealing failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

async function parseBlockCreateInput(
  request: IncomingMessage,
  cronSecret?: string,
  blockSealToken?: string
): Promise<SealBlockInput> {
  if (request.method === "POST") {
    assertBearerToken(request, blockSealToken, "A valid bearer token is required for manual block sealing.");
    const contentLength = request.headers["content-length"];

    if (!contentLength || contentLength === "0") {
      return {};
    }

    return createBlockRequestSchema.parse(await readJsonBody(request));
  }

  if (request.method === "GET") {
    assertScheduledRequest(request, cronSecret);
    return {};
  }

  throw new MethodNotAllowedError(["GET", "POST"]);
}

function assertScheduledRequest(request: IncomingMessage, cronSecret?: string): void {
  const userAgent = request.headers["user-agent"] ?? "";

  if (typeof userAgent === "string" && userAgent.startsWith("vercel-cron/")) {
    if (!cronSecret) {
      return;
    }

    const authorization = request.headers.authorization;

    if (authorization === `Bearer ${cronSecret}`) {
      return;
    }

    throw new BadRequestError("Scheduled block creation requires a valid cron secret.");
  }

  throw new BadRequestError("GET /blocks/create is reserved for scheduled invocations.");
}
