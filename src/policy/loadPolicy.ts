import { access } from "node:fs/promises";
import { DEFAULT_POLICY } from "./defaultPolicy.js";
import type { Policy } from "../domain/types.js";
import { isJsonObject, readJsonFile } from "../utils/jsonFile.js";

export async function loadPolicy(path: string): Promise<Policy> {
  try {
    await access(path);
  } catch {
    return DEFAULT_POLICY;
  }

  const parsed = await readJsonFile(path);
  if (!isPolicy(parsed)) {
    throw new Error(`Invalid policy file: ${path}`);
  }

  return parsed;
}

function isPolicy(value: unknown): value is Policy {
  if (!isJsonObject(value)) {
    return false;
  }

  const maybe = value as Partial<Policy>;
  return maybe.version === 1 && isPolicyAction(maybe.defaultAction) && Array.isArray(maybe.rules);
}

function isPolicyAction(value: unknown): value is Policy["defaultAction"] {
  return value === "allow" || value === "deny" || value === "ask";
}
