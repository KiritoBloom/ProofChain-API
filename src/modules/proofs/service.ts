import { NotFoundError } from "../../lib/http/errors.js";
import { buildMerkleProof, buildMerkleTree } from "../../lib/merkle/tree.js";
import { verifyProofEnvelope } from "../../lib/verification/proofs.js";
import type { ProofEnvelope } from "../../types/integrity.js";
import type {
  AnchorRepository,
  BlockRepository,
  EventRepository
} from "../../types/persistence.js";

export function createGetProofByEventIdService(dependencies: {
  anchorRepository?: AnchorRepository;
  blockRepository: BlockRepository;
  eventRepository: EventRepository;
}) {
  return async function getProofByEventId(
    eventId: string
  ): Promise<ProofEnvelope> {
    const eventRecord =
      await dependencies.eventRepository.getEventById(eventId);

    if (!eventRecord) {
      throw new NotFoundError(`Event not found: ${eventId}`);
    }

    if (!eventRecord.block_id) {
      throw new NotFoundError(`Event is not sealed in any block: ${eventId}`);
    }

    const blockRecord = await dependencies.blockRepository.getBlockById(
      eventRecord.block_id
    );

    if (!blockRecord) {
      throw new NotFoundError(`Block not found for event: ${eventId}`);
    }

    const orderedEvents = await dependencies.eventRepository.getEventsByBlockId(
      blockRecord.block_id
    );
    const leafIndex = orderedEvents.findIndex(
      (event) => event.event_id === eventRecord.event_id
    );

    if (leafIndex === -1) {
      throw new NotFoundError(
        `Sealed event was not found in its block ordering: ${eventId}`
      );
    }

    const tree = buildMerkleTree(orderedEvents.map((event) => event.hash));
    const anchor = dependencies.anchorRepository
      ? await dependencies.anchorRepository.getAnchorByBlockId(
          blockRecord.block_id
        )
      : null;

    return {
      schema_version: 1,
      event_id: eventRecord.event_id,
      event_hash: eventRecord.hash,
      block_id: blockRecord.block_id,
      merkle_root: blockRecord.merkle_root,
      algorithm: blockRecord.algorithm,
      key_id: blockRecord.key_id,
      signature: blockRecord.signature,
      sealed_at: blockRecord.sealed_at,
      proof: buildMerkleProof(tree, leafIndex),
      ...(anchor ? { anchor } : {})
    };
  };
}

export function createVerifyProofService() {
  return async function verifyProof(
    input: ProofEnvelope & { public_key: string }
  ): Promise<{ valid: boolean; anchor_valid?: boolean }> {
    return verifyProofEnvelope(input, input.public_key);
  };
}
