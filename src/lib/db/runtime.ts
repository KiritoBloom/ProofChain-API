import type { AppEnv } from "../config/env.js";
import { MongoAnchorRepository } from "./anchor-repository.js";
import { MongoBlockRepository } from "./block-repository.js";
import { MongoEventRepository } from "./event-repository.js";
import { ensureProofChainIndexes } from "./indexes.js";
import { getProofChainDb } from "./mongo.js";

export interface ProofChainPersistenceContext {
  anchorRepository: MongoAnchorRepository;
  blockRepository: MongoBlockRepository;
  eventRepository: MongoEventRepository;
}

const persistenceContexts = new Map<
  string,
  Promise<ProofChainPersistenceContext>
>();

export async function getProofChainPersistenceContext(
  env: AppEnv
): Promise<ProofChainPersistenceContext> {
  const cacheKey = `${env.MONGODB_URI ?? "missing-uri"}::${env.MONGODB_DB_NAME ?? "missing-db"}`;
  const cached = persistenceContexts.get(cacheKey);

  if (cached) {
    return cached;
  }

  const contextPromise = createProofChainPersistenceContext(env).catch(
    (error: unknown) => {
      persistenceContexts.delete(cacheKey);
      throw error;
    }
  );

  persistenceContexts.set(cacheKey, contextPromise);

  return contextPromise;
}

export function resetProofChainPersistenceContextCache(): void {
  persistenceContexts.clear();
}

async function createProofChainPersistenceContext(
  env: AppEnv
): Promise<ProofChainPersistenceContext> {
  const db = await getProofChainDb(env);

  await ensureProofChainIndexes(db);

  return {
    anchorRepository: MongoAnchorRepository.fromDb(db),
    blockRepository: MongoBlockRepository.fromDb(db),
    eventRepository: MongoEventRepository.fromDb(db)
  };
}
