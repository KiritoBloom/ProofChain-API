import { generateEd25519KeyPairPem, signEd25519, verifyEd25519Signature } from "../src/lib/crypto/ed25519.js";
import { hashCanonicalJson } from "../src/lib/crypto/hash.js";
import { createSignedBlockPayload, serializeSignedBlockPayload } from "../src/lib/crypto/signed-block.js";
import { buildMerkleProof, buildMerkleTree, verifyMerkleProof } from "../src/lib/merkle/tree.js";

async function main(): Promise<void> {
  const events = [
    {
      service: "auth-service",
      type: "login-attempt",
      payload: {
        ip: "203.0.113.10",
        success: true,
        user_id: "user-100"
      }
    },
    {
      payload: {
        amount: 200,
        currency: "USD",
        user_id: "user-1245"
      },
      type: "transaction",
      service: "payment-service"
    },
    {
      service: "orders-service",
      payload: {
        order_id: "ord-200",
        status: "confirmed"
      },
      type: "status-change"
    }
  ] as const;

  const hashedEvents = events.map((event) => hashCanonicalJson(event));
  const merkleTree = buildMerkleTree(hashedEvents.map((event) => event.hash));
  const proof = buildMerkleProof(merkleTree, 1);

  const signedPayload = createSignedBlockPayload({
    key_id: "demo-2026-01",
    merkle_root: merkleTree.root,
    sealed_at: "2026-03-12T00:00:00.000Z"
  });
  const serializedPayload = serializeSignedBlockPayload(signedPayload);
  const { privateKeyPem, publicKeyPem } = generateEd25519KeyPairPem();
  const signature = signEd25519(serializedPayload, privateKeyPem);

  const proofValid = verifyMerkleProof(hashedEvents[1].hash, proof, merkleTree.root);
  const signatureValid = verifyEd25519Signature(serializedPayload, signature, publicKeyPem);

  console.log("Canonical event hashes");
  console.log(
    JSON.stringify(
      hashedEvents.map((event, index) => ({
        event: index + 1,
        canonical: event.canonical,
        hash: event.hash
      })),
      null,
      2
    )
  );
  console.log("");
  console.log("Merkle root and proof");
  console.log(
    JSON.stringify(
      {
        merkleRoot: merkleTree.root,
        proof,
        proofValid
      },
      null,
      2
    )
  );
  console.log("");
  console.log("Signed block payload");
  console.log(
    JSON.stringify(
      {
        payload: signedPayload,
        serializedPayload,
        signature,
        signatureValid
      },
      null,
      2
    )
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
