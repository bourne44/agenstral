import { access, readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { Finding } from "../domain/types.js";
import { detectSecrets } from "../secrets/detect.js";
import { detectShellRisks } from "./shellRisk.js";

interface RunBlock {
  line: number;
  command: string;
}

export async function scanGitHubWorkflows(workspace: string, findings: Finding[]): Promise<void> {
  const workflowDir = join(workspace, ".github", "workflows");
  if (!(await exists(workflowDir))) {
    return;
  }

  const files = await workflowFiles(workflowDir);
  await Promise.all(files.map((file) => inspectWorkflow(file, findings)));
}

async function inspectWorkflow(file: string, findings: Finding[]): Promise<void> {
  const text = await readFile(file, "utf8");
  const lines = text.split(/\r?\n/);

  const secretMatches = detectSecrets(text);
  if (secretMatches.length > 0) {
    findings.push({
      id: "github.workflow.secret",
      title: "Secret-looking value in GitHub Actions workflow",
      severity: "critical",
      location: file,
      detail: `Workflow contains ${secretMatches.map((match) => match.type).join(", ")}.`,
      recommendation: "Move credentials to GitHub Actions secrets or short-lived OIDC federation, then rotate exposed values."
    });
  }

  if (/^\s*permissions\s*:\s*write-all\s*(?:#.*)?$/im.test(text)) {
    findings.push({
      id: "github.workflow.write-all-permissions",
      title: "GitHub Actions workflow grants write-all permissions",
      severity: "high",
      location: file,
      detail: "The workflow grants write-all token permissions to jobs by default.",
      recommendation: "Set the narrowest required permissions at workflow or job scope."
    });
  }

  if (/\bpull_request_target\b/.test(text)) {
    findings.push({
      id: "github.workflow.pull-request-target",
      title: "GitHub Actions workflow uses pull_request_target",
      severity: "high",
      location: file,
      detail: "The workflow can run with privileged repository context on pull request events.",
      recommendation: "Avoid checking out or executing untrusted pull request code in pull_request_target workflows."
    });
  }

  inspectActions(file, lines, findings);
  inspectRunBlocks(file, lines, findings);
  inspectAgenticTrigger(file, lines, findings);
}

function inspectAgenticTrigger(file: string, lines: string[], findings: Finding[]): void {
  const trigger = detectUntrustedTrigger(lines);
  if (!trigger) {
    return;
  }

  const agentActions = [
    ...new Set(
      lines
        .map((line) => parseUsesAction(line))
        .filter((action): action is string => action !== null && isAgentAction(action))
    )
  ];

  if (agentActions.length === 0) {
    return;
  }

  findings.push({
    id: "github.workflow.agentic-untrusted-trigger",
    title: "AI agent workflow can be triggered by untrusted input",
    severity: "high",
    location: file,
    detail: `The workflow runs an AI agent (${agentActions.slice(0, 3).join(", ")}) on the "${trigger}" event, whose payload is attacker-controlled. Hidden instructions in an issue, comment, or pull request can steer the agent into leaking private data or abusing its permissions (the GitLost class of prompt-injection attacks).`,
    recommendation: "Do not run autonomous agents directly on untrusted-input triggers. If unavoidable, isolate the agent from repository secrets and write permissions and require human approval before it acts."
  });
}

function detectUntrustedTrigger(lines: string[]): string | null {
  const onBlock = extractOnBlock(lines);
  if (!onBlock) {
    return null;
  }

  for (const trigger of UNTRUSTED_TRIGGERS) {
    if (new RegExp(`(^|[\\s,\\[])${trigger}(\\s|:|,|\\]|$)`, "im").test(onBlock)) {
      return trigger;
    }
  }

  return null;
}

function extractOnBlock(lines: string[]): string {
  let start = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (/^on\s*:/.test(lines[index] ?? "")) {
      start = index;
      break;
    }
  }

  if (start === -1) {
    return "";
  }

  const collected = [(lines[start] ?? "").replace(/^on\s*:/, "").trim()];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      continue;
    }
    if (/^\S/.test(line)) {
      break;
    }
    collected.push(line.trim());
  }

  return collected.join("\n");
}

