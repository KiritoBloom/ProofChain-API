import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject } from "node:crypto";

type MessageInput = string | Uint8Array;
type PrivateKeyInput = KeyObject | string;
type PublicKeyInput = KeyObject | string;

export interface Ed25519KeyPairPem {
  privateKeyPem: string;
  publicKeyPem: string;
}

export function generateEd25519KeyPairPem(): Ed25519KeyPairPem {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
    privateKeyEncoding: {
      format: "pem",
      type: "pkcs8"
    },
    publicKeyEncoding: {
      format: "pem",
      type: "spki"
    }
  });

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  };
}

export function signEd25519(message: MessageInput, privateKey: PrivateKeyInput): string {
  const key = toEd25519PrivateKey(privateKey);
  const signature = sign(null, toMessageBuffer(message), key);

  return signature.toString("base64");
}

export function verifyEd25519Signature(
  message: MessageInput,
  signature: string,
  publicKey: PublicKeyInput
): boolean {
  const key = toEd25519PublicKey(publicKey);
  const signatureBytes = decodeBase64Signature(signature);

  return verify(null, toMessageBuffer(message), key, signatureBytes);
}

function toEd25519PrivateKey(input: PrivateKeyInput): KeyObject {
  const key = typeof input === "string" ? createPrivateKey(input.trim()) : input;

  if (key.type !== "private" || key.asymmetricKeyType !== "ed25519") {
    throw new Error("Expected an Ed25519 private key.");
  }

  return key;
}

function toEd25519PublicKey(input: PublicKeyInput): KeyObject {
  const key = typeof input === "string" ? createPublicKey(input.trim()) : input;

  if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") {
    throw new Error("Expected an Ed25519 public key.");
  }

  return key;
}

function toMessageBuffer(message: MessageInput): Buffer {
  return typeof message === "string" ? Buffer.from(message, "utf8") : Buffer.from(message);
}

function decodeBase64Signature(signature: string): Buffer {
  const normalized = signature.trim();

  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    throw new Error("Expected a base64-encoded Ed25519 signature.");
  }

  return Buffer.from(normalized, "base64");
}
