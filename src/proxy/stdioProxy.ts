import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { JsonObject, JsonValue, Policy, ToolCall } from "../domain/types.js";
import { appendAuditEvent } from "../audit/auditLog.js";
import { evaluatePolicy } from "../policy/policyEngine.js";
import { redactText } from "../secrets/detect.js";
import { isJsonObject } from "../utils/jsonFile.js";

export interface StdioProxyOptions {
  serverName: string;
  policy: Policy;
  auditPath: string;
  command: string;
  args: string[];
}

export async function runStdioProxy(options: StdioProxyOptions): Promise<void> {
  const child = spawn(options.command, options.args, {
    stdio: ["pipe", "pipe", "pipe"],
    shell: false
  });

  child.stderr.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  pipeClientToServer(process.stdin, child, options);
  pipeServerToClient(child, options);

  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      process.exitCode = code ?? 0;
      resolve();
    });
  });
}

function pipeClientToServer(input: NodeJS.ReadStream, child: ChildProcessWithoutNullStreams, options: StdioProxyOptions): void {
  let buffer = "";

  input.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      void handleClientLine(line, child, options);
    }
  });

  input.on("end", () => {
    if (buffer.length > 0) {
      void handleClientLine(buffer, child, options);
    }
    child.stdin.end();
  });
}

function pipeServerToClient(child: ChildProcessWithoutNullStreams, options: StdioProxyOptions): void {
  let buffer = "";

  child.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      void appendAuditEvent(options.auditPath, {
        kind: "proxy.server_output",
        payload: {
          server: options.serverName,
          line: redactText(line)
        }
      });
      process.stdout.write(`${line}\n`);
    }
  });
}

async function handleClientLine(line: string, child: ChildProcessWithoutNullStreams, options: StdioProxyOptions): Promise<void> {
  const parsed = tryParseJson(line);
  if (!parsed) {
    child.stdin.write(`${line}\n`);
    return;
  }

  const call = toolCallFromJsonRpc(options.serverName, parsed);
  if (!call) {
    child.stdin.write(`${line}\n`);
    return;
  }

  const decision = evaluatePolicy(options.policy, call);
  await appendAuditEvent(options.auditPath, {
    kind: "proxy.tool_call",
    payload: {
      call: {
        server: call.server,
        tool: call.tool,
        arguments: call.arguments ?? {},
        raw: call.raw ?? null
      },
      decision: {
        action: decision.action,
        reason: decision.reason,
        ruleId: decision.ruleId ?? null
      }
    }
  });

  if (decision.action === "allow") {
    child.stdin.write(`${line}\n`);
    return;
  }

  const id = parsed["id"];
  const response = {
    jsonrpc: "2.0",
    id: typeof id === "string" || typeof id === "number" || id === null ? id : null,
    error: {
      code: -32001,
      message: `blocked by Agenstral policy: ${decision.reason}`,
      data: {
        action: decision.action,
        ruleId: decision.ruleId ?? null
      }
    }
  };
  process.stdout.write(`${JSON.stringify(response)}\n`);
}

function toolCallFromJsonRpc(serverName: string, message: JsonObject): ToolCall | null {
  if (message["method"] !== "tools/call") {
    return null;
  }

  const params = message["params"];
  if (!isJsonObject(params) || typeof params["name"] !== "string") {
    return null;
  }

  const args = params["arguments"];
  return {
    server: serverName,
    tool: params["name"],
    arguments: isJsonObject(args) ? args : {},
    raw: message
  };
}

function tryParseJson(line: string): JsonObject | null {
  try {
    const parsed = JSON.parse(line) as JsonValue;
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
