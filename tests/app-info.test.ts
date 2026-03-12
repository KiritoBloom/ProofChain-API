import { describe, expect, it } from "vitest";

import { buildHealthResponse, buildIndexResponse, CURRENT_PHASE } from "../src/lib/app/app-info.js";
import { getMissingRuntimeKeys, type AppEnv } from "../src/lib/config/env.js";

const baseEnv: AppEnv = {
  NODE_ENV: "development",
  APP_NAME: "ProofChain API",
  API_BASE_URL: "http://localhost:3000",
  LOG_LEVEL: "info",
  MONGODB_URI: undefined,
  MONGODB_DB_NAME: undefined,
  SIGNING_PRIVATE_KEY: undefined,
  SIGNING_PUBLIC_KEY: undefined,
  SIGNING_KEY_ID: undefined
};

describe("app info", () => {
  it("builds the scaffold index response", () => {
    const response = buildIndexResponse(baseEnv);

    expect(response.status).toBe("integrity-library-ready");
    expect(response.phase).toBe(CURRENT_PHASE);
    expect(response.demoRoutes).toEqual(["/", "/health"]);
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
