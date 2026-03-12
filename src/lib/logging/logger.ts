import type { IncomingMessage } from "node:http";

import type { AppEnv } from "../config/env.js";
import { hasTrustedProxyChain } from "../http/auth.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export interface StructuredLogger {
  debug(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

export function createLogger(env: AppEnv): StructuredLogger {
  const threshold = levelOrder[env.LOG_LEVEL];

  return {
    debug: createLogMethod("debug", threshold),
    info: createLogMethod("info", threshold),
    warn: createLogMethod("warn", threshold),
    error: createLogMethod("error", threshold)
  };
}

export function buildRequestLogContext(request: IncomingMessage): Record<string, unknown> {
  return {
    method: request.method ?? "UNKNOWN",
    path: request.url ?? "/",
    request_id: getRequestId(request),
    ip: getClientIp(request)
  };
}

export function sanitizeLogFields(fields: Record<string, unknown> = {}): Record<string, unknown> {
  const sanitizedEntries = Object.entries(fields).map(([key, value]) => {
    const normalizedKey = key.toLowerCase();

    if (normalizedKey.includes("secret") || normalizedKey.includes("password") || normalizedKey.includes("private_key")) {
      return [key, "[REDACTED]"];
    }

    if (normalizedKey.includes("authorization") || normalizedKey.includes("mongodb_uri")) {
      return [key, "[REDACTED]"];
    }

    return [key, value];
  });

  return Object.fromEntries(sanitizedEntries);
}

function createLogMethod(level: LogLevel, threshold: number) {
  return (message: string, fields: Record<string, unknown> = {}): void => {
    if (levelOrder[level] < threshold) {
      return;
    }

    console.log(
      JSON.stringify({
        level,
        message,
        timestamp: new Date().toISOString(),
        ...sanitizeLogFields(fields)
      })
    );
  };
}

function getRequestId(request: IncomingMessage): string {
  const headerValue = request.headers["x-request-id"];

  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }

  return "generated-locally";
}

function getClientIp(request: IncomingMessage): string {
  const forwarded = request.headers["x-forwarded-for"];

  if (hasTrustedProxyChain(request) && typeof forwarded === "string" && forwarded.trim().length > 0) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return request.socket.remoteAddress ?? "unknown";
}
