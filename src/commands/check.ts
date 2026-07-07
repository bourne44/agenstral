import { join } from "node:path";
import type { JsonObject, ToolCall } from "../domain/types.js";
import { appendAuditEvent } from "../audit/auditLog.js";
import { loadPolicy } from "../policy/loadPolicy.js";
import { evaluatePolicy } from "../policy/policyEngine.js";
import { formatDecision } from "../reporting/console.js";
import { getFlag } from "../utils/args.js";
import { isJsonObject, readJsonFile } from "../utils/jsonFile.js";

export async function runCheckCommand(args: string[]): Promise<void> {
  const callPath = getFlag(args, "--call");
  if (!callPath) {
    throw new Error("Usage: agentrail check --call <tool-call.json> [--policy <policy.json>] [--audit <audit.jsonl>]");
  }

  const policyPath = getFlag(args, "--policy") ?? join(process.cwd(), ".agentrail", "policy.json");
  const auditPath = getFlag(args, "--audit") ?? join(process.cwd(), ".agentrail", "audit.jsonl");
  const call = parseToolCall(await readJsonFile(callPath));
  const policy = await loadPolicy(policyPath);
  const decision = evaluatePolicy(policy, call);

  await appendAuditEvent(auditPath, {
    kind: "policy.decision",
    payload: {
      call: serializeToolCall(call),
      decision: {
        action: decision.action,
        reason: decision.reason,
        ruleId: decision.ruleId ?? null
      }
    }
  });

  console.log(formatDecision(call, decision));
  if (decision.action === "deny") {
    process.exitCode = 2;
  }
}

function parseToolCall(value: unknown): ToolCall {
  if (!isJsonObject(value)) {
    throw new Error("Tool call must be a JSON object.");
  }

  const object = value as JsonObject;
  if (typeof object["server"] !== "string" || typeof object["tool"] !== "string") {
    throw new Error("Tool call requires string fields: server, tool.");
  }

  const rawArguments = object["arguments"];
  const args = rawArguments === undefined ? {} : rawArguments;
  if (!isJsonObject(args)) {
    throw new Error("Tool call arguments must be a JSON object when provided.");
  }

  return {
    server: object["server"],
    tool: object["tool"],
    arguments: args,
    raw: object
  };
}

function serializeToolCall(call: ToolCall): JsonObject {
  return {
    server: call.server,
    tool: call.tool,
    arguments: call.arguments ?? {},
    raw: call.raw ?? null
  };
}
