import type { TransparencyAnchor } from "../../types/integrity.js";
import { canonicalizeJson } from "./canonical-json.js";
import { normalizeHashHex, sha256Hex } from "./hash.js";

export interface TransparencyAnchorPayloadInput {
  algorithm?: "Ed25519";
  key_id: string;
  block_id: string;
  block_sequence: number;
  merkle_root: string;
  signature: string;
  sealed_at: string;
  prev_anchor_hash: string | null;
  anchored_at: string;
}

export function createTransparencyAnchorPayload(
  input: TransparencyAnchorPayloadInput
) {
  return {
    schema_version: 1 as const,
    algorithm: input.algorithm ?? "Ed25519",
    key_id: normalizeNonEmptyString(input.key_id, "key_id"),
    block_id: normalizeBlockId(input.block_id),
    block_sequence: normalizePositiveInteger(
      input.block_sequence,
      "block_sequence"
    ),
    merkle_root: normalizeHashHex(input.merkle_root),
    signature: normalizeNonEmptyString(input.signature, "signature"),
    sealed_at: normalizeIsoTimestamp(input.sealed_at, "sealed_at"),
    prev_anchor_hash:
      input.prev_anchor_hash === null
        ? null
        : normalizeHashHex(input.prev_anchor_hash),
    anchored_at: normalizeIsoTimestamp(input.anchored_at, "anchored_at")
  };
}

export function serializeTransparencyAnchorPayload(
  input: TransparencyAnchorPayloadInput
): string {
  return canonicalizeJson(createTransparencyAnchorPayload(input));
}

export function computeTransparencyCheckpoint(
  input: TransparencyAnchorPayloadInput
): string {
  return sha256Hex(serializeTransparencyAnchorPayload(input));
}

export function buildTransparencyAnchorRecord(
  input: {
    anchor_id: string;
    created_at: string;
  } & TransparencyAnchorPayloadInput
): TransparencyAnchor {
  const payload = createTransparencyAnchorPayload(input);

  return {
    schema_version: 1,
    anchor_id: normalizeAnchorId(input.anchor_id),
    block_id: payload.block_id,
    block_sequence: payload.block_sequence,
    merkle_root: payload.merkle_root,
    signature: payload.signature,
    algorithm: payload.algorithm,
    key_id: payload.key_id,
    sealed_at: payload.sealed_at,
    prev_anchor_hash: payload.prev_anchor_hash,
    checkpoint: computeTransparencyCheckpoint(input),
    anchored_at: payload.anchored_at,
    created_at: normalizeIsoTimestamp(input.created_at, "created_at")
  };
}

function normalizeNonEmptyString(value: string, fieldName: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return normalized;
}

function normalizeIsoTimestamp(value: string, fieldName: string): string {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error(`${fieldName} must be a valid timestamp.`);
  }

  return timestamp.toISOString();
}

function normalizePositiveInteger(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function normalizeBlockId(value: string): string {
  const normalized = normalizeNonEmptyString(value, "block_id");

  if (!/^blk_[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error("block_id must be a valid ProofChain block id.");
  }

  return normalized;
}

function normalizeAnchorId(value: string): string {
  const normalized = normalizeNonEmptyString(value, "anchor_id");

  if (!/^anc_[a-zA-Z0-9_-]+$/.test(normalized)) {
    throw new Error("anchor_id must be a valid ProofChain anchor id.");
  }

  return normalized;
}
