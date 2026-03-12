import { z } from "zod";

export const currentKeyResponseSchema = z.object({
  algorithm: z.literal("Ed25519"),
  key_id: z.string().min(1),
  public_key: z.string().min(1)
});
