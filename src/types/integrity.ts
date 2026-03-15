export type CanonicalJsonPrimitive = boolean | null | number | string;

export type CanonicalJsonObject = {
  [key: string]: CanonicalJsonValue;
};

export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | CanonicalJsonObject
  | CanonicalJsonValue[];

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

export interface TransparencyAnchor {
  schema_version: 1;
  anchor_id: string;
  block_id: string;
  block_sequence: number;
  merkle_root: string;
  signature: string;
  algorithm: "Ed25519";
  key_id: string;
  sealed_at: string;
  prev_anchor_hash: string | null;
  checkpoint: string;
  anchored_at: string;
  created_at: string;
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
  anchor?: TransparencyAnchor;
}
