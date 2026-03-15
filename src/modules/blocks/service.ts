import { randomUUID } from "node:crypto";

import { signEd25519 } from "../../lib/crypto/ed25519.js";
import { serializeSignedBlockPayload } from "../../lib/crypto/signed-block.js";
import { ConflictError } from "../../lib/http/errors.js";
import { buildMerkleTree } from "../../lib/merkle/tree.js";
import type {
  AnchorRecord,
  BlockRecord,
  BlockRepository,
  EventRecord,
  EventRepository
} from "../../types/persistence.js";

const DEFAULT_BLOCK_SEAL_MAX_EVENTS = 100;

export interface SealBlockInput {
  max_events?: number;
}

export interface SealBlockResult {
  block_id: string;
  sequence: number;
  event_count: number;
  merkle_root: string;
  signature: string;
  algorithm: "Ed25519";
  key_id: string;
  sealed_at: string;
  anchor: AnchorRecord | null;
}

interface BlockSealingDependencies {
  blockRepository: BlockRepository;
  eventRepository: EventRepository;
  now?: () => string;
  createBlockId?: (sequence: number) => string;
  signBlockPayload: (payload: string) => string;
  signingKeyId: string;
  maxEventsPerSeal?: number;
  anchorBlock?: (block: BlockRecord) => Promise<AnchorRecord>;
}

export function createBlockSealingService(
  dependencies: BlockSealingDependencies
) {
  return async function sealBlock(
    input: SealBlockInput = {}
  ): Promise<SealBlockResult> {
    const maxEvents =
      input.max_events ??
      dependencies.maxEventsPerSeal ??
      DEFAULT_BLOCK_SEAL_MAX_EVENTS;
    const candidateEvents =
      await dependencies.eventRepository.listUnsealedEvents(maxEvents);

    if (candidateEvents.length === 0) {
      throw new ConflictError(
        "No unsealed events are available for block creation."
      );
    }

    const orderedEvents = sortEventsForSealing(candidateEvents);
    const event_ids = orderedEvents.map((event) => event.event_id);
    const hashes = orderedEvents.map((event) => event.hash);
    const merkleTree = buildMerkleTree(hashes);
    const latestSequence =
      await dependencies.blockRepository.getLatestBlockSequence();
    const sequence = (latestSequence ?? 0) + 1;
    const sealed_at = (dependencies.now ?? defaultNow)();
    const block_id = (dependencies.createBlockId ?? defaultBlockId)(sequence);
    const serializedPayload = serializeSignedBlockPayload({
      key_id: dependencies.signingKeyId,
      merkle_root: merkleTree.root,
      sealed_at
    });
    const signature = dependencies.signBlockPayload(serializedPayload);

    const blockRecord: BlockRecord = {
      block_id,
      sequence,
      event_ids,
      hashes,
      merkle_root: merkleTree.root,
      signature,
      algorithm: "Ed25519",
      key_id: dependencies.signingKeyId,
      sealed_at,
      created_at: sealed_at
    };

    await dependencies.blockRepository.createBlock(blockRecord);

    const modifiedCount = await dependencies.eventRepository.markEventsSealed(
      event_ids,
      block_id
    );

    if (modifiedCount !== event_ids.length) {
      throw new ConflictError(
        "Failed to seal every selected event into the new block."
      );
    }

    const anchor = dependencies.anchorBlock
      ? await dependencies.anchorBlock(blockRecord)
      : null;

    return {
      block_id,
      sequence,
      event_count: event_ids.length,
      merkle_root: merkleTree.root,
      signature,
      algorithm: "Ed25519",
      key_id: dependencies.signingKeyId,
      sealed_at,
      anchor
    };
  };
}

export function createEd25519BlockSigner(
  privateKeyPem: string
): (payload: string) => string {
  return (payload: string) => signEd25519(payload, privateKeyPem);
}

function sortEventsForSealing(events: EventRecord[]): EventRecord[] {
  return [...events].sort((left, right) => {
    const receivedAtCompare = left.received_at.localeCompare(right.received_at);

    if (receivedAtCompare !== 0) {
      return receivedAtCompare;
    }

    return left.event_id.localeCompare(right.event_id);
  });
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultBlockId(sequence: number): string {
  return `blk_${String(sequence).padStart(6, "0")}_${randomUUID().slice(0, 8)}`;
}
