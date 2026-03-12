import { createServer } from "node:http";

import { buildHealthResponse, buildIndexResponse } from "../src/lib/app/app-info.js";
import { loadEnv } from "../src/lib/config/env.js";
import { sendJson } from "../src/lib/http/send-json.js";

const env = loadEnv();
const port = Number(process.env.PORT ?? 3000);

const server = createServer((request, response) => {
  const requestUrl = new URL(request.url ?? "/", env.API_BASE_URL);

  if (requestUrl.pathname === "/") {
    sendJson(response, 200, buildIndexResponse(env));
    return;
  }

  if (requestUrl.pathname === "/health") {
    sendJson(response, 200, buildHealthResponse(env));
    return;
  }

  sendJson(response, 404, {
    error: "Not Found",
    path: requestUrl.pathname
  });
});

server.listen(port, () => {
  console.log(`ProofChain demo server listening on http://localhost:${port}`);
});
