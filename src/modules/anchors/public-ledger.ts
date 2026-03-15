import type { PublicAnchorRecord } from "../../types/persistence.js";

export function toPublicAnchorRecord(
  anchor: PublicAnchorRecord
): PublicAnchorRecord {
  return { ...anchor };
}
