import { access } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_POLICY } from "../policy/defaultPolicy.js";
import { hasFlag } from "../utils/args.js";
import { writeJsonFile } from "../utils/jsonFile.js";

export async function runPolicyCommand(args: string[]): Promise<void> {
  const subcommand = args[0];
  if (subcommand !== "init") {
    throw new Error("Usage: agentrail policy init [--force]");
  }

  const path = join(process.cwd(), ".agentrail", "policy.json");
  const force = hasFlag(args, "--force");

  if (!force && (await exists(path))) {
    console.log(`Policy already exists: ${path}`);
    return;
  }

  await writeJsonFile(path, DEFAULT_POLICY);
  console.log(`Created ${path}`);
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
