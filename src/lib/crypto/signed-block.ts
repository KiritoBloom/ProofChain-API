import type { SignedBlockPayload } from "../../types/integrity.js";
import { canonicalizeJson } from "./canonical-json.js";
import { normalizeHashHex } from "./hash.js";

export interface SignedBlockPayloadInput {
  algorithm?: "Ed25519";
  key_id: string;
  merkle_root: string;
  sealed_at: string;
}

export function createSignedBlockPayload(input: SignedBlockPayloadInput): SignedBlockPayload {
  return {
    schema_version: 1,
    algorithm: input.algorithm ?? "Ed25519",
    key_id: normalizeKeyId(input.key_id),
    merkle_root: normalizeHashHex(input.merkle_root),
    sealed_at: normalizeIsoTimestamp(input.sealed_at)
  };
}

export function serializeSignedBlockPayload(input: SignedBlockPayloadInput): string {
  return canonicalizeJson(createSignedBlockPayload(input));
}

function normalizeKeyId(value: string): string {
  const keyId = value.trim();

  if (keyId.length === 0) {
    throw new Error("key_id is required for a signed block payload.");
  }

  return keyId;
}

function normalizeIsoTimestamp(value: string): string {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    throw new Error("sealed_at must be a valid timestamp.");
  }

  return timestamp.toISOString();
}
