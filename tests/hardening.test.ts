import { createServer } from "node:http";
import { AddressInfo } from "node:net";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, sanitizeLogFields } from "../src/lib/logging/logger.js";
import { resetRateLimitStore } from "../src/lib/http/rate-limit.js";
import { createPostEventsHandler } from "../src/modules/events/http-handlers.js";
describe("hardening", () => {
  const servers: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    resetRateLimitStore();

    while (servers.length > 0) {
      const server = servers.pop();
      if (server) {
        await server.close();
      }
    }
  });

  it("rate limits repeated event ingestion from the same client", async () => {
    const handler = createPostEventsHandler({
      ingestEvent: async () => ({
        event_id: "evt_test_001",
        hash: "7f11573aa34834921911add16b7a02d75ab4c15c342868c135573aa3c767e285",
        received_at: "2026-03-12T00:00:00.000Z"
      })
    });
    const server = await startServer(handler);
    servers.push(server);

    let finalResponse: Response | undefined;

    for (let index = 0; index < 31; index += 1) {
      finalResponse = await fetch(`${server.baseUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.10",
          "x-forwarded-host": "proof-chain-api.vercel.app",
          "x-forwarded-proto": "https"
        },
        body: JSON.stringify({
          service: "payment-service",
          type: "transaction",
          payload: { amount: 200 }
        })
      });
    }

    expect(finalResponse?.status).toBe(429);
    expect(finalResponse?.headers.get("retry-after")).toBeTruthy();
  });

  it("rejects requests without application/json content type", async () => {
    const server = await startServer(
      createPostEventsHandler({
        ingestEvent: async () => ({
          event_id: "evt_test_001",
          hash: "7f11573aa34834921911add16b7a02d75ab4c15c342868c135573aa3c767e285",
          received_at: "2026-03-12T00:00:00.000Z"
        })
      })
    );
    servers.push(server);

    const response = await fetch(`${server.baseUrl}/events`, {
      method: "POST",
      body: JSON.stringify({
        service: "payment-service",
        type: "transaction",
        payload: { amount: 200 }
      })
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Request content-type must be application/json."
    });
  });

  it("redacts sensitive log fields", () => {
    expect(
      sanitizeLogFields({
        authorization: "Bearer token",
        mongodb_uri: "mongodb+srv://secret",
        private_key: "super-secret",
        service: "payment-service"
      })
    ).toEqual({
      authorization: "[REDACTED]",
      mongodb_uri: "[REDACTED]",
      private_key: "[REDACTED]",
      service: "payment-service"
    });
  });

  it("emits structured logs", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const logger = createLogger({
      NODE_ENV: "development",
      APP_NAME: "ProofChain API",
      API_BASE_URL: "http://localhost:3000",
      LOG_LEVEL: "info",
      TRANSPARENCY_AUTO_ANCHOR: "true",
      MONGODB_URI: undefined,
      MONGODB_DB_NAME: undefined,
      SIGNING_PRIVATE_KEY: undefined,
      SIGNING_PUBLIC_KEY: undefined,
      SIGNING_KEY_ID: undefined
    });

    logger.info("Event ingested", {
      event_id: "evt_001",
      mongodb_uri: "mongodb+srv://secret"
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toContain('"level":"info"');
    expect(spy.mock.calls[0]?.[0]).toContain('"message":"Event ingested"');
    expect(spy.mock.calls[0]?.[0]).toContain('"mongodb_uri":"[REDACTED]"');

    spy.mockRestore();
  });

  it("publishes the current verification key metadata", async () => {
    const { createGetCurrentKeyHandler } =
      await import("../src/modules/verification/public-key.js");
    const server = createServer(async (request, response) => {
      await createGetCurrentKeyHandler({
        publicKey: "-----BEGIN PUBLIC KEY-----demo-----END PUBLIC KEY-----",
        keyId: "main-2026-01"
      })(request, response);
    });

    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${address.port}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      public_key: "-----BEGIN PUBLIC KEY-----demo-----END PUBLIC KEY-----"
    });

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it("does not trust spoofed forwarded headers without a full proxy chain", async () => {
    const handler = createPostEventsHandler({
      ingestEvent: async () => ({
        event_id: "evt_test_001",
        hash: "7f11573aa34834921911add16b7a02d75ab4c15c342868c135573aa3c767e285",
        received_at: "2026-03-12T00:00:00.000Z"
      })
    });
    const server = await startServer(handler);
    servers.push(server);

    let finalResponse: Response | undefined;

    for (let index = 0; index < 31; index += 1) {
      finalResponse = await fetch(`${server.baseUrl}/events`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": `203.0.113.${index}`
        },
        body: JSON.stringify({
          service: "payment-service",
          type: "transaction",
          payload: { amount: 200 }
        })
      });
    }

    expect(finalResponse?.status).toBe(429);
  });
});

async function startServer(
  handler: ReturnType<typeof createPostEventsHandler>
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = createServer(async (request, response) => {
    if (request.url === "/events") {
      await handler(request, response);
      return;
    }

    response.statusCode = 404;
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    }
  };
}
