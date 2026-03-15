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
      base_url: "http://localhost:3000",
      landing: {
        path: "/",
        description: "Interactive portfolio landing page and API showcase"
      },
      api_base_path: "/api",
      capabilities: [
        "event ingestion",
        "block sealing",
        "Merkle proofs",
        "Ed25519 verification",
        "transparency anchoring"
      ],
      routes: [
        {
          method: "GET",
          path: "/api",
          description: "Machine-readable API index",
          auth: "none",
          category: "discovery"
        },
        {
          method: "GET",
          path: "/api/health",
          description: "Health check",
          auth: "none",
          category: "ops"
        },
        {
          method: "POST",
          path: "/api/events",
          description: "Ingest an immutable event envelope",
          auth: "none",
          category: "events"
        },
        {
          method: "GET",
          path: "/api/events/:event_id",
          description: "Fetch stored event metadata or the full payload",
          auth: "optional bearer EVENT_READ_TOKEN for full payload",
          category: "events"
        },
        {
          method: "POST",
          path: "/api/blocks/create",
          description: "Seal pending events into a signed block",
          auth: "bearer BLOCK_SEAL_TOKEN or Vercel Cron",
          category: "blocks"
        },
        {
          method: "GET",
          path: "/api/blocks",
          description: "List sealed blocks",
          auth: "none",
          category: "blocks"
        },
        {
          method: "GET",
          path: "/api/anchors",
          description: "List transparency anchors",
          auth: "none",
          category: "anchors"
        },
        {
          method: "GET",
          path: "/api/anchors/:block_id",
          description: "Fetch a block transparency anchor",
          auth: "none",
          category: "anchors"
        },
        {
          method: "GET",
          path: "/api/proof/:event_id",
          description: "Fetch a proof envelope",
          auth: "none",
          category: "proofs"
        },
        {
          method: "POST",
          path: "/api/verify",
          description: "Verify a proof envelope",
          auth: "none",
          category: "proofs"
        },
        {
          method: "GET",
          path: "/api/keys/current",
          description: "Fetch the current verification key",
          auth: "none",
          category: "keys"
        }
      ],
      quickstart: [
        {
          label: "Inspect live API metadata",
          method: "GET",
          path: "/api"
        },
        {
          label: "Confirm deployment health",
          method: "GET",
          path: "/api/health"
        },
        {
          label: "Ingest a sample event",
          method: "POST",
          path: "/api/events"
        },
        {
          label: "Verify an exported proof",
          method: "POST",
          path: "/api/verify"
        }
      ],
      examples: {
        ingest_event: {
          method: "POST",
          path: "http://localhost:3000/api/events",
          body: {
            service: "payment-service",
            type: "transaction",
            payload: {
              amount: 200,
              currency: "USD",
              user_id: "user_1245"
            }
          }
        },
        verify_proof: {
          method: "POST",
          path: "http://localhost:3000/api/verify",
          body: {
            schema_version: 1,
            event_id: "evt_example",
            event_hash: "sha256_hex",
            block_id: "blk_example",
            merkle_root: "sha256_hex",
            algorithm: "Ed25519",
            key_id: "main-2026-01",
            signature: "base64_signature",
            sealed_at: "2026-03-15T00:00:00.000Z",
            proof: []
          }
        }
      },
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
