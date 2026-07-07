import type { JsonValue } from "../domain/types.js";

export function canonicalJson(value: JsonValue): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }

  if (value !== null && typeof value === "object") {
    const sorted: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortValue(value[key] as JsonValue);
    }
    return sorted;
  }

  return value;
}
