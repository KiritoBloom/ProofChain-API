import { describe, expect, it } from "vitest";

import { generateEd25519KeyPairPem, signEd25519, verifyEd25519Signature } from "../src/lib/crypto/ed25519.js";
import { createSignedBlockPayload, serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";

describe("signed block payloads and signatures", () => {
  it("creates a deterministic block signing payload", () => {
    const payload = createSignedBlockPayload({
      key_id: " main-2026-01 ",
      merkle_root: "14EDE5E8E97AD9372327728F5099B95604A39593CAC3BD38A343AD76205213E7",
      sealed_at: "2026-03-12T00:00:00Z"
    });

    expect(payload).toEqual({
      schema_version: 1,
      algorithm: "Ed25519",
      key_id: "main-2026-01",
      merkle_root: "14ede5e8e97ad9372327728f5099b95604a39593cac3bd38a343ad76205213e7",
      sealed_at: "2026-03-12T00:00:00.000Z"
    });
    expect(serializeSignedBlockPayload(payload)).toBe(
      '{"algorithm":"Ed25519","key_id":"main-2026-01","merkle_root":"14ede5e8e97ad9372327728f5099b95604a39593cac3bd38a343ad76205213e7","schema_version":1,"sealed_at":"2026-03-12T00:00:00.000Z"}'
    );
  });

  it("signs and verifies payloads with Ed25519", () => {
    const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
    const payload = serializeSignedBlockPayload({
      key_id: "main-2026-01",
      merkle_root: "14ede5e8e97ad9372327728f5099b95604a39593cac3bd38a343ad76205213e7",
      sealed_at: "2026-03-12T00:00:00.000Z"
    });

    const firstSignature = signEd25519(payload, privateKeyPem);
    const secondSignature = signEd25519(payload, privateKeyPem);

    expect(firstSignature).toBe(secondSignature);
    expect(verifyEd25519Signature(payload, firstSignature, publicKeyPem)).toBe(true);
    expect(verifyEd25519Signature(`${payload}!`, firstSignature, publicKeyPem)).toBe(false);
  });

  it("rejects malformed signature encoding", () => {
    const { publicKeyPem } = generateEd25519KeyPairPem();

    expect(() => verifyEd25519Signature("payload", "not-base64***", publicKeyPem)).toThrow("base64");
  });
});
