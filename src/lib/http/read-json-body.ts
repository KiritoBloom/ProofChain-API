import type { IncomingMessage } from "node:http";

import { BadRequestError, PayloadTooLargeError } from "./errors.js";

export async function readJsonBody(request: IncomingMessage, maxBytes = 1_000_000): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;

    if (totalBytes > maxBytes) {
      throw new PayloadTooLargeError(maxBytes);
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new BadRequestError("Request body is required.");
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new BadRequestError("Request body must be valid JSON.");
  }
}
