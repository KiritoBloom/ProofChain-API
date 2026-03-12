import type { AppEnv } from "../config/env.js";

export const CURRENT_PHASE = "Phase 2 - Core Integrity Libraries";

export function buildIndexResponse(env: AppEnv) {
  return {
    name: env.APP_NAME,
    product: "ProofChain API",
    status: "integrity-library-ready",
    phase: CURRENT_PHASE,
    docs: {
      status: "docs/PROJECT_STATUS.md",
      progress: "docs/planning/PROGRESS.md",
      phases: "docs/planning/PHASES.md"
    },
    demoRoutes: ["/", "/health"]
  };
}

export function buildHealthResponse(env: AppEnv, timestamp = new Date().toISOString()) {
  return {
    name: env.APP_NAME,
    status: "ok",
    environment: env.NODE_ENV,
    phase: CURRENT_PHASE,
    timestamp
  };
}
