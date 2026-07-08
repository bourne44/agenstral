import { access, readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import type { Finding, GuidanceFile, JsonObject, JsonValue, McpServerConfig, ScanReport } from "../domain/types.js";
import { detectSecrets } from "../secrets/detect.js";
import { asStringArray, isJsonObject } from "../utils/jsonFile.js";
import { scanGitHubWorkflows } from "./githubActions.js";
import { scanPackageScripts } from "./packageScripts.js";

export interface ScanOptions {
  workspace: string;
}

export async function scanWorkspace(options: ScanOptions): Promise<ScanReport> {
  const workspace = resolve(options.workspace);
  const findings: Finding[] = [];
  const configs = await discoverMcpConfigs(workspace, findings);
  const guidance = await discoverGuidanceFiles(workspace, findings);

  await scanSensitiveWorkspaceFiles(workspace, findings);
  await scanPackageScripts(workspace, findings);
  await scanGitHubWorkflows(workspace, findings);

  if (configs.length === 0) {
    findings.push({
      id: "mcp.config.none",
      title: "No MCP configuration found",
      severity: "info",
      location: workspace,
      detail: "No known MCP configuration files were found in the workspace or common user locations.",
      recommendation: "Add MCP servers deliberately and track them with policy before granting broad tool access."
    });
  }

  return {
    scannedAt: new Date().toISOString(),
    workspace,
    configs,
    guidance,
    findings
  };
}

async function discoverMcpConfigs(workspace: string, findings: Finding[]): Promise<McpServerConfig[]> {
  const configs: McpServerConfig[] = [];

  for (const file of candidateConfigPaths(workspace)) {
    if (!(await exists(file))) {
      continue;
    }

    try {
      const parsed = JSON.parse(await readFile(file, "utf8")) as JsonValue;
      configs.push(...extractServers(file, parsed, findings));
    } catch (error) {
      findings.push({
        id: "mcp.config.invalid-json",
        title: "Invalid MCP configuration JSON",
        severity: "medium",
        location: file,
        detail: error instanceof Error ? error.message : "Unable to parse JSON.",
        recommendation: "Fix JSON syntax before relying on this agent configuration."
      });
    }
  }

  return configs;
}

function candidateConfigPaths(workspace: string): string[] {
  const home = homedir();
  const appData = process.env["APPDATA"];
  const explicit = process.env["AGENSTRAL_MCP_CONFIG"];
  const paths = [
    join(workspace, "mcp.json"),
    join(workspace, ".cursor", "mcp.json"),
    join(workspace, ".vscode", "mcp.json"),
    join(home, ".cursor", "mcp.json")
  ];

  if (appData) {
    paths.push(
      join(appData, "Cursor", "User", "mcp.json"),
      join(appData, "Code", "User", "mcp.json")
    );
  }

  if (explicit) {
    paths.unshift(explicit);
  }

  return [...new Set(paths.map((item) => resolve(item)))];
}

function extractServers(sourceFile: string, parsed: JsonValue, findings: Finding[]): McpServerConfig[] {
  if (!isJsonObject(parsed)) {
    return [];
  }

  const serverRoot = selectServerRoot(parsed);
  if (!serverRoot) {
    return [];
  }

  const servers: McpServerConfig[] = [];
  for (const [name, value] of Object.entries(serverRoot)) {
    if (!isJsonObject(value)) {
      continue;
    }

    const command = typeof value["command"] === "string" ? value["command"] : undefined;
    const url = typeof value["url"] === "string" ? value["url"] : undefined;
    const args = asStringArray(value["args"]);
    const env = isJsonObject(value["env"]) ? Object.entries(value["env"]) : [];
    const envKeys = env.map(([key]) => key);
    const transport = command ? "stdio" : url ? "http" : "unknown";

    const server: McpServerConfig = {
      name,
      sourceFile,
      args,
      envKeys,
      transport,
      ...(command ? { command } : {}),
      ...(url ? { url } : {})
    };
    servers.push(server);
    inspectServer(server, value, findings);
  }

  return servers;
}

function selectServerRoot(parsed: JsonObject): JsonObject | null {
  const roots = ["mcpServers", "servers"];
  for (const root of roots) {
    const value = parsed[root];
    if (isJsonObject(value)) {
      return value;
    }
  }
  return null;
}

function inspectServer(server: McpServerConfig, raw: JsonObject, findings: Finding[]): void {
  const rawText = JSON.stringify(raw);
  const secretMatches = detectSecrets(rawText);
  if (secretMatches.length > 0) {
    findings.push({
      id: "mcp.config.secret",
      title: "Secret-looking value in MCP configuration",
      severity: "critical",
      location: server.sourceFile,
      detail: `${server.name} contains ${secretMatches.map((match) => match.type).join(", ")}.`,
      recommendation: "Move secrets to a dedicated secret manager or short-lived environment injection path."
    });
  }

  if (server.command && /^(npx|uvx|pipx)$/i.test(server.command) && server.args.some((arg) => /@latest\b/i.test(arg))) {
    findings.push({
      id: "mcp.config.unpinned-package",
      title: "MCP server uses an unpinned package",
      severity: "medium",
      location: server.sourceFile,
      detail: `${server.name} launches ${server.command} with @latest.`,
      recommendation: "Pin package versions for reproducible and reviewable agent toolchains."
    });
  }

  if (server.url && /^http:\/\//i.test(server.url) && !/^http:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(server.url)) {
    findings.push({
      id: "mcp.config.insecure-http",
      title: "Remote MCP server uses plaintext HTTP",
      severity: "high",
      location: server.sourceFile,
      detail: `${server.name} points to ${server.url}.`,
      recommendation: "Use HTTPS or a local loopback endpoint with an authenticated tunnel."
    });
  }

  if (server.command && /^(powershell|pwsh|cmd|bash|sh)$/i.test(server.command) && server.args.some((arg) => /-c|\/c|encodedcommand/i.test(arg))) {
    findings.push({
      id: "mcp.config.inline-shell",
      title: "MCP server launches inline shell code",
      severity: "high",
      location: server.sourceFile,
      detail: `${server.name} launches ${server.command} with inline execution flags.`,
      recommendation: "Replace inline shell with a reviewed executable or script path."
    });
  }
}

async function discoverGuidanceFiles(workspace: string, findings: Finding[]): Promise<GuidanceFile[]> {
  const guidancePaths = [join(workspace, "AGENTS.md")];
  const guidance: GuidanceFile[] = [];

  for (const path of guidancePaths) {
    if (!(await exists(path))) {
      findings.push({
        id: "guidance.missing",
        title: "Agent guidance file missing",
        severity: "low",
        location: workspace,
        detail: "No AGENTS.md was found at the workspace root.",
        recommendation: "Add AGENTS.md with setup, testing, style, and security instructions for coding agents."
      });
      continue;
    }

    const text = await readFile(path, "utf8");
    const file: GuidanceFile = {
      path,
      hasSetup: /setup|install|build/i.test(text),
      hasTesting: /test|verify|check/i.test(text),
      hasSecurity: /security|secret|credential|token/i.test(text)
    };
    guidance.push(file);

    if (!file.hasTesting || !file.hasSecurity) {
      findings.push({
        id: "guidance.incomplete",
        title: "Agent guidance is missing safety-critical sections",
        severity: "medium",
        location: path,
        detail: `Testing present: ${file.hasTesting}. Security present: ${file.hasSecurity}.`,
        recommendation: "Document verification commands and security boundaries before autonomous changes."
      });
    }
  }

  return guidance;
}

async function scanSensitiveWorkspaceFiles(workspace: string, findings: Finding[]): Promise<void> {
  const entries = await safeReaddir(workspace);
  for (const entry of entries) {
    const path = join(workspace, entry);
    const info = await stat(path);
    if (!info.isFile()) {
      continue;
    }

    if (!/^\.env(\..*)?$|^mcp\.json$/i.test(entry)) {
      continue;
    }

    const matches = detectSecrets(await readFile(path, "utf8"));
    if (matches.length === 0) {
      continue;
    }

    findings.push({
      id: "workspace.secret",
      title: "Secret-looking value in workspace file",
      severity: "critical",
      location: path,
      detail: `${entry} contains ${matches.map((match) => match.type).join(", ")}.`,
      recommendation: "Remove secrets from the workspace and rotate any exposed credentials."
    });
  }
}

async function safeReaddir(path: string): Promise<string[]> {
  try {
    return await readdir(path);
  } catch {
    return [];
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
