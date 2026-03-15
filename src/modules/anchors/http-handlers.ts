import type { IncomingMessage, ServerResponse } from "node:http";

import {
  MethodNotAllowedError,
  NotFoundError,
  sendErrorResponse
} from "../../lib/http/errors.js";
import { enforceRateLimit } from "../../lib/http/rate-limit.js";
import { sendJson } from "../../lib/http/send-json.js";
import {
  getAnchorByBlockParamsSchema,
  listAnchorsQuerySchema,
  publicAnchorRecordResponseSchema,
  publicListAnchorsResponseSchema
} from "../../lib/validation/anchors.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import type { PublicAnchorRecord } from "../../types/persistence.js";

export function createListAnchorsHandler(dependencies: {
  apiBaseUrl: string;
  listAnchors: (
    limit: number
  ) => Promise<{ anchors: PublicAnchorRecord[]; count: number }>;
  logger?: StructuredLogger;
}) {
  return async function listAnchorsHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      assertMethod(request, "GET");
      enforceRateLimit(request, response, {
        keyPrefix: "anchors:list",
        windowMs: 60_000,
        maxRequests: 60
      });

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const query = listAnchorsQuerySchema.parse({
        limit: requestUrl.searchParams.get("limit") ?? undefined
      });
      const result = await dependencies.listAnchors(query.limit);

      dependencies.logger?.info("Transparency anchors listed", {
        count: result.count,
        limit: query.limit
      });

      sendJson(response, 200, publicListAnchorsResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Transparency anchor listing failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

export function createGetAnchorByBlockHandler(dependencies: {
  apiBaseUrl: string;
  getAnchorByBlockId: (blockId: string) => Promise<PublicAnchorRecord | null>;
  logger?: StructuredLogger;
}) {
  return async function getAnchorByBlockHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      assertMethod(request, "GET");
      enforceRateLimit(request, response, {
        keyPrefix: "anchors:get",
        windowMs: 60_000,
        maxRequests: 60
      });

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
      const block_id = pathSegments[pathSegments.length - 1] ?? "";
      const params = getAnchorByBlockParamsSchema.parse({ block_id });
      const anchor = await dependencies.getAnchorByBlockId(params.block_id);

      if (!anchor) {
        throw new NotFoundError(
          `Transparency anchor not found for block: ${params.block_id}`
        );
      }

      dependencies.logger?.info("Transparency anchor fetched", {
        anchor_id: anchor.anchor_id,
        block_id: anchor.block_id
      });

      sendJson(response, 200, publicAnchorRecordResponseSchema.parse(anchor));
    } catch (error: unknown) {
      dependencies.logger?.warn("Transparency anchor fetch failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

function assertMethod(request: IncomingMessage, expectedMethod: string): void {
  if (request.method === expectedMethod) {
    return;
  }

  throw new MethodNotAllowedError([expectedMethod]);
}
