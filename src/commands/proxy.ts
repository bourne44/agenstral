import { join } from "node:path";
import { loadPolicy } from "../policy/loadPolicy.js";
import { runStdioProxy } from "../proxy/stdioProxy.js";
import { getFlag } from "../utils/args.js";

export async function runProxyCommand(args: string[]): Promise<void> {
  const separator = args.indexOf("--");
  if (separator === -1) {
    throw new Error("Usage: agentrail proxy --name <server> [--policy <policy.json>] [--audit <audit.jsonl>] -- <command> [args...]");
  }

  const ownArgs = args.slice(0, separator);
  const childArgs = args.slice(separator + 1);
  const command = childArgs[0];
  if (!command) {
    throw new Error("Proxy command missing after --.");
  }

  const name = getFlag(ownArgs, "--name") ?? "mcp-server";
  const policyPath = getFlag(ownArgs, "--policy") ?? join(process.cwd(), ".agentrail", "policy.json");
  const auditPath = getFlag(ownArgs, "--audit") ?? join(process.cwd(), ".agentrail", "audit.jsonl");
  const policy = await loadPolicy(policyPath);

  await runStdioProxy({
    serverName: name,
    policy,
    auditPath,
    command,
    args: childArgs.slice(1)
  });
}
