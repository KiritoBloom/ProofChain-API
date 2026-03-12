import type { IncomingMessage, ServerResponse } from "node:http";

import { MethodNotAllowedError, sendErrorResponse } from "../../lib/http/errors.js";
import { sendJson } from "../../lib/http/send-json.js";
import { listBlocksQuerySchema, listBlocksResponseSchema } from "../../lib/validation/blocks.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import type { BlockRecord, BlockRepository } from "../../types/persistence.js";

export function createListBlocksService(dependencies: { blockRepository: BlockRepository }) {
  return async function listBlocks(limit: number): Promise<{ blocks: BlockRecord[]; count: number }> {
    const blocks = await dependencies.blockRepository.listBlocks(limit);

    return {
      blocks,
      count: blocks.length
    };
  };
}

export function createListBlocksHandler(dependencies: {
  apiBaseUrl: string;
  listBlocks: (limit: number) => Promise<{ blocks: BlockRecord[]; count: number }>;
  logger?: StructuredLogger;
}) {
  return async function listBlocksHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      assertMethod(request, "GET");

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const query = listBlocksQuerySchema.parse({
        limit: requestUrl.searchParams.get("limit") ?? undefined
      });
      const result = await dependencies.listBlocks(query.limit);

      dependencies.logger?.info("Blocks listed", {
        count: result.count,
        limit: query.limit
      });

      sendJson(response, 200, listBlocksResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Block listing failed", {
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
