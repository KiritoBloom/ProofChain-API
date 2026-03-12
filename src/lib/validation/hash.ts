import { z } from "zod";

export const sha256HexSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "Expected a SHA-256 hex digest.")
  .transform((value) => value.toLowerCase());
