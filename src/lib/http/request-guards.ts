import type { IncomingMessage, ServerResponse } from "node:http";

import { BadRequestError } from "./errors.js";
import { enforceRateLimit } from "./rate-limit.js";

const JSON_BODY_LIMIT_BYTES = 256_000;

export function guardEventIngestionRequest(request: IncomingMessage, response: ServerResponse): void {
  assertJsonContentType(request, ["POST"]);
  assertContentLengthWithinLimit(request, JSON_BODY_LIMIT_BYTES);
  enforceRateLimit(request, response, {
    keyPrefix: "events",
    windowMs: 60_000,
    maxRequests: 30
  });
}

export function guardProofVerificationRequest(request: IncomingMessage, response: ServerResponse): void {
  assertJsonContentType(request, ["POST"]);
  assertContentLengthWithinLimit(request, JSON_BODY_LIMIT_BYTES);
  enforceRateLimit(request, response, {
    keyPrefix: "verify",
    windowMs: 60_000,
    maxRequests: 60
  });
}

export function guardBlockCreationRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.method === "POST") {
    assertJsonContentType(request, ["POST"]);
    assertContentLengthWithinLimit(request, 64_000);
  }

  enforceRateLimit(request, response, {
    keyPrefix: "blocks:create",
    windowMs: 60_000,
    maxRequests: 10
  });
}

function assertJsonContentType(request: IncomingMessage, methods: string[]): void {
  if (!request.method || !methods.includes(request.method)) {
    return;
  }

  const contentType = request.headers["content-type"];

  if (typeof contentType === "string" && contentType.toLowerCase().includes("application/json")) {
    return;
  }

  throw new BadRequestError("Request content-type must be application/json.");
}

function assertContentLengthWithinLimit(request: IncomingMessage, maxBytes: number): void {
  const contentLength = request.headers["content-length"];

  if (!contentLength) {
    return;
  }

  const parsed = Number(contentLength);

  if (Number.isFinite(parsed) && parsed <= maxBytes) {
    return;
  }

  throw new BadRequestError(`Request content-length exceeds ${maxBytes} bytes.`);
}
