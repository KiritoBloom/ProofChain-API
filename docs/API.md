# API Reference

This document describes the current ProofChain API surface.

## Base Concepts

- events are ingested and hashed from a canonical immutable envelope
- sealed blocks contain ordered event hashes and a signed Merkle root
- transparency anchors chain sealed blocks into append-only public checkpoints
- proofs contain enough metadata for independent verification

## Endpoints

### `GET /`

Return API metadata and route discovery information.

When deployed from the Vercel `api/` directory, this handler is exposed at `/api`.
The route paths returned in the payload are relative to the API mount.

Response `200`:

```json
{
  "name": "ProofChain API",
  "product": "ProofChain API",
  "status": "api-ready",
  "phase": "Complete",
  "capabilities": [
    "event ingestion",
    "block sealing",
    "Merkle proofs",
    "Ed25519 verification",
    "transparency anchoring"
  ],
  "routes": [
    {
      "method": "GET",
      "path": "/",
      "description": "API index"
    },
    {
      "method": "GET",
      "path": "/health",
      "description": "Health check"
    },
    {
      "method": "POST",
      "path": "/events",
      "description": "Ingest an event"
    },
    {
      "method": "GET",
      "path": "/events/:event_id",
      "description": "Fetch a stored event"
    },
    {
      "method": "POST",
      "path": "/blocks/create",
      "description": "Seal pending events into a block"
    },
    {
      "method": "GET",
      "path": "/blocks",
      "description": "List sealed blocks"
    },
    {
      "method": "GET",
      "path": "/anchors",
      "description": "List transparency anchors"
    },
    {
      "method": "GET",
      "path": "/anchors/:block_id",
      "description": "Fetch a block transparency anchor"
    },
    {
      "method": "GET",
      "path": "/proof/:event_id",
      "description": "Fetch a proof envelope"
    },
    {
      "method": "POST",
      "path": "/verify",
      "description": "Verify a proof envelope"
    },
    {
      "method": "GET",
      "path": "/keys/current",
      "description": "Fetch the current verification key"
    }
  ],
  "docs": {
    "api": "docs/API.md",
    "deployment": "docs/DEPLOYMENT.md",
    "project_status": "docs/PROJECT_STATUS.md"
  }
}
```

### `POST /events`

Ingest a new event.

Request:

```json
{
  "service": "payment-service",
  "type": "transaction",
  "payload": {
    "user_id": "1245",
    "amount": 200
  }
}
```

Response `201`:

```json
{
  "event_id": "evt_...",
  "hash": "...",
  "received_at": "2026-03-12T00:00:00.000Z"
}
```

### `GET /events/:event_id`

Fetch a stored event record.

By default this endpoint returns redacted event metadata only. To retrieve the full stored payload, send `Authorization: Bearer <EVENT_READ_TOKEN>`.

Response `200`:

```json
{
  "event_id": "evt_...",
  "schema_version": 1,
  "service": "payment-service",
  "type": "transaction",
  "received_at": "...",
  "hash": "...",
  "block_id": null,
  "created_at": "...",
  "updated_at": "...",
  "payload_redacted": true
}
```

Authenticated response `200`:

```json
{
  "event_id": "evt_...",
  "schema_version": 1,
  "service": "payment-service",
  "type": "transaction",
  "payload": {},
  "received_at": "...",
  "hash": "...",
  "block_id": null,
  "created_at": "...",
  "updated_at": "..."
}
```

### `POST /blocks/create`

Seal unsealed events into a signed block.

Manual requests must include `Authorization: Bearer <BLOCK_SEAL_TOKEN>`.

Request:

```json
{
  "max_events": 100
}
```

Response `201`:

