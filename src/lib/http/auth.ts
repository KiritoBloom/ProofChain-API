import type { IncomingMessage } from "node:http";

import { UnauthorizedError } from "./errors.js";

export function assertBearerToken(request: IncomingMessage, expectedToken: string | undefined, message: string): void {
  if (!expectedToken) {
    throw new UnauthorizedError(message);
  }

  const authorization = request.headers.authorization;

  if (authorization === `Bearer ${expectedToken}`) {
    return;
  }

  throw new UnauthorizedError(message);
}

export function hasTrustedProxyChain(request: IncomingMessage): boolean {
  const forwarded = request.headers["x-forwarded-for"];
  const forwardedHost = request.headers["x-forwarded-host"];
  const forwardedProto = request.headers["x-forwarded-proto"];

  return (
    typeof forwarded === "string" &&
    forwarded.trim().length > 0 &&
    typeof forwardedHost === "string" &&
    forwardedHost.trim().length > 0 &&
    typeof forwardedProto === "string" &&
    forwardedProto.trim().length > 0
  );
}
