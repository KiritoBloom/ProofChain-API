# Deployment Guide

This guide covers the current free-tier deployment path for ProofChain API.

## Target Platform

- Vercel for serverless API hosting
- MongoDB Atlas for persistence

## Required Environment Variables

Application:

- `NODE_ENV=production`
- `APP_NAME=ProofChain API`
- `API_BASE_URL=https://your-project.vercel.app`
- `LOG_LEVEL=info`
- `CRON_SECRET=...` optional but strongly recommended for scheduled sealing
- `BLOCK_SEAL_TOKEN=...` required for manual block sealing
- `EVENT_READ_TOKEN=...` required for full event payload retrieval
- `TRANSPARENCY_AUTO_ANCHOR=true` recommended so every newly sealed block is checkpointed automatically

Database:

- `MONGODB_URI=...`
- `MONGODB_DB_NAME=proofchain`

Signing:

- `SIGNING_PRIVATE_KEY=...`
- `SIGNING_PUBLIC_KEY=...`
- `SIGNING_KEY_ID=main-2026-01`

## Vercel Setup

1. Import the GitHub repository into Vercel.
2. Configure the environment variables in the Vercel dashboard.
3. Ensure the project uses Node.js 20+.
4. Deploy the main branch.

## MongoDB Atlas Setup

1. Create a free cluster.
2. Create a dedicated database user.
3. Restrict network access as tightly as practical.
4. Store the Atlas connection string in `MONGODB_URI`.

## Signing Key Setup

1. Generate an Ed25519 keypair outside the repository.
2. Put the private key only in Vercel env vars.
3. Publish or distribute the public key for verification clients.
4. Track the key version with `SIGNING_KEY_ID`.

## Access Control Setup

1. Set `BLOCK_SEAL_TOKEN` to protect manual `POST /api/blocks/create` calls.
2. Set `EVENT_READ_TOKEN` to protect full payload reads from `GET /api/events/:event_id`.
3. Keep both values in Vercel environment variables only.

## Cron Setup

The project supports scheduled block sealing through `GET /blocks/create` for cron-like requests.

In Vercel, configure a cron entry that targets:

- `/api/blocks/create`

If `CRON_SECRET` is configured, require it on scheduled block creation requests so cron invocations are authenticated in addition to the Vercel cron user agent.

## Post-Deploy Checks

Run these checks after deployment:

1. ingest a sample event through `POST /events`
2. fetch it through `GET /events/:event_id` and confirm redacted metadata is returned without `EVENT_READ_TOKEN`
3. fetch it again with `Authorization: Bearer <EVENT_READ_TOKEN>` and confirm the full payload is returned
4. seal a block through `POST /blocks/create` with `Authorization: Bearer <BLOCK_SEAL_TOKEN>` or cron
5. fetch the resulting anchor through `GET /anchors/:block_id`
6. fetch proof through `GET /proof/:event_id`
7. verify it through `POST /verify` and confirm `anchor_valid` is returned when an anchor is present

## Operational Notes

- keep signing keys out of source control
- rotate keys by updating `SIGNING_KEY_ID` and key material together
- review logs for repeated `429`, `409`, anchor gaps, or verification failures
- rotate `BLOCK_SEAL_TOKEN` and `EVENT_READ_TOKEN` if they are exposed
