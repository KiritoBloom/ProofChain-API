import type { ServerResponse } from "node:http";

import { ZodError } from "zod";

import { sendJson } from "./send-json.js";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly headers: Record<string, string> = {}
  ) {
    super(message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}

export class MethodNotAllowedError extends HttpError {
  constructor(allowedMethods: string[]) {
    super(405, "Method Not Allowed", {
      allow: allowedMethods.join(", ")
    });
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message, {
      "www-authenticate": 'Bearer realm="proofchain"'
    });
  }
}

export class PayloadTooLargeError extends HttpError {
  constructor(maxBytes: number) {
    super(413, `Request body exceeds ${maxBytes} bytes.`);
  }
}

export function sendErrorResponse(response: ServerResponse, error: unknown): void {
  if (error instanceof ZodError) {
    sendJson(response, 400, {
      error: "Invalid request",
      issues: error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path.join(".")
      }))
    });
    return;
  }

  if (error instanceof HttpError) {
    for (const [header, value] of Object.entries(error.headers)) {
      response.setHeader(header, value);
    }

    sendJson(response, error.statusCode, {
      error: error.message
    });
    return;
  }

  sendJson(response, 500, {
    error: "Internal Server Error"
  });
}
