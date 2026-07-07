import { spawn } from "node:child_process";
import { join } from "node:path";
import type { JsonObject, PolicyDecision, ToolCall } from "../domain/types.js";
import { appendAuditEvent } from "../audit/auditLog.js";
import { loadPolicy } from "../policy/loadPolicy.js";
import { evaluatePolicy } from "../policy/policyEngine.js";
import { redactText } from "../secrets/detect.js";
import { getFlag, hasFlag } from "../utils/args.js";

const OUTPUT_PREVIEW_LIMIT = 4000;

export async function runShellCommand(args: string[]): Promise<void> {
  const separator = args.indexOf("--");
  if (separator === -1) {
    throw new Error("Usage: agenstral run [--approve-ask] [--policy <policy.json>] [--audit <audit.jsonl>] -- <command> [args...]");
  }

  const ownArgs = args.slice(0, separator);
  const childArgs = args.slice(separator + 1);
  const command = childArgs[0];
  if (!command) {
    throw new Error("Run command missing after --.");
  }

  const policyPath = getFlag(ownArgs, "--policy") ?? join(process.cwd(), ".agenstral", "policy.json");
  const auditPath = getFlag(ownArgs, "--audit") ?? join(process.cwd(), ".agenstral", "audit.jsonl");
  const approveAsk = hasFlag(ownArgs, "--approve-ask");
  const call = shellToolCall(command, childArgs.slice(1), process.cwd());
  const policy = await loadPolicy(policyPath);
  const decision = evaluatePolicy(policy, call);

  await appendDecision(auditPath, call, decision, approveAsk);

  if (decision.action === "deny") {
    console.error(`agenstral: blocked shell command: ${decision.reason}`);
    process.exitCode = 2;
    return;
  }

  if (decision.action === "ask" && !approveAsk) {
    console.error("agenstral: command requires approval. Re-run with --approve-ask after reviewing the command.");
    console.error(`agenstral: reason: ${decision.reason}`);
    process.exitCode = 3;
    return;
  }

  const result = await executeCommand(command, childArgs.slice(1));
  await appendAuditEvent(auditPath, {
    kind: "shell.result",
    payload: {
      command,
      args: childArgs.slice(1),
      cwd: process.cwd(),
      exitCode: result.exitCode,
      signal: result.signal,
      stdoutPreview: result.stdoutPreview,
      stderrPreview: result.stderrPreview
    }
  });

  process.exitCode = result.exitCode ?? (result.signal ? 1 : 0);
}

function shellToolCall(command: string, args: string[], cwd: string): ToolCall {
  return {
    server: "shell",
    tool: "run_command",
    arguments: {
      command: [command, ...args].join(" "),
      executable: command,
      args,
      cwd
    }
  };
}

async function appendDecision(auditPath: string, call: ToolCall, decision: PolicyDecision, approveAsk: boolean): Promise<void> {
  await appendAuditEvent(auditPath, {
    kind: "shell.decision",
    payload: {
      call: serializeToolCall(call),
      decision: {
        action: decision.action,
        reason: decision.reason,
        ruleId: decision.ruleId ?? null,
        approved: decision.action === "ask" && approveAsk
      }
    }
  });
}

function serializeToolCall(call: ToolCall): JsonObject {
  return {
    server: call.server,
    tool: call.tool,
    arguments: call.arguments ?? {},
    raw: call.raw ?? null
  };
}

async function executeCommand(command: string, args: string[]): Promise<{ exitCode: number | null; signal: NodeJS.Signals | null; stdoutPreview: string; stderrPreview: string }> {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: ["inherit", "pipe", "pipe"]
  });

  let stdoutPreview = "";
  let stderrPreview = "";

  child.stdout.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
    stdoutPreview = appendPreview(stdoutPreview, chunk.toString("utf8"));
  });

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
    stderrPreview = appendPreview(stderrPreview, chunk.toString("utf8"));
  });

  return await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (exitCode, signal) => {
      resolve({
        exitCode,
        signal,
        stdoutPreview: redactText(stdoutPreview),
        stderrPreview: redactText(stderrPreview)
      });
    });
  });
}

function appendPreview(current: string, next: string): string {
  const combined = current + next;
  return combined.length <= OUTPUT_PREVIEW_LIMIT ? combined : combined.slice(0, OUTPUT_PREVIEW_LIMIT);
}
