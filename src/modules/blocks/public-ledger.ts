import type { IncomingMessage, ServerResponse } from "node:http";

import { MethodNotAllowedError, sendErrorResponse } from "../../lib/http/errors.js";
import { enforceRateLimit } from "../../lib/http/rate-limit.js";
import { sendJson } from "../../lib/http/send-json.js";
import { listBlocksQuerySchema, publicListBlocksResponseSchema } from "../../lib/validation/blocks.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import type { BlockRecord, BlockRepository, PublicBlockRecord } from "../../types/persistence.js";

export function createListBlocksService(dependencies: { blockRepository: BlockRepository }) {
  return async function listBlocks(limit: number): Promise<{ blocks: PublicBlockRecord[]; count: number }> {
    const blocks = await dependencies.blockRepository.listBlocks(limit);

    return {
      blocks: blocks.map(toPublicBlockRecord),
      count: blocks.length
    };
  };
}

export function createListBlocksHandler(dependencies: {
  apiBaseUrl: string;
  listBlocks: (limit: number) => Promise<{ blocks: PublicBlockRecord[]; count: number }>;
  logger?: StructuredLogger;
}) {
  return async function listBlocksHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      assertMethod(request, "GET");
      enforceRateLimit(request, response, {
        keyPrefix: "blocks:list",
        windowMs: 60_000,
        maxRequests: 60
      });

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const query = listBlocksQuerySchema.parse({
        limit: requestUrl.searchParams.get("limit") ?? undefined
      });
      const result = await dependencies.listBlocks(query.limit);

      dependencies.logger?.info("Blocks listed", {
        count: result.count,
        limit: query.limit
      });

      sendJson(response, 200, publicListBlocksResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Block listing failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

function toPublicBlockRecord(block: BlockRecord): PublicBlockRecord {
  return {
    block_id: block.block_id,
    sequence: block.sequence,
    event_count: block.event_ids.length,
    merkle_root: block.merkle_root,
    signature: block.signature,
    algorithm: block.algorithm,
    key_id: block.key_id,
    sealed_at: block.sealed_at,
    created_at: block.created_at
  };
}

function assertMethod(request: IncomingMessage, expectedMethod: string): void {
  if (request.method === expectedMethod) {
    return;
  }

  throw new MethodNotAllowedError([expectedMethod]);
}
