import { MongoClient, type Db } from "mongodb";

import type { AppEnv } from "../config/env.js";

const clientsByUri = new Map<string, Promise<MongoClient>>();

export function getMongoUri(env: AppEnv): string {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required for database access.");
  }

  return env.MONGODB_URI;
}

export function getMongoDbName(env: AppEnv): string {
  if (!env.MONGODB_DB_NAME) {
    throw new Error("MONGODB_DB_NAME is required for database access.");
  }

  return env.MONGODB_DB_NAME;
}

export async function getMongoClient(env: AppEnv): Promise<MongoClient> {
  const uri = getMongoUri(env);
  const cached = clientsByUri.get(uri);

  if (cached) {
    return cached;
  }

  const clientPromise = new MongoClient(uri).connect().catch((error: unknown) => {
    clientsByUri.delete(uri);
    throw error;
  });

  clientsByUri.set(uri, clientPromise);

  return clientPromise;
}

export async function getProofChainDb(env: AppEnv): Promise<Db> {
  const client = await getMongoClient(env);

  return client.db(getMongoDbName(env));
}

export function resetMongoClientCache(): void {
  clientsByUri.clear();
}
