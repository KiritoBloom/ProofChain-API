# ProofChain API

ProofChain API is a tamper-evident audit logging backend designed for verifiable event integrity.

The system will ingest events, hash them deterministically, seal them into signed Merkle blocks, and return proofs that can be verified independently.

## Current Status

- Phase 1 scaffold is complete.
- Phase 2 core integrity libraries are implemented.
- Phase 7 hardening and release-readiness work is in progress.
- Current checkpoint lives in `docs/planning/PROGRESS.md`.

## Stack

- Node.js
- TypeScript with strict mode
- Vercel serverless API handlers
- MongoDB Atlas
- Zod for validation
- Vitest for tests

## Repository Layout

```text
api/
src/
  modules/
  lib/
  types/
docs/
  planning/
tests/
scripts/
```

## Scripts

- `npm run demo` runs a one-shot integrity demo covering canonicalization, hashing, Merkle proofs, and signatures.
- `npm run demo:server` runs a one-shot local scaffold route demo.
- `npm run demo:proof` runs a proof retrieval and verification demo.
- `npm run demo:cli` runs the standalone CLI verifier demo.
- `npm run dev` starts a local demo server on `http://localhost:3000`.
- `npm run check:env` validates the current environment shell and reports missing runtime secrets.
- `npm run typecheck` runs TypeScript validation.
- `npm run lint` runs ESLint.
- `npm run test` runs Vitest.
- `npm run verify` runs typecheck, lint, and tests together.

## Local Setup

1. Copy `.env.example` to `.env` or set the variables in your shell.
2. Install dependencies with `npm install`.
3. Run `npm run demo` for a quick integrity demo.
4. Run `npm run verify` before committing changes.

## Available Demo Routes

- `GET /`
- `GET /health`

These routes only prove that the scaffold, configuration shell, and handler conventions are working. They are not the final ProofChain product endpoints.

## Implemented Integrity Libraries

- canonical JSON serialization
- SHA-256 hashing helpers
- deterministic Merkle tree construction with odd-leaf duplication
- Merkle proof generation and verification
- deterministic signed block payload serialization
- Ed25519 signing and verification helpers

## CLI Verifier

Use the standalone CLI verifier with:

```bash
proofchain verify proof.json
```

If the proof file does not include `public_key`, provide it manually:

```bash
proofchain verify proof.json --public-key "-----BEGIN PUBLIC KEY-----..."
```

## Publish Verification Key

The current verification key can be published at:

- `GET /keys/current`

This returns the active public key metadata for external verifiers.

## Maintainer Docs

Read these in order:

1. `docs/PROJECT_STATUS.md`
2. `docs/planning/PROGRESS.md`
3. `docs/planning/PHASES.md`
4. `AGENTS.md`
5. `docs/SECURITY.md`
6. `docs/MAINTAINABILITY.md`
7. `docs/API.md`
8. `docs/DEPLOYMENT.md`
