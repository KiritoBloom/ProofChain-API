import { createHash } from "node:crypto";

import type { CanonicalJsonValue } from "../../types/integrity.js";
import { canonicalizeJson } from "./canonical-json.js";

export const SHA256_HEX_LENGTH = 64;

export function sha256Hex(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function normalizeHashHex(hash: string): string {
  const normalized = hash.toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error("Expected a SHA-256 hex digest.");
  }

  return normalized;
}

export function hashCanonicalJson(value: CanonicalJsonValue): { canonical: string; hash: string } {
  const canonical = canonicalizeJson(value);

  return {
    canonical,
    hash: sha256Hex(canonical)
  };
}

export function hashPair(leftHash: string, rightHash: string): string {
  const leftBytes = Buffer.from(normalizeHashHex(leftHash), "hex");
  const rightBytes = Buffer.from(normalizeHashHex(rightHash), "hex");

  return sha256Hex(Buffer.concat([leftBytes, rightBytes]));
}
