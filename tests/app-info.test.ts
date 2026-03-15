import { describe, expect, it } from "vitest";

import {
  buildHealthResponse,
  buildIndexResponse,
  CURRENT_PHASE
} from "../src/lib/app/app-info.js";
import { getMissingRuntimeKeys, type AppEnv } from "../src/lib/config/env.js";

const baseEnv: AppEnv = {
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
};

describe("app info", () => {
  it("builds the API index response", () => {
    const response = buildIndexResponse(baseEnv);

    expect(response).toEqual({
      name: "ProofChain API",
      product: "ProofChain API",
      status: "api-ready",
      phase: CURRENT_PHASE,
      capabilities: [
        "event ingestion",
        "block sealing",
        "Merkle proofs",
        "Ed25519 verification",
        "transparency anchoring"
      ],
      routes: [
        { method: "GET", path: "/", description: "API index" },
        { method: "GET", path: "/health", description: "Health check" },
        { method: "POST", path: "/events", description: "Ingest an event" },
        {
          method: "GET",
          path: "/events/:event_id",
          description: "Fetch a stored event"
        },
        {
          method: "POST",
          path: "/blocks/create",
          description: "Seal pending events into a block"
        },
        { method: "GET", path: "/blocks", description: "List sealed blocks" },
        {
          method: "GET",
          path: "/anchors",
          description: "List transparency anchors"
        },
        {
          method: "GET",
          path: "/anchors/:block_id",
          description: "Fetch a block transparency anchor"
        },
        {
          method: "GET",
          path: "/proof/:event_id",
          description: "Fetch a proof envelope"
        },
        {
          method: "POST",
          path: "/verify",
          description: "Verify a proof envelope"
        },
        {
          method: "GET",
          path: "/keys/current",
          description: "Fetch the current verification key"
        }
      ],
      docs: {
        api: "docs/API.md",
        deployment: "docs/DEPLOYMENT.md",
        project_status: "docs/PROJECT_STATUS.md"
      }
    });
  });

  it("builds the health response with a stable timestamp", () => {
    const response = buildHealthResponse(baseEnv, "2026-03-12T00:00:00.000Z");

    expect(response).toEqual({
      name: "ProofChain API",
      status: "ok",
      environment: "development",
      phase: CURRENT_PHASE,
      timestamp: "2026-03-12T00:00:00.000Z"
    });
  });

  it("reports missing runtime keys for the future ProofChain runtime", () => {
    expect(getMissingRuntimeKeys(baseEnv)).toEqual([
      "MONGODB_URI",
      "MONGODB_DB_NAME",
      "SIGNING_PRIVATE_KEY",
      "SIGNING_PUBLIC_KEY",
      "SIGNING_KEY_ID"
    ]);
  });
});
