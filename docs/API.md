# API Reference

This document describes the current ProofChain API surface.

## Base Concepts

- events are ingested and hashed from a canonical immutable envelope
- sealed blocks contain ordered event hashes and a signed Merkle root
- transparency anchors chain sealed blocks into append-only public checkpoints
- proofs contain enough metadata for independent verification

## Endpoints

### `GET /`

Return the public landing page for the deployment base URL.

This page is intended for human visitors. It showcases the API, explains the integrity model, renders a route catalog, and includes a lightweight in-browser request playground.

### `GET /api`

Return API metadata and route discovery information.

This is the machine-readable index that powers the landing page and should be used by tooling or external clients that need endpoint discovery.

Response `200`:

```json
{
  "name": "ProofChain API",
  "product": "ProofChain API",
  "status": "api-ready",
  "phase": "Complete",
  "base_url": "https://proof-chain-api.vercel.app",
  "landing": {
    "path": "/",
    "description": "Interactive portfolio landing page and API showcase"
  },
  "api_base_path": "/api",
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
      "path": "/api",
      "description": "Machine-readable API index",
      "auth": "none",
      "category": "discovery"
    },
    {
      "method": "GET",
      "path": "/api/health",
      "description": "Health check",
      "auth": "none",
      "category": "ops"
    },
    {
      "method": "POST",
      "path": "/api/events",
      "description": "Ingest an immutable event envelope",
      "auth": "none",
      "category": "events"
    },
    {
      "method": "GET",
      "path": "/api/events/:event_id",
      "description": "Fetch stored event metadata or the full payload",
      "auth": "optional bearer EVENT_READ_TOKEN for full payload",
      "category": "events"
    },
    {
      "method": "POST",
      "path": "/api/blocks/create",
      "description": "Seal pending events into a signed block",
      "auth": "bearer BLOCK_SEAL_TOKEN or Vercel Cron",
      "category": "blocks"
    },
    {
      "method": "GET",
      "path": "/api/blocks",
      "description": "List sealed blocks",
      "auth": "none",
      "category": "blocks"
    },
    {
      "method": "GET",
      "path": "/api/anchors",
      "description": "List transparency anchors",
      "auth": "none",
      "category": "anchors"
    },
    {
      "method": "GET",
      "path": "/api/anchors/:block_id",
      "description": "Fetch a block transparency anchor",
      "auth": "none",
      "category": "anchors"
    },
    {
      "method": "GET",
      "path": "/api/proof/:event_id",
      "description": "Fetch a proof envelope",
      "auth": "none",
      "category": "proofs"
    },
    {
      "method": "POST",
      "path": "/api/verify",
      "description": "Verify a proof envelope",
      "auth": "none",
      "category": "proofs"
    },
    {
      "method": "GET",
      "path": "/api/keys/current",
      "description": "Fetch the current verification key",
      "auth": "none",
      "category": "keys"
    }
  ],
  "quickstart": [
    {
      "label": "Inspect live API metadata",
      "method": "GET",
      "path": "/api"
    },
    {
      "label": "Confirm deployment health",
      "method": "GET",
      "path": "/api/health"
    },
    {
      "label": "Ingest a sample event",
      "method": "POST",
      "path": "/api/events"
    },
    {
      "label": "Verify an exported proof",
      "method": "POST",
      "path": "/api/verify"
    }
  ],
  "docs": {
    "api": "docs/API.md",
    "deployment": "docs/DEPLOYMENT.md",
    "project_status": "docs/PROJECT_STATUS.md"
  }
}
```

### `POST /api/events`

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

### `GET /api/events/:event_id`

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

### `POST /api/blocks/create`

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

- `GET /api/blocks/create` is reserved for Vercel Cron-style requests only

When `TRANSPARENCY_AUTO_ANCHOR=true`, block sealing also writes a chained transparency anchor for the new block.

### `GET /api/anchors`

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

### `GET /api/anchors/:block_id`

Return the transparency anchor for a specific block.

### `GET /api/proof/:event_id`

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

### `POST /api/verify`

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

### `GET /api/keys/current`

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