```json
{
  "block_id": "blk_...",
  "sequence": 1,
  "event_count": 2,
  "merkle_root": "...",
  "signature": "...",
  "algorithm": "Ed25519",
  "key_id": "main-2026-01",
  "sealed_at": "...",
  "anchor": {
    "schema_version": 1,
    "anchor_id": "anc_...",
    "block_id": "blk_...",
    "block_sequence": 1,
    "merkle_root": "...",
    "signature": "...",
    "algorithm": "Ed25519",
    "key_id": "main-2026-01",
    "sealed_at": "...",
    "prev_anchor_hash": null,
    "checkpoint": "...",
    "anchored_at": "...",
    "created_at": "..."
  }
}
```

Scheduled compatibility:

- `GET /blocks/create` is reserved for Vercel Cron-style requests only

When `TRANSPARENCY_AUTO_ANCHOR=true`, block sealing also writes a chained transparency anchor for the new block.

### `GET /anchors`

List transparency anchors in descending block-sequence order.

Response `200`:

```json
{
  "count": 2,
  "anchors": [
    {
      "schema_version": 1,
      "anchor_id": "anc_...",
      "block_id": "blk_...",
      "block_sequence": 2,
      "merkle_root": "...",
      "signature": "...",
      "algorithm": "Ed25519",
      "key_id": "main-2026-01",
      "sealed_at": "...",
      "prev_anchor_hash": "...",
      "checkpoint": "...",
      "anchored_at": "...",
      "created_at": "..."
    }
  ]
}
```

### `GET /anchors/:block_id`

Return the transparency anchor for a specific block.

### `GET /proof/:event_id`

Retrieve a proof envelope for a sealed event.

Note:

- when a block contains exactly one event, the event hash is already the Merkle root, so `proof` is correctly returned as `[]`

Response `200`:

```json
{
  "schema_version": 1,
  "event_id": "evt_...",
  "event_hash": "...",
  "block_id": "blk_...",
  "merkle_root": "...",
  "algorithm": "Ed25519",
  "key_id": "main-2026-01",
  "signature": "...",
  "sealed_at": "...",
  "proof": [
    {
      "position": "left",
      "hash": "..."
    }
  ],
  "anchor": {
    "schema_version": 1,
    "anchor_id": "anc_...",
    "block_id": "blk_...",
    "block_sequence": 1,
    "merkle_root": "...",
    "signature": "...",
    "algorithm": "Ed25519",
    "key_id": "main-2026-01",
    "sealed_at": "...",
    "prev_anchor_hash": null,
    "checkpoint": "...",
    "anchored_at": "...",
    "created_at": "..."
  }
}
```

### `POST /verify`

Verify a proof envelope with a public key.

Request:

```json
{
  "schema_version": 1,
  "event_id": "evt_...",
  "event_hash": "...",
  "block_id": "blk_...",
  "merkle_root": "...",
  "algorithm": "Ed25519",
  "key_id": "main-2026-01",
  "signature": "...",
  "sealed_at": "...",
  "proof": [
    {
      "position": "left",
      "hash": "..."
    }
  ],
  "public_key": "-----BEGIN PUBLIC KEY-----..."
}
```

Response `200`:

```json
{
  "valid": true,
  "anchor_valid": true
}
```

### `GET /keys/current`

Return the currently published verification key metadata.

Response `200`:

```json
{
  "algorithm": "Ed25519",
  "key_id": "main-2026-01",
  "public_key": "-----BEGIN PUBLIC KEY-----..."
}
```

## CLI Verification

The repository also includes a standalone CLI verifier:

```bash
proofchain verify proof.json
```

Optional public key override:

```bash
proofchain verify proof.json --public-key "-----BEGIN PUBLIC KEY-----..."
```

## Error Model

Common errors:

- `400` invalid request or content-type
- `401` missing or invalid bearer token
- `404` missing event, block, or proof source
- `405` method not allowed
- `409` conflict, such as empty block sealing
- `413` request too large
- `429` rate limit exceeded
- `500` internal server error

## Request Protections

- JSON content-type required for `POST` routes
- content-length checked before large body reads
- request body size limits applied
- rate limiting applied to ingestion, sealing, anchor retrieval, proof retrieval, event reads, and verification routes
