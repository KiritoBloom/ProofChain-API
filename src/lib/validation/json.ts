import { z } from "zod";

import type { CanonicalJsonObject, CanonicalJsonValue } from "../../types/integrity.js";

export const jsonValueSchema: z.ZodType<CanonicalJsonValue> = z.lazy(() =>
  z.union([z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), jsonObjectSchema])
);

export const jsonObjectSchema: z.ZodType<CanonicalJsonObject> = z.record(jsonValueSchema);
