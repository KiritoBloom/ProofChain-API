import type { IncomingMessage, ServerResponse } from "node:http";

import { hasTrustedProxyChain } from "./auth.js";
import { HttpError } from "./errors.js";

interface RateLimitRule {
  keyPrefix: string;
  windowMs: number;
  maxRequests: number;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitBucket>();

export class RateLimitExceededError extends HttpError {
  constructor(retryAfterSeconds: number) {
    super(429, "Rate limit exceeded.", {
      "retry-after": String(retryAfterSeconds)
    });
  }
}

export function enforceRateLimit(
  request: IncomingMessage,
  response: ServerResponse,
  rule: RateLimitRule,
  now = Date.now()
): void {
  const key = `${rule.keyPrefix}:${getClientIdentifier(request)}`;
  const bucket = getOrCreateBucket(key, rule.windowMs, now);

  if (bucket.count >= rule.maxRequests) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    response.setHeader("x-ratelimit-limit", String(rule.maxRequests));
    response.setHeader("x-ratelimit-remaining", "0");
    response.setHeader("x-ratelimit-reset", String(Math.ceil(bucket.resetAt / 1000)));
    throw new RateLimitExceededError(retryAfterSeconds);
  }

  bucket.count += 1;

  response.setHeader("x-ratelimit-limit", String(rule.maxRequests));
  response.setHeader("x-ratelimit-remaining", String(Math.max(0, rule.maxRequests - bucket.count)));
  response.setHeader("x-ratelimit-reset", String(Math.ceil(bucket.resetAt / 1000)));
}

export function resetRateLimitStore(): void {
  rateLimitStore.clear();
}

function getOrCreateBucket(key: string, windowMs: number, now: number): RateLimitBucket {
  const existing = rateLimitStore.get(key);

  if (!existing || now >= existing.resetAt) {
    const created = {
      count: 0,
      resetAt: now + windowMs
    };

    rateLimitStore.set(key, created);
    return created;
  }

  return existing;
}

function getClientIdentifier(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];

  if (hasTrustedProxyChain(request) && typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.socket.remoteAddress ?? "unknown";
}
