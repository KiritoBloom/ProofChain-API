import { randomUUID } from "node:crypto";

import { ConflictError } from "../../lib/http/errors.js";
import { buildTransparencyAnchorRecord } from "../../lib/crypto/transparency-anchor.js";
import type {
  AnchorRecord,
  AnchorRepository,
  BlockRecord,
  BlockRepository,
  PublicAnchorRecord
} from "../../types/persistence.js";

interface TransparencyAnchoringDependencies {
  anchorRepository: AnchorRepository;
  now?: () => string;
  createAnchorId?: (block: BlockRecord) => string;
}

export function createTransparencyAnchorService(
  dependencies: TransparencyAnchoringDependencies
) {
  return async function anchorBlock(block: BlockRecord): Promise<AnchorRecord> {
    const existingAnchor =
      await dependencies.anchorRepository.getAnchorByBlockId(block.block_id);

    if (existingAnchor) {
      return existingAnchor;
    }

    const latestAnchor = await dependencies.anchorRepository.getLatestAnchor();

    if (latestAnchor && latestAnchor.block_sequence >= block.sequence) {
      throw new ConflictError(
        `Transparency anchors must be created in block sequence order. Latest anchored sequence is ${latestAnchor.block_sequence}.`
      );
    }

    const anchoredAt = (dependencies.now ?? defaultNow)();
    const anchorRecord = buildTransparencyAnchorRecord({
      anchor_id: (dependencies.createAnchorId ?? defaultAnchorId)(block),
      block_id: block.block_id,
      block_sequence: block.sequence,
      merkle_root: block.merkle_root,
      signature: block.signature,
      algorithm: block.algorithm,
      key_id: block.key_id,
      sealed_at: block.sealed_at,
      prev_anchor_hash: latestAnchor?.checkpoint ?? null,
      anchored_at: anchoredAt,
      created_at: anchoredAt
    });

    return dependencies.anchorRepository.createAnchor(anchorRecord);
  };
}

export function createGetAnchorByBlockIdService(dependencies: {
  anchorRepository: AnchorRepository;
}) {
  return async function getAnchorByBlockId(
    blockId: string
  ): Promise<AnchorRecord | null> {
    return dependencies.anchorRepository.getAnchorByBlockId(blockId);
  };
}

export function createListAnchorsService(dependencies: {
  anchorRepository: AnchorRepository;
}) {
  return async function listAnchors(
    limit: number
  ): Promise<{ anchors: PublicAnchorRecord[]; count: number }> {
    const anchors = await dependencies.anchorRepository.listAnchors(limit);

    return {
      anchors: anchors.map(toPublicAnchorRecord),
      count: anchors.length
    };
  };
}

export function createEnsureBlockAnchorService(dependencies: {
  anchorRepository: AnchorRepository;
  blockRepository: BlockRepository;
  anchorBlock: (block: BlockRecord) => Promise<AnchorRecord>;
}) {
  return async function ensureBlockAnchor(
    blockId: string
  ): Promise<AnchorRecord | null> {
    const existing =
      await dependencies.anchorRepository.getAnchorByBlockId(blockId);

    if (existing) {
      return existing;
    }

    const block = await dependencies.blockRepository.getBlockById(blockId);

    if (!block) {
      return null;
    }

    return dependencies.anchorBlock(block);
  };
}

function toPublicAnchorRecord(anchor: AnchorRecord): PublicAnchorRecord {
  return { ...anchor };
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultAnchorId(block: BlockRecord): string {
  return `anc_${String(block.sequence).padStart(6, "0")}_${randomUUID().slice(0, 8)}`;
}
