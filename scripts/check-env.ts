import { getMissingRuntimeKeys, loadEnv } from "../src/lib/config/env.js";

const env = loadEnv();
const missingRuntimeKeys = getMissingRuntimeKeys(env);

console.log(
  JSON.stringify(
    {
      appName: env.APP_NAME,
      nodeEnv: env.NODE_ENV,
      apiBaseUrl: env.API_BASE_URL,
      runtimeReady: missingRuntimeKeys.length === 0,
      missingRuntimeKeys
    },
    null,
    2
  )
);
