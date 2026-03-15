# ProofChain API

ProofChain API is a tamper-evident audit logging backend for verifiable event integrity.

It accepts events, hashes them deterministically, seals them into signed Merkle blocks, chains public transparency anchors over those blocks, and returns proofs that can be verified independently by external clients.

## What It Does

ProofChain is built for systems that need to prove an event record was not modified after ingestion.

Typical use cases:

- audit trails for internal operations
- financial event logging
- security event logging
- admin action history
- API request evidence
- compliance and dispute investigation workflows

Core guarantees:

- event hashes are deterministic
- block membership is proven with Merkle proofs
- block roots are signed with Ed25519
- sealed blocks can be chained into transparency checkpoints
- proofs can be verified without hidden server state

## Features

- root deployment landing page with a polished API showcase, live request playground, and portfolio-ready explanations
- `GET /api` discover live API status, capabilities, and route metadata
- `POST /api/events` ingest events
- `GET /api/events/:event_id` fetch stored event metadata, with full payload access behind a bearer token
- `POST /api/blocks/create` seal pending events into signed blocks with a bearer token
- `GET /api/blocks` browse sealed block history
- `GET /api/anchors` browse transparency anchor history
- `GET /api/anchors/:block_id` fetch the transparency anchor for a sealed block
- `GET /api/proof/:event_id` fetch a proof envelope for a sealed event
- `POST /api/verify` verify a proof envelope with a public key
- `GET /api/keys/current` publish current verification key metadata
- standalone CLI verifier for offline proof checking
- proof export helper for portable verification files

## Architecture

The codebase is organized around small, explicit layers.

```text
api/                    # Vercel serverless entrypoints
src/
  modules/              # domain workflows and HTTP adapters
  lib/                  # crypto, merkle, db, validation, logging, config
  types/                # shared type definitions
docs/                   # operational and API documentation
tests/                  # unit and integration-style tests
scripts/                # local demos and utility scripts
bin/                    # CLI entrypoints
```

Key design principles:

- thin HTTP layer
- deterministic cryptographic behavior
- sealed blocks are immutable
- explicit schemas at system boundaries
- verifiable proofs that do not rely on server-only state

## Stack

- Node.js 20+
- TypeScript with strict mode
- Vercel serverless functions
- MongoDB Atlas
- Zod for validation
- Vitest for tests

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Fill in required environment variables.

4. Validate local configuration:

```bash
npm run check:env
```

5. Run the full verification suite:

```bash
npm run verify
```

## Environment Variables

Application:

- `NODE_ENV`
- `APP_NAME`
- `API_BASE_URL`
- `LOG_LEVEL`
- `CRON_SECRET` optional but recommended for scheduled block sealing
- `BLOCK_SEAL_TOKEN` required for manual `POST /api/blocks/create`
- `EVENT_READ_TOKEN` required to read full event payloads from `GET /api/events/:event_id`
- `TRANSPARENCY_AUTO_ANCHOR` optional, defaults to `true`, disables automatic anchor creation only if set to `false`

Database:

- `MONGODB_URI`
- `MONGODB_DB_NAME`

Signing:

- `SIGNING_PRIVATE_KEY`
- `SIGNING_PUBLIC_KEY`
- `SIGNING_KEY_ID`

## Primary Endpoints

### `GET /`

Returns the portfolio landing page for the deployed base URL.

It presents the API visually, explains the integrity workflow, loads the live route catalog from `GET /api`, and includes a browser-based request playground for public endpoints.

### `GET /api`

Returns the live API index, including route discovery metadata for deployed environments.

### `POST /api/events`

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

### `POST /api/blocks/create`

Requires `Authorization: Bearer <BLOCK_SEAL_TOKEN>` for manual requests.

Request:

```json
{
  "max_events": 100
}
```

### `GET /api/proof/:event_id`

Returns a versioned proof envelope for a sealed event.

When a block has been transparency-anchored, the response also includes the chained anchor record.

### `POST /api/verify`

Verifies a proof envelope against a public key.

### `GET /api/anchors`

Returns the public transparency checkpoint chain for sealed blocks.

### `GET /api/anchors/:block_id`

Returns the transparency anchor for a specific block.

### `GET /api/keys/current`

Returns the currently published verification key metadata.

For the full request and response shapes, see `docs/API.md`.

## CLI Verifier

Verify an exported proof file locally:

```bash
proofchain verify proof.json
```

If the proof file does not include `public_key`:

```bash
proofchain verify proof.json --public-key "-----BEGIN PUBLIC KEY-----..."
```

## Scripts

- `npm run check:env` validate environment variables
- `npm run typecheck` run TypeScript checks
- `npm run lint` run ESLint
- `npm run test` run Vitest
- `npm run verify` run typecheck, lint, and tests together
- `npm run demo` run the core integrity demo
- `npm run demo:events` run event API demo
- `npm run demo:blocks` run block sealing demo
- `npm run demo:anchors` run transparency anchor demo
- `npm run demo:proof` run proof retrieval and verification demo
- `npm run demo:ledger` run public ledger demo
- `npm run demo:cli` run CLI verifier demo
- `npm run demo:export` run proof export demo

## How To Operate It

Typical flow after deployment:

1. client systems send events to `POST /api/events`
2. scheduled or manual sealing creates signed blocks via `POST /api/blocks/create`
3. operators can inspect chained checkpoints with `GET /api/anchors` or `GET /api/anchors/:block_id`
4. proofs are fetched with `GET /api/proof/:event_id`
5. proofs are verified with `POST /api/verify` or the CLI
6. operators inspect block history with `GET /api/blocks`

## Security Notes

- never commit private keys or `.env` files
- rotate signing keys by replacing both key material and `SIGNING_KEY_ID`
- publish only the public verification key
- treat hashing, proof generation, and signature behavior as security-sensitive
- use a dedicated MongoDB user for deployment
- protect scheduled sealing with `CRON_SECRET`
- protect manual block sealing with `BLOCK_SEAL_TOKEN`
- treat `EVENT_READ_TOKEN` like a secret because it unlocks stored event payloads
- keep `TRANSPARENCY_AUTO_ANCHOR=true` in production unless you have an explicit operational reason to defer anchors

## Testing

The test suite covers:

- canonical JSON hashing
- SHA-256 helpers
- Merkle tree generation and verification
- Ed25519 signing and verification
- repository behavior
- event API behavior
- block sealing behavior
- proof retrieval and verification
- transparency anchor creation and retrieval
- request hardening and structured logging
- CLI verification and proof export

Run all checks with:

```bash
npm run verify
```

## Deployment

Deploy on Vercel with MongoDB Atlas.

The project now exposes two complementary entry points on a deployed base URL:

- `/` human-friendly showcase and interactive API landing page
- `/api` machine-readable API index for tooling and route discovery

See:

- `docs/DEPLOYMENT.md`
- `docs/API.md`

## Maintainer Notes

If you are maintaining the project, start here:

- `docs/API.md`
- `docs/DEPLOYMENT.md`

The project-local planning and workflow docs are intentionally kept out of version control.
