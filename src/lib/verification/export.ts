import { writeFile } from "node:fs/promises";

import type { ProofEnvelope } from "../../types/integrity.js";

export async function exportProofToFile(options: {
  outputPath: string;
  proof: ProofEnvelope;
  publicKey?: string;
}): Promise<void> {
  const payload = options.publicKey ? { ...options.proof, public_key: options.publicKey } : options.proof;

  await writeFile(options.outputPath, JSON.stringify(payload, null, 2), "utf8");
}
