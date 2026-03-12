import type { CanonicalJsonValue } from "../../types/integrity.js";

export function canonicalizeJson(value: CanonicalJsonValue): string {
  return serializeCanonicalJsonValue(value);
}

function serializeCanonicalJsonValue(value: CanonicalJsonValue): string {
  if (value === null) {
    return "null";
  }

  if (Array.isArray(value)) {
    return serializeCanonicalJsonArray(value);
  }

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      return serializeCanonicalJsonNumber(value);
    case "string":
      return JSON.stringify(value);
    case "object":
      return serializeCanonicalJsonObject(value);
    default:
      return assertNeverSerializable(value);
  }
}

function serializeCanonicalJsonArray(value: CanonicalJsonValue[]): string {
  const items: string[] = [];

  for (let index = 0; index < value.length; index += 1) {
    if (!(index in value)) {
      throw new Error("Sparse arrays are not supported in canonical JSON.");
    }

    const item = value[index];

    if (item === undefined) {
      throw new Error("Undefined array values are not supported in canonical JSON.");
    }

    items.push(serializeCanonicalJsonValue(item));
  }

  return `[${items.join(",")}]`;
}

function serializeCanonicalJsonObject(value: Record<string, CanonicalJsonValue>): string {
  assertPlainObject(value);

  const keys = Object.keys(value).sort();
  const pairs = keys.map((key) => {
    const propertyValue = value[key];

    if (propertyValue === undefined) {
      throw new Error(`Undefined object values are not supported in canonical JSON: ${key}`);
    }

    return `${JSON.stringify(key)}:${serializeCanonicalJsonValue(propertyValue)}`;
  });

  return `{${pairs.join(",")}}`;
}

function serializeCanonicalJsonNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error("Non-finite numbers are not supported in canonical JSON.");
  }

  if (Object.is(value, -0)) {
    return "0";
  }

  return JSON.stringify(value);
}

function assertPlainObject(value: Record<string, CanonicalJsonValue>): void {
  const prototype = Object.getPrototypeOf(value);

  if (prototype === Object.prototype || prototype === null) {
    return;
  }

  throw new Error("Only plain JSON objects are supported in canonical JSON.");
}

function assertNeverSerializable(value: never): never {
  throw new Error(`Unsupported canonical JSON value type: ${typeof value}`);
}
