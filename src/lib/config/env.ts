import { z } from "zod";

const appEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("ProofChain API"),
  API_BASE_URL: z.string().url().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  CRON_SECRET: z.string().min(1).optional(),
  BLOCK_SEAL_TOKEN: z.string().min(1).optional(),
  EVENT_READ_TOKEN: z.string().min(1).optional(),
  MONGODB_URI: z.string().min(1).optional(),
  MONGODB_DB_NAME: z.string().min(1).optional(),
  SIGNING_PRIVATE_KEY: z.string().min(1).optional(),
  SIGNING_PUBLIC_KEY: z.string().min(1).optional(),
  SIGNING_KEY_ID: z.string().min(1).optional()
});

const proofChainRuntimeKeys = [
  "MONGODB_URI",
  "MONGODB_DB_NAME",
  "SIGNING_PRIVATE_KEY",
  "SIGNING_PUBLIC_KEY",
  "SIGNING_KEY_ID"
] as const;

export type AppEnv = z.infer<typeof appEnvSchema>;

export function loadEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return appEnvSchema.parse(input);
}

export function getMissingRuntimeKeys(env: AppEnv): string[] {
  return proofChainRuntimeKeys.filter((key) => !env[key]);
}
