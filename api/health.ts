import type { IncomingMessage, ServerResponse } from "node:http";

import { buildHealthResponse } from "../src/lib/app/app-info.js";
import { loadEnv } from "../src/lib/config/env.js";
import { sendJson } from "../src/lib/http/send-json.js";

export default function handler(_request: IncomingMessage, response: ServerResponse): void {
  const env = loadEnv();

  sendJson(response, 200, buildHealthResponse(env));
}
