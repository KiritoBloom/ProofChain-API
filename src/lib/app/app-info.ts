import type { AppEnv } from "../config/env.js";

export const CURRENT_PHASE = "Complete";

export function buildIndexResponse(env: AppEnv) {
  const baseUrl = env.API_BASE_URL.replace(/\/$/, "");

  return {
    name: env.APP_NAME,
    product: "ProofChain API",
    status: "api-ready",
    phase: CURRENT_PHASE,
    base_url: baseUrl,
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
        path: `${baseUrl}/api/events`,
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
        path: `${baseUrl}/api/verify`,
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
  };
}

export function buildHealthResponse(
  env: AppEnv,
  timestamp = new Date().toISOString()
) {
  return {
    name: env.APP_NAME,
    status: "ok",
    environment: env.NODE_ENV,
    phase: CURRENT_PHASE,
    timestamp
  };
}
