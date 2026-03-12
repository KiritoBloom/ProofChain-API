import type { IncomingMessage, ServerResponse } from "node:http";

import { MethodNotAllowedError, sendErrorResponse } from "../../lib/http/errors.js";
import { assertBearerToken } from "../../lib/http/auth.js";
import { enforceRateLimit } from "../../lib/http/rate-limit.js";
import { readJsonBody } from "../../lib/http/read-json-body.js";
import { guardEventIngestionRequest } from "../../lib/http/request-guards.js";
import { sendJson } from "../../lib/http/send-json.js";
import type { StructuredLogger } from "../../lib/logging/logger.js";
import {
  createEventRequestSchema,
  createEventResponseSchema,
  eventRecordSchema,
  getEventParamsSchema,
  publicEventRecordSchema
} from "../../lib/validation/events.js";
import type { EventRecord, PublicEventRecord } from "../../types/persistence.js";
import type { IngestEventInput, IngestEventResult } from "./service.js";

export function createPostEventsHandler(dependencies: {
  ingestEvent: (input: IngestEventInput) => Promise<IngestEventResult>;
  logger?: StructuredLogger;
}) {
  return async function postEventsHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      assertMethod(request, "POST");
      guardEventIngestionRequest(request, response);

      const body = await readJsonBody(request);
      const input = createEventRequestSchema.parse(body);
      const result = await dependencies.ingestEvent(input);

      dependencies.logger?.info("Event ingested", {
        event_id: result.event_id,
        service: input.service,
        type: input.type
      });

      sendJson(response, 201, createEventResponseSchema.parse(result));
    } catch (error: unknown) {
      dependencies.logger?.warn("Event ingestion failed", {
        error_message: error instanceof Error ? error.message : "Unknown error"
      });
      sendErrorResponse(response, error);
    }
  };
}

export function createGetEventByIdHandler(dependencies: {
  apiBaseUrl: string;
  getEventById: (eventId: string) => Promise<EventRecord>;
  redactEventRecord?: (eventRecord: EventRecord) => PublicEventRecord;
  eventReadToken?: string;
  logger?: StructuredLogger;
}) {
  return async function getEventByIdHandler(request: IncomingMessage, response: ServerResponse): Promise<void> {
    try {
      assertMethod(request, "GET");
      enforceRateLimit(request, response, {
        keyPrefix: "events:get",
        windowMs: 60_000,
        maxRequests: 60
      });

      const requestUrl = new URL(request.url ?? "/", dependencies.apiBaseUrl);
      const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
      const event_id = pathSegments[pathSegments.length - 1] ?? "";
      const params = getEventParamsSchema.parse({ event_id });
      const eventRecord = await dependencies.getEventById(params.event_id);
      const isAuthorized = dependencies.eventReadToken
        ? assertAuthorizedEventRead(request, dependencies.eventReadToken)
        : false;
      const responseBody = isAuthorized || !dependencies.redactEventRecord
        ? eventRecordSchema.parse(eventRecord)
        : publicEventRecordSchema.parse(dependencies.redactEventRecord(eventRecord));

      dependencies.logger?.info("Event fetched", {
        event_id: params.event_id,
        block_id: eventRecord.block_id,
        payload_redacted: !isAuthorized
      });

      sendJson(response, 200, responseBody);
    } catch (error: unknown) {
      dependencies.logger?.warn("Event fetch failed", {
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

function assertAuthorizedEventRead(request: IncomingMessage, eventReadToken: string): boolean {
  try {
    assertBearerToken(request, eventReadToken, "A valid bearer token is required to read full event payloads.");
    return true;
  } catch {
    return false;
  }
}
