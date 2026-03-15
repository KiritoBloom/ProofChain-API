import type { AppEnv } from "../config/env.js";

export const CURRENT_PHASE = "Complete";

export function buildIndexResponse(env: AppEnv) {
  return {
    name: env.APP_NAME,
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