function isAgentAction(action: string): boolean {
  return AGENT_ACTION_HINTS.some((pattern) => pattern.test(action));
}

function inspectActions(file: string, lines: string[], findings: Finding[]): void {
  const unpinned = lines.flatMap((line, index) => {
    const action = parseUsesAction(line);
    if (!action || isPinnedAction(action)) {
      return [];
    }
    return [`line ${index + 1}: ${action}`];
  });

  if (unpinned.length === 0) {
    return;
  }

  findings.push({
    id: "github.workflow.unpinned-action",
    title: "GitHub Actions workflow uses unpinned actions",
    severity: "medium",
    location: file,
    detail: `Unpinned actions: ${unpinned.slice(0, 5).join("; ")}${unpinned.length > 5 ? "; ..." : ""}.`,
    recommendation: "Pin third-party and first-party actions to full commit SHAs for reproducible CI."
  });
}

function inspectRunBlocks(file: string, lines: string[], findings: Finding[]): void {
  for (const block of extractRunBlocks(lines)) {
    for (const risk of detectShellRisks(block.command)) {
      findings.push({
        id: `github.workflow.${risk.kind}`,
        title: risk.title,
        severity: risk.severity,
        location: `${file}:${block.line}`,
        detail: `Workflow run block: ${risk.detail}`,
        recommendation: risk.recommendation
      });
    }
  }
}

function parseUsesAction(line: string): string | null {
  const match = line.match(/^\s*(?:-\s*)?uses\s*:\s*["']?([^"'\s#]+)["']?/i);
  return match?.[1] ?? null;
}

function isPinnedAction(action: string): boolean {
  if (action.startsWith("./") || action.startsWith("../") || action.startsWith("docker://")) {
    return true;
  }

  const atIndex = action.lastIndexOf("@");
  if (atIndex === -1) {
    return false;
  }

  const ref = action.slice(atIndex + 1);
  return /^[a-f0-9]{40}$/i.test(ref);
}

function extractRunBlocks(lines: string[]): RunBlock[] {
  const blocks: RunBlock[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = line.match(/^(\s*)(?:-\s*)?run\s*:\s*(.*)$/i);
    if (!match) {
      continue;
    }

    const baseIndent = match[1]?.length ?? 0;
    const remainder = match[2]?.trim() ?? "";
    if (remainder !== "|" && remainder !== ">") {
      blocks.push({
        line: index + 1,
        command: stripInlineComment(remainder)
      });
      continue;
    }

    const collected: string[] = [];
    let cursor = index + 1;
    for (; cursor < lines.length; cursor += 1) {
      const next = lines[cursor] ?? "";
      if (next.trim().length === 0) {
        collected.push("");
        continue;
      }

      if (indentOf(next) <= baseIndent) {
        break;
      }

      collected.push(next.trim());
    }

    blocks.push({
      line: index + 1,
      command: collected.join("\n")
    });
    index = cursor - 1;
  }

  return blocks;
}

function stripInlineComment(value: string): string {
  return value.replace(/\s+#.*$/, "");
}

function indentOf(value: string): number {
  return value.match(/^\s*/)?.[0].length ?? 0;
}

const UNTRUSTED_TRIGGERS = [
  "issue_comment",
  "issues",
  "pull_request_target",
  "discussion_comment",
  "discussion"
];

const AGENT_ACTION_HINTS = [
  /^anthropics\//i,
  /^openai\//i,
  /copilot/i,
  /gemini/i,
  /ai-inference/i,
  /(^|\/|-)agents?(-|\/|@|$)/i
];

async function workflowFiles(workflowDir: string): Promise<string[]> {
  const entries = await readdir(workflowDir);
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(workflowDir, entry);
    const info = await stat(path);
    if (info.isFile() && /\.ya?ml$/i.test(entry)) {
      files.push(path);
    }
  }

  return files.sort();
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
