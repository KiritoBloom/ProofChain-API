import type { IncomingMessage, ServerResponse } from "node:http";

import {
  MethodNotAllowedError,
  sendErrorResponse
} from "../../lib/http/errors.js";
import { enforceRateLimit } from "../../lib/http/rate-limit.js";
import { readJsonBody } from "../../lib/http/read-json-body.js";
import { guardProofVerificationRequest } from "../../lib/http/request-guards.js";
import { sendJson } from "../../lib/http/send-json.js";
import {
  getProofParamsSchema,
  proofEnvelopeSchema,
  verifyProofRequestSchema,
  verifyProofResponseSchema
} from "../../lib/validation/proofs.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import type { ProofEnvelope } from "../../types/integrity.js";

export function createGetProofHandler(dependencies: {
  apiBaseUrl: string;
  getProofByEventId: (eventId: string) => Promise<ProofEnvelope>;
  logger?: StructuredLogger;
}) {
  return async function getProofHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      assertMethod(request, "GET");
      enforceRateLimit(request, response, {
        keyPrefix: "proof:get",
        windowMs: 60_000,
        maxRequests: 60
      });

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
      const event_id = pathSegments[pathSegments.length - 1] ?? "";
      const params = getProofParamsSchema.parse({ event_id });
      const proof = await dependencies.getProofByEventId(params.event_id);

      dependencies.logger?.info("Proof fetched", {
        event_id: params.event_id,
        block_id: proof.block_id
      });

      sendJson(response, 200, proofEnvelopeSchema.parse(proof));
    } catch (error: unknown) {
      dependencies.logger?.warn("Proof fetch failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

export function createVerifyProofHandler(dependencies: {
  verifyProof: (
    input: ProofEnvelope & { public_key: string }
  ) => Promise<{ valid: boolean; anchor_valid?: boolean }>;
  logger?: StructuredLogger;
}) {
  return async function verifyProofHandler(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    try {
      assertMethod(request, "POST");
      guardProofVerificationRequest(request, response);

      const input = verifyProofRequestSchema.parse(await readJsonBody(request));
      const result = await dependencies.verifyProof(input);

      dependencies.logger?.info("Proof verified", {
        event_id: input.event_id,
        valid: result.valid
      });

      sendJson(response, 200, verifyProofResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Proof verification failed", {
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
