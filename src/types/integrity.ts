export type CanonicalJsonPrimitive = boolean | null | number | string;

export type CanonicalJsonObject = {
  [key: string]: CanonicalJsonValue;
};

export type CanonicalJsonValue = CanonicalJsonPrimitive | CanonicalJsonObject | CanonicalJsonValue[];

export type MerkleProofPosition = "left" | "right";

export interface MerkleProofStep {
  position: MerkleProofPosition;
  hash: string;
}

export interface MerkleTree {
  leaves: string[];
  levels: string[][];
  root: string;
}

export interface SignedBlockPayload {
  [key: string]: CanonicalJsonValue;
  schema_version: 1;
  algorithm: "Ed25519";
  key_id: string;
  merkle_root: string;
  sealed_at: string;
}

export interface ProofEnvelope {
  schema_version: 1;
  event_id: string;
  event_hash: string;
  block_id: string;
  merkle_root: string;
  algorithm: "Ed25519";
  key_id: string;
  signature: string;
  sealed_at: string;
  proof: MerkleProofStep[];
}
